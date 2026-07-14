# LyCo-list 待办应用设计文档（AWS Serverless 共享版）

## 目标

构建一个功能对标 Apple Reminders 的 Web App / PWA 待办应用，采用前后端分离架构。前端是可安装的 PWA；后端采用完全托管在 AWS 上的 Serverless 架构。MVP 阶段先实现核心功能，离线写入与多端同步放到后续阶段。

**关键场景变更**：本项目不是传统多用户隔离的待办应用，而是**家庭/小团队共享待办**。所有登录用户共享同一组列表和任务，Cognito 仅用于身份识别，不做数据隔离。

## 项目结构

```
LyCo-list/
├── apps/
│   ├── web/                # React PWA 前端（Vite + React + TS + Tailwind v4 + shadcn/ui）
│   └── api/                # Lambda 函数
│       ├── functions/
│       │   ├── health/     # 占位 health Lambda（ticket 001）
│       │   ├── lists/      # lists 域 Lambda：内部路由 GET/POST/PATCH/DELETE
│       │   ├── tasks/      # tasks 域 Lambda：含子任务、完成、移动、assign 等
│       │   ├── reminders/  # reminders 域 Lambda
│       │   ├── search/     # search 域 Lambda
│       │   ├── users/      # users 域 Lambda：返回可选 assignee 列表
│       │   ├── notifications/ # notifications 域 Lambda：分配与提醒通知
│       │   └── cleanup/    # cleanup Lambda：延迟清理软删除数据
├── packages/
│   └── shared/             # 类型、Zod schema、DynamoDB 访问工具、响应包装（ticket 001 初始化 buildResponse）
├── sst.config.ts           # SST 根配置（ticket 001 初始化 ApiGatewayV2 + StaticSite）
├── bruno/                  # API 测试集合（ticket 001 初始化 health 请求，后续带 Cognito token）
└── ...
```

## 技术栈

### 前端

| 层级       | 工具                                                |
| ---------- | --------------------------------------------------- |
| 包管理器   | Bun                                                 |
| 代码规范   | Biome（替代 ESLint + Prettier）                     |
| 类型检查   | tsc / tsgo                                          |
| 测试       | Vitest（覆盖率目标 100%）                           |
| 构建工具   | Vite                                                |
| 框架       | React + TypeScript                                  |
| 路由       | TanStack Router                                     |
| 数据获取   | TanStack Query                                      |
| 客户端状态 | TanStack Store                                      |
| 表单       | TanStack Form                                       |
| 样式       | Tailwind CSS                                        |
| 基础组件   | shadcn/ui                                           |
| PWA        | vite-plugin-pwa                                     |
| 通知       | Service Worker + Notification API                   |
| 图标       | Lucide React                                        |
| 认证       | AWS Amplify Auth 模块（MVP 先用 Cognito Hosted UI） |
| API 调用   | fetch                                               |
| 工具库     | date-fns, @date-fns/tz, uuid                        |

### 后端

| 层级     | 工具                                                             |
| -------- | ---------------------------------------------------------------- |
| 包管理器 | Bun                                                              |
| 代码规范 | Biome                                                            |
| 类型检查 | tsc / tsgo                                                       |
| 测试     | Vitest（覆盖率目标 100%）                                        |
| 网关     | API Gateway HTTP API v2                                          |
| 授权     | Cognito User Pool + JWT 授权器                                   |
| 计算     | AWS Lambda (Node.js 24, TypeScript)                              |
| 框架     | 无，原生 Lambda handler                                          |
| 校验     | Zod                                                              |
| 数据库   | Amazon DynamoDB（单表设计）                                      |
| 延迟清理 | `sst.aws.CronV2`（Amazon EventBridge Scheduler）+ cleanup Lambda |
| 共享代码 | `packages/shared`（每个 Lambda 独立打包）                        |
| 部署     | SST v3                                                           |

### 基础设施

| 资源     | 服务                    |
| -------- | ----------------------- |
| 前端托管 | S3 + CloudFront         |
| API 入口 | API Gateway HTTP API    |
| 认证     | Cognito User Pool       |
| 数据库   | DynamoDB                |
| DNS      | Route 53                |
| SSL/TLS  | AWS Certificate Manager |
| 部署工具 | SST v3                  |

## 范围

### MVP（Phase 1）包含

- **前端**：React SPA，支持 PWA、系统深色模式、中文界面。
- **后端**：AWS Serverless（API Gateway + Lambda + DynamoDB + Cognito）。
- **任务**：创建、编辑、删除、完成、优先级、旗标、截止日期、提醒。
- **Assign 任务**：一个任务可以 assign 给多个用户；任务完成状态为整体状态；创建任务时即可选择 assignee。
- **分配通知**：被 assign 时通过浏览器通知告知被分配者；用户查看后标记已读。
- **无级嵌套子任务**：子任务与父任务功能对等；父任务完成时提示是否一键完成子任务。
- **自定义列表**：名称、颜色、图标、手动排序。
- **智能列表**：今天、计划、全部、已标记、已完成、**分配给我**。
- **搜索**：基于标题和备注的 Unicode 规范化、大小写不敏感包含匹配（后端实现）。
- **重复任务与提醒**：无、每天、每周、每两周、每月、每年、工作日。
- **PWA 可安装**：manifest、Service Worker、离线静态资源缓存。
- **浏览器通知**：PWA 安装并授权后，在应用启动、恢复前台或页面可见期间尽力而为地触发提醒通知和分配通知。
- **Bruno API 集合**：开发阶段手动测试 API 的复用请求集合。
- **共享数据**：所有登录用户共享同一组列表和任务，Cognito 仅用于识别操作者。

### MVP 不包含

- 自建登录 UI（MVP 使用 Cognito Hosted UI，后续尽快切换）。
- 离线数据写入与多端同步（Phase 3）。
- 导入/导出功能（从 MVP 中完全移除）。
- 共享列表中的权限差异（MVP 所有人完全读写）。
- 位置提醒。
- 附件/图片。
- 自然语言输入。
- Siri / Shortcuts 集成。
- 账号删除功能。
- DynamoDB Point-in-time Recovery（PITR）。
- 应用完全关闭后的可靠后台通知（Phase 2 使用 Web Push + EventBridge Scheduler）。

