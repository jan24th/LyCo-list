# LyCo-list 待办应用设计文档（AWS Serverless 共享版）

> 最后更新：2026-07-13（经 `grill-me` 评审后的决策版本）
>
> 本文档替代项目 README 中原有的 Hono + Prisma + SQLite 方案，成为当前实现权威。

## 目标

构建一个功能对标 Apple Reminders 的 Web App / PWA 待办应用，采用前后端分离架构。前端是可安装的 PWA；后端采用完全托管在 AWS 上的 Serverless 架构。MVP 阶段先实现核心功能，离线写入与多端同步放到后续阶段。

**关键场景变更**：本项目不是传统多用户隔离的待办应用，而是**家庭/小团队共享待办**。所有登录用户共享同一组列表和任务，Cognito 仅用于身份识别，不做数据隔离。

## 项目结构

```
LyCo-list/
├── apps/
│   ├── web/                # React PWA 前端
│   └── api/                # Lambda 函数 + SST 配置
│       ├── functions/
│       │   ├── lists/      # lists 域 Lambda：内部路由 GET/POST/PATCH/DELETE
│       │   ├── tasks/      # tasks 域 Lambda：含子任务、完成、移动、assign 等
│       │   ├── reminders/  # reminders 域 Lambda
│       │   ├── search/     # search 域 Lambda
│       │   ├── users/      # users 域 Lambda：返回可选 assignee 列表
│       │   ├── notifications/ # notifications 域 Lambda：分配通知
│       │   └── health/     # health 域 Lambda（可选，也可挂载在 lists Lambda）
│       └── sst.config.ts
├── packages/
│   └── shared/             # 类型、Zod schema、DynamoDB 访问工具、响应包装
├── sst.config.ts           # SST 根配置
├── bruno/                  # API 测试集合（需带 Cognito token）
└── ...
```

## 技术栈

### 前端

| 层级 | 工具 |
|---|---|
| 包管理器 | Bun |
| 代码规范 | Biome（替代 ESLint + Prettier） |
| 类型检查 | tsc / tsgo |
| 测试 | Vitest（覆盖率目标 100%） |
| 构建工具 | Vite |
| 框架 | React + TypeScript |
| 路由 | TanStack Router |
| 数据获取 | TanStack Query |
| 客户端状态 | TanStack Store |
| 表单 | TanStack Form |
| 样式 | Tailwind CSS |
| 基础组件 | shadcn/ui |
| PWA | vite-plugin-pwa |
| 通知 | Service Worker + Notification API |
| 图标 | Lucide React |
| 认证 | AWS Amplify Auth 模块（MVP 先用 Cognito Hosted UI） |
| API 调用 | fetch |
| 工具库 | date-fns, uuid |

### 后端

| 层级 | 工具 |
|---|---|
| 包管理器 | Bun |
| 代码规范 | Biome |
| 类型检查 | tsc / tsgo |
| 测试 | Vitest（覆盖率目标 100%） |
| 网关 | API Gateway HTTP API v2 |
| 授权 | Cognito User Pool + JWT 授权器 |
| 计算 | AWS Lambda (Node.js 20, TypeScript) |
| 框架 | 无，原生 Lambda handler |
| 校验 | Zod |
| 数据库 | Amazon DynamoDB（单表设计） |
| 共享代码 | `packages/shared`（每个 Lambda 独立打包） |
| 部署 | SST v3 |

### 基础设施

| 资源 | 服务 |
|---|---|
| 前端托管 | S3 + CloudFront |
| API 入口 | API Gateway HTTP API |
| 认证 | Cognito User Pool |
| 数据库 | DynamoDB |
| DNS | Route 53 |
| SSL/TLS | AWS Certificate Manager |
| 部署工具 | SST v3 |

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
- **搜索**：基于标题和备注的全文搜索（后端实现）。
- **重复提醒**：无、每天、每周、每两周、每月、每年、工作日。
- **PWA 可安装**：manifest、Service Worker、离线静态资源缓存。
- **浏览器通知**：PWA 安装并授权后，尽力而为地触发提醒通知和分配通知。
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
Lambda（按资源域拆分的函数：lists、tasks、reminders、search、users、notifications）
  │
  ▼
