# LyCo-list AWS Serverless 架构设计文档

## 目标

将 LyCo-list 从本地 Node.js + Hono + Prisma + SQLite 架构，迁移为完全托管在 AWS 上的 Serverless 架构。新增多用户账号与认证能力，前端仍保持为 PWA，MVP 阶段先实现核心功能，离线同步与自建登录 UI 放到后续阶段。

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
Lambda（按资源域拆分的函数：lists、tasks、reminders、search、import/export）
  │
  ▼
DynamoDB（单表，按 userId 隔离）
```

## 技术栈

### 前端

| 层级 | 技术 |
|---|---|
| 构建工具 | Vite |
| 框架 | React + TypeScript |
| 路由 | TanStack Router |
| 数据获取 | TanStack Query |
| 客户端状态 | TanStack Store |
| 表单 | TanStack Form |
| 样式 | Tailwind CSS |
| PWA | vite-plugin-pwa |
| 图标 | Lucide React |
| 认证 | AWS Amplify Auth 模块 |
| API 调用 | fetch |

### 后端

| 层级 | 技术 |
|---|---|
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

## 项目结构

```
LyCo-list/
├── apps/
│   ├── web/                # React PWA 前端
│   └── api/                # Lambda 函数 + SST 配置
│       ├── functions/
│       │   ├── lists/      # lists 域 Lambda：内部路由 GET/POST/PATCH/DELETE
│       │   ├── tasks/      # tasks 域 Lambda：含子任务、完成、移动等
│       │   ├── reminders/  # reminders 域 Lambda
│       │   ├── search/     # search 域 Lambda
│       │   └── transfer/   # import/export 域 Lambda
│       └── sst.config.ts
├── packages/
│   └── shared/             # 类型、Zod schema、DynamoDB 访问工具、响应包装
├── sst.config.ts           # SST 根配置
└── bruno/                  # API 测试集合（需带 Cognito token）
```

## 域名与证书

- 域名托管在 Amazon Route 53。
- SSL/TLS 证书由 AWS Certificate Manager 管理。
- 前端自定义域名：`app.example.com`，CNAME 指向 CloudFront 分配。
- API 自定义域名：`api.example.com`，CNAME 指向 API Gateway 自定义域名。
- Cognito Hosted UI 自定义域名：`auth.example.com`（可选，MVP 建议使用）。

## API 限流

- API Gateway HTTP API 配置默认限流，防止意外流量放大账单。
- 具体阈值在实现阶段根据 2 人使用的实际请求量设定，例如每秒 100 请求、突发 200。
- MVP 不配 WAF。

## 认证

### MVP：Cognito Hosted UI

1. 用户点击登录/注册，前端跳转至 Cognito Hosted UI（`auth.example.com`）。
2. 登录成功后，Cognito 通过回调 URL 重定向回前端，URL 中包含 authorization code。
3. 前端用 code 换取 Access Token、ID Token、Refresh Token。
4. 后续 API 请求在 `Authorization` header 中携带 `Bearer <Access Token>`。
5. API Gateway JWT 授权器验证 token；未携带或无效 token 的请求直接返回 `401`。
6. Lambda 从 `event.requestContext.authorizer.jwt.claims.sub` 获取用户 ID，作为所有 DynamoDB 操作的分区键前缀。

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
| `entityType` | `USER`, `LIST`, `TASK`, `REMINDER` |

### 实体键设计

#### 用户（USER）

| 字段 | 值 |
|---|---|
| PK | `USER#<userId>` |
| SK | `PROFILE` |
| GSI1PK | `EMAIL#<email>` |
| GSI1SK | `USER#<userId>` |

#### 列表（LIST）

| 字段 | 值 |
|---|---|
| PK | `USER#<userId>#LISTS` |
| SK | `LIST#<listId>` |
| GSI1PK | — |
| GSI1SK | — |

属性：`name`, `color`, `icon`, `order`, `createdAt`, `updatedAt`。

#### 任务（TASK）

| 字段 | 值 |
|---|---|
| PK | `USER#<userId>#TASKS` |
| SK | `TASK#<taskId>` |
| GSI1PK | `LIST#<listId>` |
| GSI1SK | `TASK#<order>#<taskId>` |

属性：`title`, `notes`, `listId`, `parentId`, `isCompleted`, `isFlagged`, `priority`, `dueDate`, `dueTime`, `order`, `createdAt`, `updatedAt`。

#### 子任务（SUBTASK）

| 字段 | 值 |
|---|---|
| PK | `USER#<userId>#TASKS` |
| SK | `TASK#<parentId>#CHILD#<taskId>` |
| GSI1PK | `TASK#<parentId>#CHILDREN` |
| GSI1SK | `TASK#<order>#<taskId>` |

属性与任务一致。

#### 提醒（REMINDER）