## 架构概览

```
用户设备
  │
  ▼
CloudFront（自定义域名 app.example.com）
  │
  ▼
S3（React SPA 构建产物）
  │
  │ API 请求：api.example.com
  ▼
API Gateway HTTP API（v2）
  │
  ├─ Cognito JWT 授权器
  ▼
Lambda（按资源域拆分：lists、tasks、reminders、search、users、notifications、cleanup）
  │
  ▼
DynamoDB（单表，所有用户共享数据）

EventBridge Scheduler（每 5 分钟）
  │
  ▼
cleanup Lambda ───────────────► DynamoDB
```

### 前端数据流

1. UI 组件从 TanStack Query 缓存中读取数据。
2. TanStack Query 的 `queryFn` 调用 `apiClient`，由 `apiClient` 向 API Gateway 发起请求。
3. Mutations 发送 HTTP 请求到后端，并失效相关 Query 缓存。
4. TanStack Store 保存临时 UI 状态：搜索关键词、当前弹窗、选中的任务。
5. 页面启动、恢复前台及保持可见期间轮询到期提醒和未读通知，再通过 Service Worker 展示系统通知。

### 后端数据流

1. API Gateway 接收 HTTP 请求，Cognito JWT 授权器验证 token，未携带或无效 token 返回 `401`。
2. Lambda 从 `event.requestContext.authorizer.jwt.claims.sub` 获取用户身份，仅用于日志/审计/assign 通知，不做数据隔离。
3. Lambda 内部根据 `event.requestContext.http.method` 和 `event.rawPath` 做轻量级路由分发。
4. Zod 校验请求体与查询参数。
5. DynamoDB 执行读写操作。
6. Lambda 通过 `packages/shared` 的 `buildResponse` 统一返回 JSON 响应。

### Monorepo 与代码规范

- 使用 Bun workspace 管理 `apps/web`、`apps/api` 和 `packages/shared` 的依赖。
- 根目录 `biome.json` 统一配置格式化与校验规则，覆盖所有子包。
- 开发阶段使用 `bunx @biomejs/biome check` 做代码检查；CI 阶段使用 `bunx @biomejs/biome ci`。
- 类型检查优先使用 `tsgo`；若 `tsgo` 尚未兼容项目则回退到 `tsc --noEmit`。
- 前后端共享 `packages/shared` 的类型与校验 schema。
- 前端样式使用 Tailwind CSS v4（CSS-first 配置），组件库使用 shadcn/ui，ticket 001 完成初始化。
- **Vitest 配置**：根目录 `vitest.config.ts` 使用 `test.projects` 聚合 `apps/*/vitest.config.ts` 与 `packages/*/vitest.config.ts`，不再使用已弃用的 `vitest.workspace.ts`。子包 `vitest.config.ts` 独立配置，根配置统一设置 `coverage.all: false` 并排除 `.sst/`、`node_modules/`、配置文件等，防止 SST 平台文件污染覆盖率报告。
- **测试命令**：本地与 CI 统一使用 `bun run test` 执行 Vitest（即 `vitest run --coverage --passWithNoTests`），直接使用 `bun test` 会启动 Bun 原生测试运行器，不加载 `jsdom` 且无法读取 `vitest.config.ts`。
- **CI 工具链**：`oven-sh/setup-bun` 固定为 `v2.2.0`（Node 24 runtime），避免 GitHub Actions 的 Node 20 弃用警告。

### 项目管理流程

- Issue 使用 GitHub Issues 创建和维护，GitHub Projects 作为状态看板。
- Issue 应包含背景、范围、验收标准、测试要求和关联设计章节。
- 复杂 Issue 的实施计划存放在 `.lychee/artifacts/plans/`，计划文件与对应 GitHub Issue 互相链接。
- 当 Issue 或计划与本文档冲突时，以本文档为准；设计变更需要同步更新相关 Issue、README 和 AGENTS.md。

### PWA 策略

- 使用 `vite-plugin-pwa` 生成 `manifest.json` 和 Service Worker。
- 静态资源缓存，支持离线访问应用壳。
- 应用数据保存在后端 DynamoDB 中，前端通过 TanStack Query 缓存。
- MVP 不保证离线写入能力；离线时应用只读展示缓存数据。
- Service Worker 不承担定时唤醒职责。页面启动、恢复前台时立即检查通知，页面可见期间每 5 分钟轮询一次。
- 应用完全关闭后不保证提醒送达；可靠后台通知属于 Phase 2。

### 域名与证书

- 域名托管在 Amazon Route 53。
- SSL/TLS 证书由 AWS Certificate Manager 管理。
- 前端自定义域名：`app.example.com`，CNAME 指向 CloudFront 分配。
- API 自定义域名：`api.example.com`，CNAME 指向 API Gateway 自定义域名。
- Cognito Hosted UI 自定义域名：`auth.example.com`（MVP 建议使用）。
- **域名需要先行购买并迁移到 Route 53**，这是部署前的外部依赖。

### API 限流

- API Gateway HTTP API 配置限流：每秒 100 请求、突发 200 请求。
- MVP 不配 WAF。

## 认证

### MVP：Cognito Hosted UI

1. 用户点击登录/注册，前端跳转至 Cognito Hosted UI（`auth.example.com`）。
2. 登录成功后，Cognito 通过回调 URL 重定向回前端，URL 中包含 authorization code。
3. 前端用 code 换取 Access Token、ID Token、Refresh Token。
4. 后续 API 请求在 `Authorization` header 中携带 `Bearer <Access Token>`。
5. API Gateway JWT 授权器验证 token；未携带或无效 token 的请求直接返回 `401`。
6. Lambda 从 `event.requestContext.authorizer.jwt.claims.sub` 获取用户身份，仅用于识别/审计/assign，不用于数据隔离。

