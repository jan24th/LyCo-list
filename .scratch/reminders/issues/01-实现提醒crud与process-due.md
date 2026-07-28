Title: 实现提醒 CRUD 与 process-due
Old-ID: 012
Status: resolved
Labels: api,reminders
Estimate: 5
Blocked by: ../../tasks/issues/02-实现任务与无级子任务crud.md
PHASE: 1
CYCLE: 4
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md

# 实现提醒 CRUD 与 process-due

## 用户故事

作为用户，我希望设置提醒并处理到期提醒，以便在正确的时间收到通知。

## 范围

### 包含
- 实现提醒的创建、读取、更新、删除（CRUD）接口
- 提醒存储到期时间（due time）和 IANA 时区
- 更新提醒时通过 `version` 进行条件检查
- 实现 process-due 任务，扫描到期提醒并创建对应通知

### 不包含
- 任务分配与分配通知
- 任务移动、完成、恢复等状态变更
- 通知的实际投递渠道

## 验收标准

### 场景 1：创建提醒

Given 一个已存在的任务
When 用户创建提醒
Then 提醒以到期时间和时区存储

### 场景 2：更新提醒

Given 一个已存在的提醒
When 用户更新它
Then 修改通过 version 检查后持久化

### 场景 3：处理到期提醒

Given 提醒已过期
When process-due 任务运行
Then 为这些提醒创建通知

---

## 2026-07-27 Triage 裁定

以 `.lychee/artifacts/designs/2026-07-13-lyco-list-design.md` 为权威，合并原 ticket 与设计文档。

### 路由

| 方法 | 路径 | 所属 Lambda |
|---|---|---|
| GET | `/api/tasks/{taskId}/reminders` | `reminders` |
| POST | `/api/tasks/{taskId}/reminders` | `reminders` |
| PATCH | `/api/tasks/{taskId}/reminders/{id}` | `reminders` |
| DELETE | `/api/tasks/{taskId}/reminders/{id}` | `reminders` |
| POST | `/api/reminders/process-due` | `reminders` |

SST 中 reminder 路由在 `ANY /api/tasks/{proxy+}` 之前注册，API Gateway V2 按精确度优先匹配。

### 裁定 1：流程与优先级

1. **package.json + 骨架** → `apps/api/src/reminders/`（`client.ts`、`db.ts`、`index.ts`），`package.json` 的 `test`、`typecheck` 脚本已覆盖 `src/`。
2. **shared schema** → 已存在 `packages/shared/src/schema/reminders/`，无需修改。任务重复规则互斥约束（任务 `recurrence != none` → 提醒 `recurrence = none`）在 handler 层校验，因为需要读取关联任务。
3. **DB 层** → `createReminder`、`getRemindersByTask`（GSI1 分页）、`getReminderById`、`updateReminder`（条件写 expectedVersion）、`deleteReminder`（条件写 expectedVersion，硬删除）、`processDueReminders`（扫描 + 事务 + recurrence 推进）。
4. **Handler 层** → 5 条路由分发，路径参数提取，ValidationError → 400，NotFoundError → 404，ConflictError → 409。
5. **SST 配置** → `reminderHandler` 含 CRUD + `dynamodb:TransactWriteItems` 权限，5 条路由在 tasks catch-all 之前注册。
6. **Bruno** → `bruno/lyco-list/reminders/` 下 5 个请求文件。

### 裁定 2：process-due 事务语义

对每条到期提醒，在**单个 TransactWriteCommand** 中：

1. **更新提醒**：条件 `version = :expectedVersion` 且 `isEnabled = true`。若 `recurrence = "none"` → SET `isEnabled = false`；否则 → SET `triggerAt = :nextTrigger`（IANA 时区本地日历推进）+ version+1 + updatedAt/updatedBy。
2. **创建通知**：每位接收人一条 `NOTIFICATION`，条件 `attribute_not_exists(PK)`，确定性 UUID v5 命名空间 + SHA-1，type `"reminder"`、`reminderId` 必填。
3. **事务失败**：跳过该条提醒，`console.error` 结构化日志，继续处理后续提醒。process-due 每次最多 100 条，返回 `{ processedCount, nextCursor }`。

并发 process-due（前端多标签页）只有一个事务成功；重试因 `triggerAt` 已推进而不产生重复 ID。

### 裁定 3：确定性通知 ID

- 命名空间：固定 UUID v5 namespace（`6ba7b820-9dad-11d1-80b4-00c04fd430c8`）。
- 输入：`reminder:{reminderId}:{recipientId}:{triggerAt}`（字符串拼接）。
- 算法：SHA-1 → UUID v5 格式（同 tasks/db.ts 的 `createAssignmentNotificationId`）。
- `triggerAt` 是 ISO 8601 UTC 字符串，每次 recurrence 推进后变化，天然保证新旧通知不碰撞。

### 裁定 4：接收人确定

- 读取关联任务：`assigneeIds.length > 0` → 全部 assignee；否则 → `[reminder.createdBy]`。
- 不调用 Cognito 验证接收人是否存在。

### 裁定 5：Recurrence 推进

使用 `Intl.DateTimeFormat` + IANA `timeZone` 做本地日历加法，避免夏令时漂移：
- `none` → 禁用（`isEnabled = false`）。
- `daily` → `+1 day`。
- `weekly` → `+7 days`。
- `biweekly` → `+14 days`。
- `monthly` → `+1 month`（月末截断至当月最后一天）。
- `yearly` → `+1 year`。
- `weekdays` → 依次 `+1 day` 跳过周六周日。