DynamoDB（单表，所有用户共享数据）
```

### 前端数据流

1. UI 组件从 TanStack Query 缓存中读取数据。
2. TanStack Query 的 `queryFn` 调用 `apiClient`，由 `apiClient` 向 API Gateway 发起请求。
3. Mutations 发送 HTTP 请求到后端，并失效相关 Query 缓存。
4. TanStack Store 保存临时 UI 状态：搜索关键词、当前弹窗、选中的任务。
5. Service Worker 获取即将到来的提醒和未读分配通知，触发本地通知。

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

### PWA 策略

- 使用 `vite-plugin-pwa` 生成 `manifest.json` 和 Service Worker。
- 静态资源缓存，支持离线访问应用壳。
- 应用数据保存在后端 DynamoDB 中，前端通过 TanStack Query 缓存。
- MVP 不保证离线写入能力；离线时应用只读展示缓存数据。

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

| 字段 | 说明 |
|---|---|
| `PK` | 分区键 |
| `SK` | 排序键 |
| `GSI1PK` | 全局二级索引 1 分区键 |
| `GSI1SK` | 全局二级索引 1 排序键 |
| `entityType` | `LIST`, `TASK`, `REMINDER`, `NOTIFICATION` |
| `createdBy` | 创建者 Cognito `sub`（UUID），前端不展示，仅用于审计 |
| `updatedBy` | 最后修改者 Cognito `sub`（UUID），前端不展示，仅用于审计 |

### 实体键设计

#### 列表（LIST）

| 字段 | 值 |
|---|---|
| PK | `LISTS` |
| SK | `LIST#<listId>` |
| GSI1PK | — |
| GSI1SK | — |

属性：`name`, `color`, `icon`, `order`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`。

#### 任务（TASK）

| 字段 | 值 |
|---|---|
| PK | `TASKS` |
| SK | `TASK#<taskId>` |
| GSI1PK | `LIST#<listId>` |
| GSI1SK | `TASK#<order>#<taskId>` |

属性：`title`, `notes`, `listId`, `parentId`, `assigneeIds`, `isCompleted`, `isFlagged`, `priority`, `dueDate`, `dueTime`, `order`, `reminders`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`。

- `assigneeIds` 是 Cognito `sub` 数组，表示任务分配给了哪些用户。多 assignee，但任务完成状态为整体状态。
- 未分配任务：`assigneeIds = []`。
- 未分配任务对所有人可见。

#### 子任务（SUBTASK）

| 字段 | 值 |
|---|---|
| PK | `TASKS` |
| SK | `TASK#<parentId>#CHILD#<taskId>` |
| GSI1PK | `TASK#<parentId>#CHILDREN` |
| GSI1SK | `TASK#<order>#<taskId>` |

属性与任务一致，包含 `assigneeIds` / `createdBy` / `updatedBy`。

#### 提醒（REMINDER）

| 字段 | 值 |
|---|---|
| PK | `REMINDERS` |
| SK | `REMINDER#<reminderId>` |
| GSI1PK | `TASK#<taskId>#REMINDERS` |
| GSI1SK | `REMINDER#<triggerAt>` |

属性：`triggerAt`, `recurrence`, `nextTriggerAt`, `isEnabled`, `createdBy`, `updatedBy`。

#### 通知（NOTIFICATION）

| 字段 | 值 |
|---|---|
| PK | `NOTIFICATIONS` |
| SK | `NOTIFICATION#<notificationId>` |
| GSI1PK | `USER#<userSub>#NOTIFICATIONS` |
| GSI1SK | `NOTIFICATION#<createdAt>` |

属性：`type`, `recipientId`, `taskId`, `taskTitle`, `message`, `isRead`, `createdAt`, `expiresAt`。

- `type`: `'assignment'`（后续可扩展为 `'reminder'` 等）。
- `recipientId`: 接收者 Cognito `sub`。
- `expiresAt`: 用于 DynamoDB TTL，已读通知 7 天后删除。

### GSI 数量