### 用户注册控制

- **Cognito User Pool 关闭公开注册**。
- 管理员通过 Cognito 控制台手动创建家庭成员/团队成员账号。
- 新用户登录后自动看到共享的列表和任务数据。

### Phase 2：自建登录 UI

- 使用 AWS Amplify Auth 模块调用 Cognito 的 `signIn` / `signUp` / `confirmSignUp` / `forgotPassword` API。
- 用户池本身不变，仅前端调用方式改变。
- 需要更新 Cognito User Pool Client 的 `Allowed OAuth Flows` 和回调 URL 配置。

## 数据模型：DynamoDB 单表

### 表名

`LycoTable`

### 通用字段

| 字段         | 说明                                                       |
| ------------ | ---------------------------------------------------------- |
| `PK`         | 分区键                                                     |
| `SK`         | 排序键                                                     |
| `GSI1PK`     | 全局二级索引 1 分区键                                      |
| `GSI1SK`     | 全局二级索引 1 排序键                                      |
| `entityType` | `LIST`, `TASK`, `REMINDER`, `NOTIFICATION`, `DELETION_JOB` |
| `createdBy`  | 创建者 Cognito `sub`（UUID），前端不展示，仅用于审计       |
| `updatedBy`  | 最后修改者 Cognito `sub`（UUID），前端不展示，仅用于审计   |
| `version`    | 乐观并发版本号；每次业务更新递增                           |

### 实体键设计

#### 列表（LIST）

| 字段   | 值                               |
| ------ | -------------------------------- |
| PK     | `LIST#<listId>`                  |
| SK     | `METADATA`                       |
| GSI1PK | `LISTS`                          |
| GSI1SK | `ORDER#<orderKey>#LIST#<listId>` |

属性：`name`, `color`, `icon`, `order`, `version`, `deletedAt`, `undoUntil`, `deletionVersion`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`。

#### 任务（TASK）

| 字段   | 值                              |
| ------ | ------------------------------- | ------------------------------------- |
| PK     | `TASK#<taskId>`                 |
| SK     | `METADATA`                      |
| GSI1PK | `TASKS`                         |
| GSI1SK | `LIST#<listId>#PARENT#<parentId | ROOT>#ORDER#<orderKey>#TASK#<taskId>` |

属性：`title`, `notes`, `listId`, `parentId`, `assigneeIds`, `isCompleted`, `isFlagged`, `priority`, `dueDate`, `dueTime`, `timeZone`, `recurrence`, `completedAt`, `lastCompletedAt`, `order`, `version`, `deletedAt`, `undoUntil`, `deletionVersion`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`。

- `assigneeIds` 是 Cognito `sub` 数组，表示任务分配给了哪些用户。多 assignee，但任务完成状态为整体状态。
- 未分配任务：`assigneeIds = []`。
- 未分配任务对所有人可见。

#### 子任务

子任务与顶层任务使用完全相同的实体和主键格式，只通过 `parentId` 表达层级关系。任意层级任务都可通过 `PK = TASK#<taskId>, SK = METADATA` 直接读取；查询直接子任务时，先读取父任务获得 `listId`，再查询 GSI1 的 `LIST#<listId>#PARENT#<parentId>#` 前缀。

#### 提醒（REMINDER）

| 字段   | 值                                          |
| ------ | ------------------------------------------- |
| PK     | `REMINDER#<reminderId>`                     |
| SK     | `METADATA`                                  |
| GSI1PK | `TASK#<taskId>#REMINDERS`                   |
| GSI1SK | `TRIGGER#<triggerAt>#REMINDER#<reminderId>` |

属性：`taskId`, `triggerAt`, `recurrence`, `timeZone`, `isEnabled`, `version`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`。提醒是唯一持久化数据源，任务记录不嵌入提醒数组；任务详情响应按需组装提醒。

#### 通知（NOTIFICATION）

| 字段   | 值                              |
| ------ | ------------------------------- |
| PK     | `NOTIFICATION#<notificationId>` |
| SK     | `METADATA`                      |
| GSI1PK | `USER#<userSub>#NOTIFICATIONS`  |
| GSI1SK | `NOTIFICATION#<createdAt>`      |

属性：`type`, `recipientId`, `taskId`, `reminderId`, `taskTitle`, `message`, `isRead`, `readAt`, `createdAt`, `expiresAtEpoch`。

- `type`: `'assignment' | 'reminder'`。
- `recipientId`: 接收者 Cognito `sub`。
- 未读通知不设置 TTL；标记已读时写入数值型 Unix epoch 秒 `expiresAtEpoch = now + 7 天`。
- `expiresAtEpoch` 是 DynamoDB TTL 属性。TTL 仅保证过期后最终删除，查询时仍需过滤已过期记录。

#### 延迟删除任务（DELETION_JOB）

| 字段   | 值                            |
| ------ | ----------------------------- |
| PK     | `DELETION_JOB#<jobId>`        |
| SK     | `METADATA`                    |
| GSI1PK | `DELETION_JOBS`               |
| GSI1SK | `RUN#<undoUntil>#JOB#<jobId>` |

属性：`targetType`, `targetId`, `deletionVersion`, `undoUntil`, `status`, `cursor`, `createdAt`, `updatedAt`。cleanup Lambda 只处理超过撤销期限且删除版本仍匹配的任务。

### GSI 数量

MVP 只保留 **1 个 GSI（GSI1）**，覆盖以下访问模式：

- `LISTS` → 查询所有未删除列表并按手动顺序排列
- `TASKS` + `LIST#<listId>#` 前缀 → 查询该列表下的全部任务
- `TASKS` + `LIST#<listId>#PARENT#<parentId>#` 前缀 → 查询某任务的直接子任务
- `TASK#<taskId>#REMINDERS` → 查询某任务的所有提醒
- `USER#<userSub>#NOTIFICATIONS` → 查询某用户的未读通知
- `DELETION_JOBS` → 查询到达清理时间的删除任务