| 字段 | 值 |
|---|---|
| PK | `USER#<userId>#REMINDERS` |
| SK | `REMINDER#<reminderId>` |
| GSI1PK | `TASK#<taskId>#REMINDERS` |
| GSI1SK | `REMINDER#<triggerAt>` |

属性：`triggerAt`, `recurrence`, `nextTriggerAt`, `isEnabled`。

### GSI 数量

只保留 **1 个 GSI（GSI1）**，覆盖以下访问模式：
- `LIST#<listId>` → 查询该列表下的任务
- `TASK#<parentId>#CHILDREN` → 查询某任务的子任务
- `TASK#<taskId>#REMINDERS` → 查询某任务的所有提醒

智能列表（今天、计划、已标记、已完成等）在 Lambda 内过滤。理由：
- 项目只有 2 个用户，数据量极小，过滤成本可忽略
- GSI 过多会增加写放大和架构复杂度
- 未来如某个查询成为瓶颈，可再增加 GSI

### 主要查询模式

| 场景 | 查询方式 |
|---|---|
| 用户所有列表 | `PK = USER#<userId>#LISTS` |
| 用户所有任务 | `PK = USER#<userId>#TASKS` |
| 某列表下任务 | `GSI1 PK = LIST#<listId>, SK begins_with TASK#` |
| 某任务子任务 | `GSI1 PK = TASK#<parentId>#CHILDREN` |
| 某任务所有提醒 | `GSI1 PK = TASK#<taskId>#REMINDERS` |
| 逾期提醒 | 查询 `PK = USER#<userId>#REMINDERS` 后过滤 `triggerAt <= now` |

## API 设计

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
| GET | `/api/search` | `search` |
| POST | `/api/export` | `transfer` |
| POST | `/api/import` | `transfer` |

### 请求与响应

- 请求体验证：每个 Lambda 内部使用 `packages/shared` 提供的 Zod schema 校验。
- 响应格式：统一通过 `packages/shared` 的 `buildResponse` 工具返回 JSON，包含 `statusCode`、`headers` 和 `body`。
- 错误处理：每个 Lambda 内部 try/catch，返回统一错误体 `{ error: string, code?: string }`。

### Lambda 处理示例

```ts
// functions/lists/index.ts
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { buildResponse, getUserId } from '@lyco/shared'

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}))

export const handler = async (event: any) => {
  try {
    const method = event.requestContext.http.method
    const path = event.rawPath
    const userId = getUserId(event)

    if (method === 'GET' && path === '/api/lists') {
      const result = await client.send(new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `USER#${userId}#LISTS` }
      }))
      return buildResponse(200, result.Items)
    }

    // ... 其他 lists 路由分发

    return buildResponse(404, { error: 'Not found' })
  } catch (error) {
    return buildResponse(500, { error: 'Failed to process request' })
  }
}
```

## 前端 API 调用

使用**原生 fetch** 封装一个 `apiClient`：

- 每次请求前调用 Amplify Auth 获取最新 Access Token
- 自动注入 `Authorization: Bearer <token>` header
- 统一解析 JSON、处理 401/403/500 错误
- 支持本地开发和生产环境的不同 API base URL

TanStack Query 的 `queryFn` 直接使用 `apiClient('/lists')` 等。

```ts
// 示例
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

## 共享代码

`packages/shared` 提供所有 Lambda 复用的内容：

- Zod schema（请求体验证、DynamoDB 项格式）
- TypeScript 类型
- DynamoDB 客户端工厂和访问助手
- `getUserId(event)` 从 API Gateway 事件中解析用户 ID
- `buildResponse(statusCode, body)` 统一响应包装
- 错误类

构建时，SST 会将 `packages/shared` 实际用到的代码 tree-shake 进每个 Lambda 包。

## 提醒与通知

### MVP

保持与现有设计一致：
- 后端提供 `/api/reminders/overdue` 接口，返回当前时间之前未触发且未禁用的提醒。
- 前端 Service Worker 周期性轮询该接口，触发浏览器 Notification API。
- 后端不主动推送通知。

### 未来阶段

- Phase 2/3 考虑使用 **Amazon EventBridge Scheduler** 在提醒时间触发 Lambda。
- Lambda 调用 **Amazon SNS** 或第三方服务（如微信通知）发送通知。
- 不依赖 PWA 后台能力，通知更可靠。

## 导入与导出

- 导出：Lambda 查询用户所有列表、任务、提醒，序列化为带 schema 版本字段的 JSON 对象，直接返回给前端下载。
- 导入：Lambda 接收 JSON 文件内容，校验 schema 版本，**全量替换**该用户的 DynamoDB 数据。
- 文件扩展名：`.lyco.json`。
- MVP 数据量小，通过 API body 传输即可；若数据超过 Lambda 6MB 响应限制或未来有附件，再引入 S3 预签名 URL。
- 全量替换时如项目超过 DynamoDB 事务的 100 项限制，需要分批处理。对于 2 人项目，此限制不会触发。

## 前端部署