MVP 只保留 **1 个 GSI（GSI1）**，覆盖以下访问模式：
- `LIST#<listId>` → 查询该列表下的任务
- `TASK#<parentId>#CHILDREN` → 查询某任务的子任务
- `TASK#<taskId>#REMINDERS` → 查询某任务的所有提醒
- `USER#<userSub>#NOTIFICATIONS` → 查询某用户的未读通知

智能列表（今天、计划、全部、已标记、已完成、分配给我等）在 Lambda 内过滤。理由：
- 项目数据量极小，过滤成本可忽略。
- GSI 过多会增加写放大和架构复杂度。
- 未来如某个查询成为瓶颈，可再增加 GSI。

### 主要查询模式

| 场景 | 查询方式 |
|---|---|
| 所有列表 | `PK = LISTS` |
| 所有任务 | `PK = TASKS` |
| 某列表下任务 | `GSI1 PK = LIST#<listId>, SK begins_with TASK#` |
| 某任务子任务 | `GSI1 PK = TASK#<parentId>#CHILDREN` |
| 某任务所有提醒 | `GSI1 PK = TASK#<taskId>#REMINDERS` |
| 逾期提醒 | 查询 `PK = REMINDERS` 后过滤 `triggerAt <= now` |
| 某用户未读通知 | `GSI1 PK = USER#<userSub>#NOTIFICATIONS, 过滤 isRead = false` |

### 共享类型定义（`packages/shared`）

`packages/shared` 提供前端与 Lambda 共享的 Zod schema 和 TypeScript 类型。以下是业务实体的前端类型（日期时间以 ISO 8601 UTC 字符串表示）：

```typescript
interface List {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string; // Cognito sub (UUID)
  updatedBy: string; // Cognito sub (UUID)
}

interface User {
  id: string;       // Cognito sub
  name: string;
}

interface Reminder {
  id: string;
  taskId: string;
  triggerAt: string;      // ISO 8601 UTC
  recurrence: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'weekdays';
  nextTriggerAt?: string;  // ISO 8601 UTC
  isEnabled: boolean;
  createdBy: string;
  updatedBy: string;
}

interface Task {
  id: string;
  title: string;
  notes: string;
  listId: string;
  parentId: string | null;
  assigneeIds: string[];  // Cognito sub 数组
  isCompleted: boolean;
  isFlagged: boolean;
  priority: 'none' | 'low' | 'medium' | 'high';
  dueDate?: string;        // ISO 8601 UTC 日期
  dueTime?: string;        // HH:MM
  order: number;
  reminders: Reminder[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

interface Notification {
  id: string;
  type: 'assignment';
  recipientId: string;
  taskId: string;
  taskTitle: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  expiresAt: string;
}
```

### 设计规则

- 子任务是独立的一等任务，可以拥有独立的提醒、截止日期、优先级、旗标和 assignee。
- 智能列表根据任务自身属性聚合，包括子任务。
- 父任务完成时，应用提示："是否同时完成所有子任务？"，提供"是"和"否"选项。
- 列表拥有显示顺序，用于手动排序；排序使用浮点数 `order` 字段，避免批量重排。
- 任务拥有同级顺序，嵌套排序按父任务分别处理；同样使用浮点数 `order`。
- **Assign 规则**：
  - 一个任务可以 assign 给多个用户（`assigneeIds: string[]`）。
  - 任务完成状态为整体状态：任意一个用户标记完成后，整个任务完成。
  - 未分配任务对所有人可见。
  - 任务完成后保留 `assigneeIds` 记录。
  - 创建任务时即可选择 assignee。
- **分配通知**：
  - 当任务 `assigneeIds` 新增用户时，后端创建 `NOTIFICATION` 记录。
  - Service Worker 每 5 分钟轮询 `/api/notifications/pending` 拉取未读通知并触发本地通知。
  - 用户查看通知后调用 `/api/notifications/:id/read` 标记已读。
  - 已读通知通过 DynamoDB TTL 在 7 天后自动删除。