智能列表（今天、计划、全部、已标记、已完成、分配给我等）在 Lambda 内过滤。理由：

- 项目数据量极小，过滤成本可忽略。
- GSI 过多会增加写放大和架构复杂度。
- 未来如某个查询成为瓶颈，可再增加 GSI。

### 主要查询模式

| 场景                          | 查询方式                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| 按 ID 读取列表/任务/提醒/通知 | 使用实体自身 `PK` + `SK = METADATA`                                                                |
| 所有列表                      | `GSI1 PK = LISTS`                                                                                  |
| 所有任务                      | `GSI1 PK = TASKS`                                                                                  |
| 某列表下任务                  | `GSI1 PK = TASKS, SK begins_with LIST#<listId>#`                                                   |
| 某任务子任务                  | `GSI1 PK = TASKS, SK begins_with LIST#<listId>#PARENT#<parentId>#`                                 |
| 某任务所有提醒                | `GSI1 PK = TASK#<taskId>#REMINDERS`                                                                |
| 逾期提醒                      | 小数据量下扫描 `REMINDER` 实体并过滤 `isEnabled` 与 `triggerAt <= now`；超过规模阈值后新增到期索引 |
| 某用户未读通知                | `GSI1 PK = USER#<userSub>#NOTIFICATIONS, 过滤 isRead = false`                                      |
| 待清理删除任务                | `GSI1 PK = DELETION_JOBS, SK BETWEEN RUN# AND RUN#<now>#\uffff`                                    |

所有 Query/Scan 必须处理 DynamoDB 1 MB 分页，通过不透明 cursor 暴露给 API 调用方。软删除或 TTL 已过期实体必须在服务层过滤。

### 共享类型定义（`packages/shared`）

`packages/shared` 提供前端与 Lambda 共享的 Zod schema 和 TypeScript 类型。绝对时间点使用 ISO 8601 UTC；`dueDate` / `dueTime` 保留本地日历语义，并与 IANA `timeZone` 组合解释：

```typescript
type RecurrenceRule =
  | "none"
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "yearly"
  | "weekdays";

interface List {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  version: number;
  deletedAt?: string;
  undoUntil?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string; // Cognito sub (UUID)
  updatedBy: string; // Cognito sub (UUID)
}

interface User {
  id: string; // Cognito sub
  name: string;
}

interface Reminder {
  id: string;
  taskId: string;
  triggerAt: string; // ISO 8601 UTC
  recurrence: RecurrenceRule;
  timeZone: string; // IANA 时区，例如 Asia/Shanghai
  isEnabled: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

interface Task {
  id: string;
  title: string;
  notes: string;
  listId: string;
  parentId: string | null;
  assigneeIds: string[]; // Cognito sub 数组
  isCompleted: boolean;
  isFlagged: boolean;
  priority: "none" | "low" | "medium" | "high";
  dueDate?: string; // 本地日历日期 YYYY-MM-DD
  dueTime?: string; // 本地时间 HH:mm
  timeZone?: string; // 设置截止时间或重复规则时必填
  recurrence: RecurrenceRule;
  completedAt: string | null;
  lastCompletedAt: string | null;
  order: number;
  version: number;
  deletedAt?: string;
  undoUntil?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

interface Notification {
  id: string;
  type: "assignment" | "reminder";
  recipientId: string;
  taskId: string;
  reminderId?: string;
  taskTitle: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  expiresAtEpoch?: number; // DynamoDB TTL，Unix epoch 秒
}
```

### 设计规则

- 子任务是独立的一等任务，可以拥有独立的提醒、截止日期、优先级、旗标和 assignee。
- 智能列表根据任务自身属性聚合，包括子任务。
- 父任务完成时，应用提示："是否同时完成所有子任务？"，提供"是"和"否"选项。
- 列表拥有显示顺序，用于手动排序；排序使用浮点数 `order` 字段，避免批量重排。
- 任务拥有同级顺序，嵌套排序按父任务分别处理；同样使用浮点数 `order`。
- 插入或移动前先计算新的 `orderKey`；如果固定精度格式化后与相邻键重复，只对当前列表或当前父任务下的同级项目按 `1024` 的固定步长重新编号。
- `orderKey` 由非负 `order` 格式化为固定宽度、9 位小数的字符串，保证 DynamoDB 字符串排序与数值排序一致；共享 schema 同时校验非负值、有限值和上限。
- **Assign 规则**：
  - 一个任务可以 assign 给多个用户（`assigneeIds: string[]`）。
  - 任务完成状态为整体状态：任意一个用户标记完成后，整个任务完成。
  - 未分配任务对所有人可见。
  - 任务完成后保留 `assigneeIds` 记录。
  - 创建任务时即可选择 assignee。
  - MVP 每个任务最多 20 个 assignee，由共享 Zod schema 强制限制。
- **分配通知**：
  - 当任务 `assigneeIds` 新增用户时，任务更新与通知创建通过同一个 `TransactWriteItems` 提交。
  - 通知 ID 由 `taskId + recipientId + taskVersion` 确定，并用条件写保证重试不重复。
  - 页面启动、恢复前台时立即拉取通知；页面可见期间每 5 分钟轮询 `/api/notifications/pending`。
  - 用户查看通知后调用 `/api/notifications/:id/read` 标记已读。
  - 标记已读时写入 `readAt` 和数值型 `expiresAtEpoch`；TTL 过期记录在查询层过滤，物理删除时间不作保证。