1. 使用 SST `StaticSite` 组件部署 React 应用。
2. 构建产物上传到 S3。
3. CloudFront 作为 CDN 和 HTTPS 入口，绑定 `app.example.com`。
4. 前端运行时通过环境变量获取 API Gateway 地址 `api.example.com` 和 Cognito User Pool Client 配置。

## 本地开发

- `sst dev` 启动 SST 开发环境，本地运行 Lambda 函数并连接 AWS 资源。
- 前端 `vite dev` 运行开发服务器，通过代理访问本地 API。
- Cognito 使用真实的用户池，或在测试环境用独立测试用户池。

## 测试策略

| 层级 | 方式 |
|---|---|
| 单元测试 | Vitest，覆盖每个 Lambda handler、DynamoDB 访问函数、Zod schema |
| 集成测试 | Vitest + DynamoDB Local（Docker 或内存实例） |
| 覆盖率 | 仍保持 statements、branches、functions、lines 均达到 100% |
| API 手动测试 | Bruno 集合，需先获取 Cognito Access Token |

### 测试注意事项

- Lambda handler 与 API Gateway 事件结构解耦，便于单元测试。
- 集成测试通过 DynamoDB Local 模拟真实数据库行为，避免纯 mock 的虚假安全感。
- Cognito 认证在测试中通过模拟 token 或独立测试用户池处理。

## 部署流程

1. 开发者提交代码。
2. CI 运行 `bunx @biomejs/biome ci`。
3. CI 运行 `bun test`（Vitest）。
4. CI 运行 `tsc --noEmit` 或 `tsgo` 类型检查。
5. CI 运行 `sst deploy --stage prod`。
6. SST 创建/更新：CloudFront、S3、API Gateway、Lambda、DynamoDB、Cognito。

## 迁移影响

- 原设计文档中的 Hono 后端、Prisma ORM、SQLite 数据库被替换。
- 后端相关工单（002 后端脚手架、005 Prisma 数据模型、006-008 REST API 接口）需要重新设计或替换。
- 数据模型从关系型迁移到 DynamoDB 单表，需要重新设计访问模式。
- Bruno 集合需增加 Cognito 登录步骤和 token 变量。
- 前端需增加 Amplify Auth 配置和 Cognito Hosted UI 回调处理。

## 路线图

### Phase 1：Serverless MVP

1. 搭建 SST v3 项目结构，配置 `StaticSite` 和 `Api`。
2. 配置 Cognito User Pool、User Pool Client、Hosted UI 自定义域名。
3. 定义 DynamoDB 单表和 GSI。
4. 实现 `lists` 接口 Lambda 与前端页面（TDD）。
5. 实现 `tasks`、`subtasks` 接口 Lambda 与前端页面（TDD）。
6. 实现 `reminders` 接口与提醒轮询（TDD）。
7. 实现 `search`、`import`、`export` 接口（TDD）。
8. 配置 CloudFront 和 API Gateway 自定义域名。
9. 实现 PWA 安装与 Service Worker 轮询。
10. 更新 Bruno 集合并覆盖所有接口。

### Phase 2：体验打磨

- 自建登录 UI 替换 Cognito Hosted UI。
- 拖拽排序（列表内、列表间、层级间）。
- 批量操作。
- 键盘快捷键、空状态、动画过渡。

### Phase 3：云端同步与离线

- 离线数据写入：IndexedDB 本地缓存 + 网络恢复后同步。
- 冲突处理策略。
- 实时同步（可选 API Gateway WebSocket）。
- 共享列表（只读与协作）。

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
5. **成本**：DynamoDB 按读写收费，API Gateway 和 Lambda 按请求收费；对于 2 人项目成本极低，但 GSI 过多会增加写放大。
6. **调试**：Lambda 日志分散在 CloudWatch，需要统一日志结构和查询方式。
7. **并发编辑**：MVP 采用 last-write-wins，多设备同时编辑可能丢失后写入数据。
8. **导入大小限制**：通过 API body 导入导出受 Lambda 6MB payload 限制，未来大数据量需引入 S3。
9. **账号删除**：MVP 不实现删除账号，Cognito 用户删除后 DynamoDB 数据仍会残留。

## 成功标准

- 前端可通过 `app.example.com` 访问，API 可通过 `api.example.com` 访问。
- 用户可通过 Cognito Hosted UI 注册、登录、登出。
- 所有接口返回正确 JSON，并在 Bruno 集合中有对应请求。
- 数据按用户 ID 隔离，用户只能看到/修改自己的列表和任务。
- 智能列表、搜索、导入/导出功能正常。
- PWA 可安装，Service Worker 能轮询并触发提醒通知。
- 所有业务逻辑按 TDD 开发，Vitest 覆盖率达到 100%。
- CI 阻止未通过测试或覆盖率不达标的合并。

## 待解决决策

无。本版本所有重大架构决策均已与用户确认。