- **时区**：后端所有日期时间以 UTC 存储，前端以用户本地时区展示；"今天"智能列表按本地日期边界计算。
- **删除父任务**：非空父任务禁止删除，子任务必须先移除或移动；后端通过应用层约束强制执行。
- **删除列表**：删除列表时级联删除该列表下的所有任务和子任务，同样需要二次确认和撤销提示。
- **移动父任务**：父任务移动到另一个列表时，所有后代子任务自动跟随。
- **重复任务完成**：重复任务完成后保持活跃，截止日期和提醒推进到下一次计划时间；由后端 `/api/tasks/:id/complete` 计算。
- **删除任务**：任务立即硬删除，但 UI 短暂显示"撤销"提示。
- **并发编辑**：MVP 采用 last-write-wins，多设备同时编辑可能丢失后写入数据。
- **审计字段**：`createdBy` / `updatedBy` 记录用户 Cognito `sub`，但 MVP 不展示用户身份。

## REST API 概览

### 接口粒度

按资源域拆分 Lambda。每个资源域一个 Lambda 函数，函数内部根据 `event.requestContext.http.method` 和 `event.rawPath` 做轻量级路由分发。API Gateway 负责把同域下所有路径和方法路由到同一个 Lambda，并处理 CORS 和 JWT 授权。

例如 `lists` Lambda 处理：

| 方法 | 路径 |
|---|---|
| GET | `/api/lists` |
| POST | `/api/lists` |
| PATCH | `/api/lists/{id}` |
| DELETE | `/api/lists/{id}` |

### 接口列表

| 方法 | 路径 | 所属 Lambda |
|---|---|---|
| GET | `/api/health` | `health` |
| GET | `/api/lists` | `lists` |
| POST | `/api/lists` | `lists` |
| PATCH | `/api/lists/{id}` | `lists` |
| DELETE | `/api/lists/{id}` | `lists` |
| GET | `/api/tasks` | `tasks` |
| POST | `/api/tasks` | `tasks` |
| GET | `/api/tasks/{id}` | `tasks` |
| PATCH | `/api/tasks/{id}` | `tasks` |
| DELETE | `/api/tasks/{id}` | `tasks` |
| POST | `/api/tasks/{id}/complete` | `tasks` |
| POST | `/api/tasks/{id}/move` | `tasks` |
| GET | `/api/users` | `users` |
| GET | `/api/reminders/overdue` | `reminders` |
| GET | `/api/notifications/pending` | `notifications` |
| POST | `/api/notifications/{id}/read` | `notifications` |
| POST | `/api/notifications/read-all` | `notifications` |
| GET | `/api/search` | `search` |

### 请求与响应