- **提醒接收人**：任务有 assignee 时通知全部 assignee；未分配任务只通知提醒创建者。
- **时区**：`dueDate` 是 `YYYY-MM-DD` 本地日历日期，`dueTime` 是 `HH:mm` 本地时间，`timeZone` 使用 IANA 名称；计算后的 `triggerAt`、审计时间和完成时间使用 ISO 8601 UTC。"今天"按查看者本地日期边界计算。
- **删除父任务**：非空父任务禁止删除，子任务必须先移除或移动；后端通过应用层约束强制执行。
- **删除与撤销**：任务和列表先写入 `deletedAt`、`undoUntil = deletedAt + 30 秒`、`deletionVersion` 并创建 `DELETION_JOB`。读取接口立即隐藏软删除数据；撤销接口在期限内恢复，超过期限返回 `410 GONE`；cleanup Lambda 在期限后分页清理关联任务、提醒和通知，并重试 `UnprocessedItems`。
- **删除列表**：删除列表需要二次确认；列表进入软删除状态后，其全部任务立即从所有查询隐藏，随后由 cleanup Lambda 级联清理。
- **移动父任务**：父任务移动到另一个列表时，所有后代子任务自动跟随。
- **重复任务完成**：非重复任务设置 `isCompleted = true` 和 `completedAt`；重复任务写入 `lastCompletedAt`、保持未完成，并按其 IANA 时区使用本地日历规则推进截止日期与提醒，避免夏令时漂移。
- **重复规则互斥**：任务设置 `recurrence != 'none'` 时，其提醒的 `recurrence` 必须为 `none`，提醒随任务一起推进；只有非重复任务的提醒可以设置独立重复规则。共享 Zod schema 强制该约束，避免同一提醒被双重推进。
- **完成状态**：重新打开非重复任务时设置 `isCompleted = false` 并清空 `completedAt`；任务重复规则非 `none` 时必须存在 `dueDate`。
- **并发编辑**：更新、移动、完成、删除和恢复请求必须携带 `expectedVersion`；条件写失败返回 `409 CONFLICT`，客户端刷新后让用户重试。
- **审计字段**：`createdBy` / `updatedBy` 记录用户 Cognito `sub`，但 MVP 不展示用户身份。

## REST API 概览

### 接口粒度

按资源域拆分 Lambda。每个资源域一个 Lambda 函数，函数内部根据 `event.requestContext.http.method` 和 `event.rawPath` 做轻量级路由分发。API Gateway 负责把同域下所有路径和方法路由到同一个 Lambda，并处理 CORS 和 JWT 授权。

例如 `lists` Lambda 处理：

| 方法   | 路径              |
| ------ | ----------------- |
| GET    | `/api/lists`      |
| POST   | `/api/lists`      |
| PATCH  | `/api/lists/{id}` |
| DELETE | `/api/lists/{id}` |

### 接口列表

| 方法   | 路径                                 | 所属 Lambda     |
| ------ | ------------------------------------ | --------------- |
| GET    | `/api/health`                        | `health`        |
| GET    | `/api/lists`                         | `lists`         |
| POST   | `/api/lists`                         | `lists`         |
| PATCH  | `/api/lists/{id}`                    | `lists`         |
| DELETE | `/api/lists/{id}`                    | `lists`         |
| POST   | `/api/lists/{id}/restore`            | `lists`         |
| GET    | `/api/tasks`                         | `tasks`         |
| POST   | `/api/tasks`                         | `tasks`         |
| GET    | `/api/tasks/{id}`                    | `tasks`         |
| PATCH  | `/api/tasks/{id}`                    | `tasks`         |
| DELETE | `/api/tasks/{id}`                    | `tasks`         |
| POST   | `/api/tasks/{id}/complete`           | `tasks`         |
| POST   | `/api/tasks/{id}/move`               | `tasks`         |
| POST   | `/api/tasks/{id}/restore`            | `tasks`         |
| GET    | `/api/tasks/{taskId}/reminders`      | `reminders`     |
| POST   | `/api/tasks/{taskId}/reminders`      | `reminders`     |
| PATCH  | `/api/tasks/{taskId}/reminders/{id}` | `reminders`     |
| DELETE | `/api/tasks/{taskId}/reminders/{id}` | `reminders`     |
| POST   | `/api/reminders/process-due`         | `reminders`     |
| GET    | `/api/users`                         | `users`         |
| GET    | `/api/notifications/pending`         | `notifications` |
| POST   | `/api/notifications/{id}/read`       | `notifications` |
| POST   | `/api/notifications/read-all`        | `notifications` |
| GET    | `/api/search`                        | `search`        |

### 请求与响应

- 请求体验证：每个 Lambda 内部使用 `packages/shared` 提供的 Zod schema 校验。
- 响应格式：统一通过 `packages/shared` 的 `buildResponse` 工具返回 JSON，包含 `statusCode`、`headers` 和 `body`。
- 错误处理：每个 Lambda 内部 try/catch，返回统一错误体 `{ error: string, code?: string }`。
- 所有集合接口接受 `limit`（默认 50、最大 100）和不透明 `cursor`，响应为 `{ items, nextCursor? }`；cursor 封装 DynamoDB `LastEvaluatedKey`，客户端不得解析。
- 所有修改已有实体的请求携带 `expectedVersion`；版本不匹配返回 `409` 和 `{ error, code: 'CONFLICT' }`。
- 通知读取与标记已读必须校验 `recipientId` 等于当前 Cognito `sub`，共享数据规则不适用于个人通知。

### 提醒处理与幂等

1. 页面调用 `POST /api/reminders/process-due`，后端扫描到期且启用的提醒。
2. 后端读取关联任务：有 assignee 时以 assignee 为接收人，否则以提醒创建者为接收人。
3. 对每条到期提醒使用 `triggerAt + version` 条件写，在同一个事务中创建确定性 ID 的接收人通知，并推进重复提醒或禁用单次提醒。
4. 并发处理只有一个事务能成功；重复调用返回成功但不会重复创建通知。
5. `process-due` 每次最多处理 100 条并返回 `nextCursor`；页面跟随 cursor 直到处理完成，再查询 `/api/notifications/pending`。处理单条提醒失败不影响其他提醒，并记录结构化日志供重试。

### 用户列表

- `/api/users` 的 Lambda 使用 `cognito-idp:ListUsers` 最小 IAM 权限访问指定 User Pool。
- Lambda 跟随 `PaginationToken` 读取到 API `limit` 已填满或 Cognito 结果耗尽，并把剩余 `PaginationToken` 包装为不透明 `nextCursor`；只返回 `{ id: sub, name }`，显示名称依次取 `name`、`preferred_username`、`email`。