计算结果用 `new Date(localDateTimetring).toISOString()` 转回 UTC。

### 裁定 6：提醒 CRUD 细节

- **创建**：POST body 用 `reminderInputSchema` 校验；读取 taskId 对应任务确认存在且未删除（不存在 → NotFoundError）；生成 UUID、version=1、审计字段；`isEnabled` 默认 `true`。
- **读取列表**：`GET /api/tasks/{taskId}/reminders` → 查询 GSI1 `PK = TASK#<taskId>#REMINDERS`，按 `TRIGGER#<triggerAt>` 排序，支持 `limit`/`cursor` 分页。
- **更新**：PATCH body 用 `reminderUpdateSchema`（partial）校验；条件写 `version = :expectedVersion`；冲突 → ConflictError。
- **删除**：条件写 `version = :expectedVersion`；硬删除（DeleteCommand）；冲突 → ConflictError。提醒没有软删除，没有 `deletedAt`。
- **任务重复互斥**：创建/更新时若 task.recurrence != "none" 且 reminder.recurrence != "none" → ValidationError。

### 裁定 7：SST 路由

```ts
// 在 tasks 路由之前注册
api.route("GET /api/tasks/{taskId}/reminders", reminderHandler, listAuth);
api.route("POST /api/tasks/{taskId}/reminders", reminderHandler, listAuth);
api.route("PATCH /api/tasks/{taskId}/reminders/{id}", reminderHandler, listAuth);
api.route("DELETE /api/tasks/{taskId}/reminders/{id}", reminderHandler, listAuth);
api.route("POST /api/reminders/process-due", reminderHandler, listAuth);
```

权限：`dynamodb:GetItem`、`dynamodb:PutItem`、`dynamodb:UpdateItem`、`dynamodb:DeleteItem`、`dynamodb:TransactWriteItems`、`dynamodb:Query`。

---

## Agent Brief

> 执行顺序：Schema（无需改动）→ DB 层测试 → DB 层实现 → Handler 层测试 → Handler 层实现 → SST 配置 → Bruno → 全量验证。

### 实现指令

1. **检查 shared schema** → `packages/shared/src/schema/reminders/` 已满足需求（`ReminderInput`、`ReminderUpdate`、`Reminder`），无需修改。确认 `reminderUpdateSchema` 为 `reminderBaseSchema.partial()`。
2. **DB 层**（`apps/api/src/reminders/db.ts`）：
   - `createReminder(taskId, input, userId, now)` → GetCommand 读 task 确认存在且未删除；校验互斥 recurrence；生成 UUID、version=1、审计字段；PutCommand 写入 REMINDER + GSI1 记录。
   - `getRemindersByTask(taskId, limit?, cursor?)` → Query GSI1 `PK = TASK#<taskId>#REMINDERS`，服务层循环填 limit，返回 `{ items, nextCursor? }`。
   - `getReminderById(id)` → GetCommand 直接读。
   - `updateReminder(id, input, expectedVersion, now, userId)` → 先读 task 做互斥校验（若 input 含 recurrence）；UpdateCommand 条件写 `version = :expectedVersion`。
   - `deleteReminder(id, expectedVersion)` → DeleteCommand 条件写 `version = :expectedVersion`。
   - `processDueReminders(now, limit?, cursor?)` → Scan `entityType = REMINDER` + 过滤 `isEnabled && triggerAt <= now`，最多 100 条。每条：读 task → 确定接收人 → 计算 nextTriggerAt → TransactWriteCommand（更新提醒 + 条件创建通知）。返回 `{ processedCount, nextCursor }`。
   - `createReminderNotificationId(reminderId, recipientId, triggerAt)` → UUID v5。
   - `advanceRecurrence(triggerAt, recurrence, timeZone)` → 纯函数，本地日历加法。
   - 事务失败处理：catch `TransactionCanceledException` → `console.error` + 继续下一条。
3. **Handler 层**（`apps/api/src/reminders/index.ts`）：
   - 轻量路由：`method + rawPath` 匹配 5 条路由。
   - 路径参数：`event.pathParameters.taskId`、`event.pathParameters.id`。
   - GET reminders 列表：`parseRequest` 取 `limit`/`cursor` query 参数。
   - POST/PATCH process-due：body 用 `reminderInputSchema`/`reminderUpdateSchema`/`void`。
   - 错误映射：ZodError → 400、NotFoundError → 404、ConflictError → 409、ValidationError → 400。
4. **SST**：`sst.config.ts` 添加 `reminderHandler` + 5 条路由 + DynamoDB 权限。
5. **Bruno**：`bruno/lyco-list/reminders/` 下 5 个文件（create、list、update、delete、process-due）。
6. **测试**：DB 测试 + Handler 测试，各 100% 覆盖率。process-due 测试固定 `Date.now()` 和时区，覆盖所有 recurrence 类型推进、月末/闰年、接收人确定、事务失败重试。

### 边界

- 提醒不校验 `triggerAt` 是否在未来（允许创建过去的提醒）。
- process-due 不调用 Cognito，不验证接收人是否存在。
- DELETE 是硬删除，无软删除、无 `DELETION_JOB`。
- process-due 单条提醒失败不影响其他提醒。
- 不与 reminders/02（前台轮询）或 notifications/01（通知查询）交互——仅创建 NOTIFICATION 记录。

### 验证

- `bun run test` exit 0，覆盖率 100%
- `bun run typecheck` 通过（`tsc --build --noEmit`，因 tsgo 未安装）
- `bunx @biomejs/biome check` 通过