- 请求体验证：每个 Lambda 内部使用 `packages/shared` 提供的 Zod schema 校验。
- 响应格式：统一通过 `packages/shared` 的 `buildResponse` 工具返回 JSON，包含 `statusCode`、`headers` 和 `body`。
- 错误处理：每个 Lambda 内部 try/catch，返回统一错误体 `{ error: string, code?: string }`。

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
  const session = await fetchAuthSession()
  const token = session.tokens?.accessToken?.toString()
  return fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })
}
```

## 智能列表定义

| 列表 | 过滤条件 | 排序 |
|---|---|---|
| 今天 | `dueDate` 为今天且 `isCompleted === false` | 最早到期时间优先，其次优先级 |
| 计划 | `dueDate` 存在且 `isCompleted === false` | 截止日期升序 |
| 全部 | `isCompleted === false` | 创建时间降序 |
| 已标记 | `isFlagged === true` 且 `isCompleted === false` | 优先级优先，其次截止日期 |
| 已完成 | `isCompleted === true` | 完成时间降序 |
| 分配给我 | 当前用户 sub 在 `assigneeIds` 中且 `isCompleted === false` | 创建时间降序 |

自定义列表使用手动拖拽排序。默认视图是"今天"智能列表。

## 通知与提醒行为

### 提醒通知

- Web 通知是尽力而为。由于 PWA 后台定时器受操作系统和浏览器限制，不保证毫秒级精确触发。
- 应用启动或切回前台时，前端从后端获取逾期提醒，并在应用内展示徽章或"逾期提醒"列表。
- 后端计算重复提醒的下一次触发时间。
- 前端 Service Worker 每 **5 分钟**轮询 `/api/reminders/overdue` 获取逾期提醒，并调度本地通知。
- 重复规则使用 `date-fns` 的 add 助手函数：
  - `daily` -> `addDays(..., 1)`
  - `weekly` -> `addWeeks(..., 1)`
  - `biweekly` -> `addWeeks(..., 2)`
  - `monthly` -> `addMonths(..., 1)`
  - `yearly` -> `addYears(..., 1)`
  - `weekdays` -> 下一个周一到周五的日期

### 分配通知

- 当任务 `assigneeIds` 新增用户时，后端创建 `NOTIFICATION` 记录。
- Service Worker 复用 **5 分钟轮询**，同时调用 `/api/reminders/overdue` 和 `/api/notifications/pending`。
- 本地通知标题示例："【LyCo】你有一个新任务：买牛奶"。
- 用户点击通知或打开"通知中心"/"分配给我"列表后，前端调用 `/api/notifications/:id/read` 或 `/api/notifications/read-all` 标记已读。
- 已读通知通过 DynamoDB TTL 在 **7 天**后自动删除。

### 通知权限

- 用户首次登录或创建第一个带提醒/assign 的任务时，前端请求浏览器通知权限。
- 用户拒绝后，提醒和分配通知降级为应用内徽章和列表展示。

### 未来阶段

- Phase 2/3 考虑使用 **Amazon EventBridge Scheduler** 在提醒时间触发 Lambda。
- Lambda 调用 **Amazon SNS** 或第三方服务发送通知。
- 不依赖 PWA 后台能力，通知更可靠。

## 搜索

- 全文搜索由后端 API 驱动，针对 `Task.title` 和 `Task.notes` 查询。
- 默认按最近更新时间降序返回结果。
- MVP 阶段搜索是全局的，不按当前列表过滤。

## Bruno API 集合

- 在仓库根目录 `bruno/` 下以 `.bru` 文件形式存储 API 请求。
- 集合包含 `development` 和 `production` 两种环境。
- 每个接口对应一个请求，包含 create/update/assign 的示例请求体。
- 由于接口需要 Cognito JWT 授权，集合中需先执行登录步骤，将 Access Token 保存到集合变量中，后续请求自动注入 `Authorization: Bearer <token>`。
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
5. Vite 通过 `import.meta.env` 读取 `VITE_API_URL`、`VITE_USER_POOL_ID`、`VITE_USER_POOL_CLIENT_ID` 等变量。

### 本地开发

- `sst dev` 启动 SST 开发环境，本地运行 Lambda 函数并连接真实 AWS 资源（ap-southeast-1）。
- 前端 `vite dev` 运行开发服务器，通过代理访问本地 API。
- Cognito 使用真实的用户池，开发阶段也关闭公开注册，由管理员手动创建测试账号。
- 使用 SST stage `dev`。

### 部署流程

1. 开发者提交代码。
2. CI 运行 `bunx @biomejs/biome ci`。
3. CI 运行 `bun test`（Vitest）。
4. CI 运行 `tsc --noEmit` 或 `tsgo` 类型检查。
5. 生产部署 **手动触发** `sst deploy --stage prod`。
6. SST 创建/更新：CloudFront、S3、API Gateway、Lambda、DynamoDB、Cognito。
7. 使用 SST stage `dev` 和 `prod`，不使用 `test` stage。

## 部署与运维

### 健康检查

- 实现 `/api/health` 接口，返回 DynamoDB 连通性状态。
- 用于部署验证和 CloudWatch 基本监控。

### 日志与监控

- Lambda 日志写入 CloudWatch Logs，保留期为 **7 天**。
- 配置 CloudWatch 告警状态（不发送通知），用于在控制台查看 Lambda/API 错误趋势。
- 不启用 AWS X-Ray。

### CORS

- `dev` stage：API Gateway CORS 允许所有 origin（便于本地开发）。
- `prod` stage：只允许 `app.example.com`。

### Schema 变更

- 未来需要添加 GSI 时，直接修改 SST 表配置并重新部署，由 DynamoDB 自动处理后台构建。
- 不采用蓝绿表迁移。

## 测试策略

| 层级 | 方式 |
|---|---|
| 单元测试 | Vitest，覆盖 Lambda handler 逻辑、Zod schema |
| 集成测试 | Vitest + DynamoDB Local（Docker 或内存实例） |
| 覆盖率 | statements、branches、functions、lines 均达到 100% |
| API 手动测试 | Bruno 集合，需先获取 Cognito Access Token |

### 测试注意事项

- Lambda handler 与 API Gateway 事件结构解耦，便于单元测试。
- 集成测试通过 DynamoDB Local 模拟真实数据库行为，避免纯 mock 的虚假安全感。
- Cognito 认证在测试中通过模拟 token 或独立测试用户池处理。
- 由于数据共享，测试数据不需要按用户隔离，但需要注意并发测试的数据清理。
- Assign 和通知逻辑需要覆盖：新增 assignee 创建通知、重复 assign 不重复通知、标记已读、TTL 删除等场景。

## 路线图

### Phase 1：Serverless MVP

1. 搭建 SST v3 项目结构，配置 `StaticSite` 和 `Api`。
2. 配置 Cognito User Pool、User Pool Client、Hosted UI 自定义域名，关闭公开注册。
3. 定义 DynamoDB 单表和 1 个 GSI。
4. 前端脚手架：React + Vite + TypeScript + Tailwind + shadcn/ui + TanStack Router/Query/Store/Form + Vitest。
5. 前端认证与 Cognito Hosted UI 回调处理：登录/登出状态、token 刷新、**401 重定向处理**。
6. 实现 `/api/health` 接口。
7. 实现 `/api/users` 接口（返回可选 assignee 列表）。
8. 实现 `lists` 接口 Lambda 与前端自定义列表 CRUD 页面（TDD）。
9. 实现 `tasks`、`subtasks` 接口 Lambda 与前端任务/子任务 CRUD 页面（TDD）。
10. 实现 `tasks` 的 `assigneeIds` 更新逻辑和分配通知创建（TDD）。
11. 实现 `reminders` 接口与前端截止日期/重复提醒设置（TDD）。
12. 实现 `notifications` 接口：未读查询、标记已读、TTL 删除（TDD）。
13. 实现前端智能列表（今天、计划、全部、已标记、已完成、**分配给我**）与搜索页面（TDD）。
14. 实现 `search` 接口与前端对应页面（TDD）。
15. 配置 PWA：manifest、Service Worker、安装提示。
16. 配置 CloudFront 和 API Gateway 自定义域名。
17. 实现 Service Worker 轮询提醒和通知（TDD）。
18. 更新 Bruno 集合并覆盖所有接口。

### Phase 2：体验打磨

- 自建登录 UI 替换 Cognito Hosted UI。
- 拖拽排序（列表内、列表间、层级间）。
- 批量操作：完成、移动、删除、标记、分配。
- 键盘快捷键。
- 空状态与引导。
- 动画与过渡。
- 导入/导出（如后续需要）。
- 账号删除与数据清理。
- 实时通知（WebSocket 或 EventBridge Scheduler）。

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
7. **并发编辑**：MVP 采用 last-write-wins，多设备同时编辑可能丢失后写入数据。
8. **数据共享风险**：所有用户完全读写，任何用户都可以删除所有数据。需要家庭/团队信任基础。
9. **账号删除**：MVP 不实现删除账号，Cognito 用户删除后 DynamoDB 数据仍会残留（但数据共享场景下影响较小）。
10. **分配通知重复**：需要确保同一用户被多次 assign 同一任务时不会重复发送通知。
11. **通知权限**：用户拒绝通知权限后，assign 功能仍可用但无主动通知。

## 成功标准

- 前端可通过 `app.example.com` 访问，API 可通过 `api.example.com` 访问。
- 用户可通过 Cognito Hosted UI 登录，但只有管理员手动创建的用户才能登录。
- 所有接口返回正确 JSON，并在 Bruno 集合中有对应请求。
- 所有登录用户共享同一组列表和任务数据。
- 智能列表、搜索功能正常；新增"分配给我"智能列表。
- Assign 任务后，被分配者收到浏览器通知（若授权）。
- PWA 可安装，Service Worker 能轮询并触发提醒通知和分配通知。
- 所有业务逻辑按 TDD 开发，Vitest 覆盖率达到 100%。
- CI 阻止未通过测试或覆盖率不达标的合并。

## 待解决决策

1. 域名购买与 Route 53 迁移：需要先行完成（由项目负责人自行处理）。