### 401 / Token 过期处理

- 前端通过 Amplify 自动刷新 Access Token。
- 当 API 返回 `401` 时，前端尝试静默刷新；刷新失败则清除本地 session 并重定向到 Cognito Hosted UI 登录页。
- 登录成功后回到原页面。

### 前端 API 调用

使用原生 fetch 封装一个 `apiClient`：

- 每次请求前调用 Amplify Auth 获取最新 Access Token。
- 自动注入 `Authorization: Bearer <token>` header。
- 统一解析 JSON、处理 401/403/500 错误。
- 支持本地开发和生产环境的不同 API base URL。

TanStack Query 的 `queryFn` 直接使用 `apiClient('/lists')` 等。

```ts
const apiClient = async (path: string, options?: RequestInit) => {
  const session = await fetchAuthSession();
  const token = session.tokens?.accessToken?.toString();
  return fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
};
```

## 智能列表定义

| 列表     | 过滤条件                                                   | 排序                         |
| -------- | ---------------------------------------------------------- | ---------------------------- |
| 今天     | `dueDate` 为今天且 `isCompleted === false`                 | 最早到期时间优先，其次优先级 |
| 计划     | `dueDate` 存在且 `isCompleted === false`                   | 截止日期升序                 |
| 全部     | `isCompleted === false`                                    | 创建时间降序                 |
| 已标记   | `isFlagged === true` 且 `isCompleted === false`            | 优先级优先，其次截止日期     |
| 已完成   | `isCompleted === true`                                     | 完成时间降序                 |
| 分配给我 | 当前用户 sub 在 `assigneeIds` 中且 `isCompleted === false` | 创建时间降序                 |

自定义列表使用手动拖拽排序。默认视图是"今天"智能列表。

## 通知与提醒行为

### 提醒通知

- Web 通知是尽力而为。由于 PWA 后台定时器受操作系统和浏览器限制，不保证毫秒级精确触发。
- 应用启动、恢复前台时立即调用 `/api/reminders/process-due`；页面可见期间由页面定时器每 **5 分钟**调用一次，随后拉取 `/api/notifications/pending`。
- Service Worker 只负责静态缓存和展示由页面触发的系统通知，不依赖自身定时器或 Periodic Background Sync。
- 应用完全关闭后，MVP 不保证通知送达；再次打开应用时补处理所有到期提醒。
- 后端用条件事务创建每个接收人的提醒通知，并计算重复提醒的下一次触发时间。
- 重复规则使用 `date-fns` 的 add 助手函数：
  - `daily` -> `addDays(..., 1)`
  - `weekly` -> `addWeeks(..., 1)`
  - `biweekly` -> `addWeeks(..., 2)`
  - `monthly` -> `addMonths(..., 1)`
  - `yearly` -> `addYears(..., 1)`
  - `weekdays` -> 下一个周一到周五的日期
- 计算时通过 `@date-fns/tz` 在提醒的 IANA 时区内保持本地日历时间，再转换为 UTC `triggerAt`。

### 分配通知

- 当任务 `assigneeIds` 新增用户时，后端在更新任务的同一事务中创建幂等 `NOTIFICATION` 记录。
- 页面复用前台 **5 分钟轮询**获取 `/api/notifications/pending`。
- 本地通知标题示例："【LyCo】你有一个新任务：买牛奶"。
- 用户点击通知或打开"通知中心"/"分配给我"列表后，前端调用 `/api/notifications/:id/read` 或 `/api/notifications/read-all` 标记已读。
- 已读通知设置 `expiresAtEpoch = readAt + 7 天`；查询立即过滤过期记录，DynamoDB TTL 负责最终物理删除。

### 通知权限

- 用户首次登录或创建第一个带提醒/assign 的任务时，前端请求浏览器通知权限。
- 用户拒绝后，提醒和分配通知降级为应用内徽章和列表展示。

### 未来阶段

- Phase 2 使用 **Amazon EventBridge Scheduler** 在提醒时间触发 Lambda，并通过标准 **Web Push** 向已登记的浏览器订阅发送通知。
- Web Push 订阅失效时自动删除订阅记录；密钥通过 SST Secret 管理。
- 该方案不依赖 PWA 定时唤醒，支持应用关闭后的可靠通知。

## 搜索

- MVP 搜索由后端 API 驱动，对 `Task.title` 和 `Task.notes` 做 Unicode NFC 规范化与大小写不敏感的包含匹配，不承诺分词、相关度排名或语言学意义上的全文检索。
- 默认按最近更新时间降序返回结果。
- MVP 阶段搜索是全局的，不按当前列表过滤。
- 搜索扫描所有未删除任务并在 Lambda 中过滤，使用 `limit` / `cursor` 分页；达到性能阈值后再引入专用搜索服务。

## Bruno API 集合

- 在仓库根目录 `bruno/` 下以 `.bru` 文件形式存储 API 请求。
- ticket 001 初始化 Bruno 集合，包含 `development` 和 `production` 环境，以及 `GET /api/health` 占位请求。
- 后续 ticket 逐步补充每个接口的对应请求，包含 create/update/assign 的示例请求体。
- 由于业务接口需要 Cognito JWT 授权，集合中需先执行登录步骤，将 Access Token 保存到集合变量中，后续请求自动注入 `Authorization: Bearer <token>`。
- Bruno 用于开发阶段手动 API 测试，以及团队内共享 API 示例。

## 前端 UI 结构

- **响应式导航**：桌面端使用固定左侧边栏；移动端使用顶部标题栏 + 汉堡抽屉。
- **侧边栏/导航**：智能列表 + 自定义列表 + "新建列表"按钮。
- **主面板**：列表标题、任务列表、顶部添加任务输入框。
- **任务详情抽屉/弹窗**：标题、备注、截止日期/时间、提醒、优先级、旗标、列表、子任务、**assignee 选择**。
- **搜索栏**：根据上下文过滤当前列表或全局搜索。
- **安装提示**：满足条件时显示 PWA 安装横幅/按钮。
- **语言**：MVP 仅中文。
- **主题**：支持系统深色模式。

## 部署与本地开发

### 前端部署

1. 使用 SST `StaticSite` 组件部署 React 应用。
2. 构建产物上传到 S3。
3. CloudFront 作为 CDN 和 HTTPS 入口，绑定 `app.example.com`。
4. 前端环境变量通过 SST `StaticSite` 的 `environment` 配置在构建时注入。
5. `VITE_API_URL` 直接引用 `api.url`；`VITE_USER_POOL_ID` 和 `VITE_USER_POOL_CLIENT_ID` 在 ticket 001 中使用 `sst.Secret` 占位（placeholder 值 `todo-in-ticket-002`），ticket 002 部署 Cognito 后替换为真实 ID。
6. Vite 通过 `import.meta.env` 读取 `VITE_API_URL`、`VITE_USER_POOL_ID`、`VITE_USER_POOL_CLIENT_ID` 等变量。

### 本地开发

- `sst dev` 启动 SST 开发环境，本地运行 Lambda 函数并连接真实 AWS 资源（ap-southeast-1）。
- 前端 `vite dev` 运行开发服务器，通过代理访问本地 API。
- Cognito 使用真实的用户池，开发阶段也关闭公开注册，由管理员手动创建测试账号。
- 使用 SST stage `dev`。

### 部署流程

1. 开发者提交代码。
2. CI 运行 `bunx @biomejs/biome ci`。
3. CI 运行 `bun run test`（Vitest）。
4. CI 运行 `tsc --noEmit` 或 `tsgo` 类型检查。
5. 生产部署 **手动触发** `sst deploy --stage prod`。
6. SST 创建/更新：CloudFront、S3、API Gateway、Lambda、DynamoDB、Cognito，以及基于 EventBridge Scheduler 的 `sst.aws.CronV2`。
7. 使用 SST stage `dev` 和 `prod`，不使用 `test` stage。

**CI 工具版本**：GitHub Actions 使用 `oven-sh/setup-bun@v2.2.0`（Node 24 runtime），替代浮动的 `v2` 标签，以避免 Node 20 弃用警告。

## 部署与运维

### 健康检查

- 实现 `/api/health` 接口，返回 DynamoDB 连通性状态。
- 用于部署验证和 CloudWatch 基本监控。

### 日志与监控

- Lambda 日志写入 CloudWatch Logs，保留期为 **7 天**。
- 配置 CloudWatch 告警状态（不发送通知），用于在控制台查看 Lambda/API 错误趋势。
- 不启用 AWS X-Ray。

### 延迟删除清理

- `sst.aws.CronV2` 通过 EventBridge Scheduler 每 5 分钟调用 cleanup Lambda。
- cleanup Lambda 查询已超过 `undoUntil` 的 `DELETION_JOB`，再次校验目标实体的 `deletionVersion`，再分页删除关联数据。
- `BatchWriteItem` 返回的 `UnprocessedItems` 必须使用指数退避重试；每批保存 cursor，使 Lambda 超时后可从断点继续。
- 清理完成后删除目标墓碑和 `DELETION_JOB`。撤销操作递增删除版本并取消任务，使旧清理执行安全失效。

### CORS

- `dev` stage：API Gateway CORS 允许所有 origin（便于本地开发）。
- `prod` stage：只允许完整 origin `https://app.example.com`。

### Schema 变更

- 未来需要添加 GSI 时，直接修改 SST 表配置并重新部署，由 DynamoDB 自动处理后台构建。
- 不采用蓝绿表迁移。

## 测试策略

| 层级         | 方式                                               |
| ------------ | -------------------------------------------------- |
| 单元测试     | Vitest，覆盖 Lambda handler 逻辑、Zod schema、共享 cursor 工具 |
| 集成测试     | Vitest + DynamoDB Local（Docker 或内存实例），用于 API 与数据库交互测试 |
| 覆盖率       | statements、branches、functions、lines 均达到 100% |
| API 手动测试 | Bruno 集合，需先获取 Cognito Access Token          |

### 测试注意事项

- 100% 覆盖率从 ticket 001（脚手架阶段）开始生效，占位代码（如 `buildResponse` 和 health handler）也需要编写测试并满足阈值。
- 共享包中的 Zod schema、cursor 工具等纯数据结构使用单元测试覆盖；DynamoDB Local 在后续 API ticket 的集成测试中引入。
- Lambda handler 与 API Gateway 事件结构解耦，便于单元测试。
- 集成测试通过 DynamoDB Local 模拟真实数据库行为，避免纯 mock 的虚假安全感。
- Cognito 认证在测试中通过模拟 token 或独立测试用户池处理。
- 由于数据共享，测试数据不需要按用户隔离，但需要注意并发测试的数据清理。
- 覆盖任意层级任务按 ID CRUD，以及 GSI 的列表、父子、提醒、通知和删除任务访问模式。
- Assign 和通知逻辑需要覆盖：任务与通知原子写入、重复 assign/重试不重复通知、接收人授权、标记已读。
- 重复任务与提醒覆盖跨月、闰年、工作日和 DST 边界；测试固定系统时间与 IANA 时区。
- 覆盖 `expectedVersion` 成功更新和 `409 CONFLICT`、删除/撤销、清理断点续传及 `UnprocessedItems` 重试。
- TTL 测试验证 `expiresAtEpoch` 为 Unix epoch 秒并验证查询层过滤，不等待 DynamoDB Local 或真实 DynamoDB 的异步物理删除。
- 覆盖集合分页 cursor、搜索跨页和 Cognito `ListUsers` 多页结果。

## 路线图

### Phase 1：Serverless MVP

1. 搭建 SST v3 项目结构：根目录 `sst.config.ts` 配置 `sst.aws.ApiGatewayV2`（含 `GET /api/health`）和 `sst.aws.StaticSite`；`apps/web` 初始化为 Vite + React + TypeScript + Tailwind CSS v4 + shadcn/ui；`apps/api` 添加占位 health Lambda；`packages/shared` 初始化 `buildResponse`；`bruno/` 初始化 health 请求；CI 工作流配置 Biome、类型检查、测试与 100% 覆盖率。
2. 配置 Cognito User Pool、User Pool Client、Hosted UI 自定义域名，关闭公开注册。
3. 定义可按实体 ID 直接读取的 DynamoDB 单表、1 个 GSI、TTL 和乐观版本字段。
4. 前端脚手架：React + Vite + TypeScript + Tailwind + shadcn/ui + TanStack Router/Query/Store/Form + Vitest。
5. 前端认证与 Cognito Hosted UI 回调处理：登录/登出状态、token 刷新、**401 重定向处理**。
6. 实现 `/api/health` 接口。
7. 实现 `/api/users` 接口（返回可选 assignee 列表）。
8. 实现 `lists` 接口、软删除/恢复与前端自定义列表 CRUD 页面（TDD）。
9. 实现统一 `tasks` 实体的无级子任务 CRUD、移动、完成和恢复（TDD）。
10. 实现 `tasks` 的乐观并发、`assigneeIds` 更新事务和幂等分配通知（TDD）。
11. 实现 `reminders` CRUD、`process-due` 与前端截止日期/重复提醒设置（TDD）。
12. 实现 `notifications` 接口：未读查询、接收人授权、标记已读和 TTL 字段（TDD）。
13. 实现前端智能列表（今天、计划、全部、已标记、已完成、**分配给我**）与搜索页面（TDD）。
14. 实现 `search` 接口与前端对应页面（TDD）。
15. 配置 PWA：manifest、Service Worker、安装提示。
16. 配置 CloudFront 和 API Gateway 自定义域名。
17. 实现页面启动/恢复前台/可见期间的提醒与通知轮询，Service Worker 只展示通知（TDD）。
18. 实现 `DELETION_JOB`、cleanup Lambda 与 `sst.aws.CronV2` 定时清理（TDD）。
19. 更新 Bruno 集合并覆盖所有接口、分页和冲突响应。

### Phase 2：体验打磨

- 自建登录 UI 替换 Cognito Hosted UI。
- 拖拽排序（列表内、列表间、层级间）。
- 批量操作：完成、移动、删除、标记、分配。
- 键盘快捷键。
- 空状态与引导。
- 动画与过渡。
- 导入/导出（如后续需要）。
- 账号删除与数据清理。
- 应用关闭后的可靠通知（EventBridge Scheduler + Web Push）。

### Phase 3：云端同步与离线

- 离线数据写入：IndexedDB 本地缓存 + 网络恢复后同步。
- 冲突处理策略。
- 实时同步（可选 API Gateway WebSocket）。
- 共享列表中的权限差异（只读与协作）。

### Phase 4：高级功能（按需）

- 自然语言输入解析。
- 位置提醒。
- 附件与图片（S3）。
- Siri Shortcuts / share target。
- PWA 小组件。

## 风险与注意事项

1. **Lambda 冷启动**：按资源域拆分后函数数量减少，但低频次访问仍可能遇到冷启动；可通过预置并发或保持调用缓解。
2. **DynamoDB 单表复杂度**：访问模式驱动设计，需要充分理解索引和键模式。
3. **Cognito 配置**：回调 URL、自定义域名、token 类型、授权器范围等容易出错。
4. **Hosted UI 在 PWA 中的体验**：移动端 PWA 跳转 Hosted UI 可能跳出应用，需 Phase 2 优化为自建 UI。
5. **成本**：DynamoDB 按读写收费，API Gateway 和 Lambda 按请求收费；对于小项目成本极低，但 GSI 过多会增加写放大。
6. **调试**：Lambda 日志分散在 CloudWatch，需要统一日志结构和查询方式。
7. **并发编辑**：乐观并发会产生 `409`，前端必须刷新数据并明确提示用户重试。
8. **数据共享风险**：所有用户完全读写，任何用户都可以删除所有数据。需要家庭/团队信任基础。
9. **账号删除**：MVP 不实现删除账号，Cognito 用户删除后 DynamoDB 数据仍会残留（但数据共享场景下影响较小）。
10. **提醒扫描成本**：MVP 通过 Scan 查找到期提醒，仅适用于小数据量；达到阈值后必须增加到期索引或调度器。
11. **通知限制**：MVP 仅在页面启动、恢复前台或保持可见时检查；应用完全关闭后不会主动唤醒。
12. **通知权限**：用户拒绝通知权限后，assign 功能仍可用但仅显示应用内徽章。
13. **延迟清理**：软删除数据在清理完成前仍占用存储，cleanup Lambda 必须支持重试和断点续传。

## 成功标准

- 前端可通过 `app.example.com` 访问，API 可通过 `api.example.com` 访问。
- 用户可通过 Cognito Hosted UI 登录，但只有管理员手动创建的用户才能登录。
- 所有接口返回正确 JSON，并在 Bruno 集合中有对应请求。
- 所有登录用户共享同一组列表和任务数据。
- 智能列表、搜索功能正常；新增"分配给我"智能列表。
- 任意层级任务都能仅凭任务 ID 正确读取、更新、移动、完成和删除。
- Assign 任务后，被分配者在应用启动、恢复前台或保持可见时收到浏览器通知（若授权），重试不产生重复通知。
- PWA 可安装；页面负责前台轮询，Service Worker 负责离线应用壳和展示通知，不承诺应用关闭后的通知。
- 重复任务和提醒在配置的 IANA 时区内正确跨越月末、闰年和 DST。
- 删除任务或列表后可在撤销期限内恢复，期限后关联数据由 cleanup Lambda 最终清理且不遗留提醒。
- 所有业务逻辑按 TDD 开发，Vitest 覆盖率达到 100%。
- CI 阻止未通过测试或覆盖率不达标的合并。

## 待解决决策

1. 域名购买与 Route 53 迁移：需要先行完成（由项目负责人自行处理）。
