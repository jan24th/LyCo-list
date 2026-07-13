# LyCo-list 待办应用设计文档

## 目标

构建一个功能对标 Apple Reminders 的 Web App / PWA 待办应用，从项目开始就采用清晰的前后端分离架构。前端是可安装的 PWA，后端是基于 Node 的 REST API，数据库使用 SQLite。

## 项目结构

```
LyCo-list/
├── apps/
│   ├── web/                # React SPA（PWA）
│   └── api/                # Hono REST API
├── packages/
│   └── shared/             # 共享类型、schema、工具函数
├── bruno/                  # API 请求集合
└── ...
```

## 技术栈

### 前端

| 层级 | 技术 |
|---|---|
| 包管理器 | Bun |
| 代码规范 | Biome（替代 ESLint + Prettier） |
| 类型检查 | tsc / tsgo |
| 测试 | Vitest（覆盖率目标 100%） |
| 框架 | React + Vite + TypeScript |
| 样式 | Tailwind CSS |
| 路由 | TanStack Router |
| 数据获取 | TanStack Query |
| 客户端状态 | TanStack Store |
| 表单 | TanStack Form |
| PWA | vite-plugin-pwa |
| 通知 | Service Worker + Notification API |
| 图标 | Lucide React |
| 工具库 | date-fns, uuid |

### 后端

| 层级 | 技术 |
|---|---|
| 包管理器 | Bun |
| 代码规范 | Biome |
| 类型检查 | tsc / tsgo |
| 测试 | Vitest（覆盖率目标 100%） |
| 框架 | Hono |
| ORM | Prisma |
| 数据库 | SQLite（MVP），后续可迁移至 PostgreSQL |
| 校验 | Zod |
| 测试 | Vitest |
| API 客户端 | Bruno（集合存储在仓库中） |

## 范围

### MVP（Phase 1）包含

- **前端**：React SPA，支持 PWA。
- **后端**：Hono REST API + Prisma + SQLite。
- **任务**：创建、编辑、删除、完成、优先级、旗标、截止日期、提醒。
- **无级嵌套子任务**：子任务与父任务功能对等；父任务完成时提示是否一键完成子任务。
- **自定义列表**：名称、颜色、图标、排序。
- **智能列表**：今天、计划、全部、已标记、已完成。
- **搜索**：基于标题和备注的全文搜索（后端实现）。
- **重复提醒**：无、每天、每周、每两周、每月、每年、工作日。
- **全库导入/导出**：通过后端 API 导出/导入 JSON 备份。
- **PWA 可安装**：manifest、Service Worker、离线静态资源缓存。
- **浏览器通知**：PWA 安装并授权后，尽力而为地触发提醒通知。
- **Bruno API 集合**：开发阶段手动测试 API 的复用请求集合。

### MVP 不包含

- 用户账号与认证。
- 多端云同步（Phase 3）。
- 共享列表。
- 位置提醒。
- 附件/图片。
- 自然语言输入。
- Siri / Shortcuts 集成。

## 架构

### 前端数据流

1. UI 组件从 TanStack Query 缓存中读取数据。
2. TanStack Query 的 `queryFn` 调用 Hono REST API。
3. Mutations 发送 HTTP 请求到后端，并失效相关 Query 缓存。
4. TanStack Store 保存临时 UI 状态：搜索关键词、当前弹窗、选中的任务。
5. Service Worker 获取即将到来的提醒并触发本地通知。

### 后端数据流

1. Hono 路由接收 HTTP 请求。
2. Zod 校验请求体与查询参数。
3. Prisma 对 SQLite 执行数据库操作。
4. Controller 返回 JSON 响应。
5. 导入/导出接口处理 `.lyco.json` 文件。

### Monorepo 与代码规范

- 使用 Bun workspace 管理 `apps/web`、`apps/api` 和 `packages/shared` 的依赖。
- 根目录 `biome.json` 统一配置格式化与校验规则，覆盖所有子包。
- 开发阶段使用 `bunx @biomejs/biome check` 做代码检查；CI 阶段使用 `bunx @biomejs/biome ci`。
- 类型检查优先使用 `tsgo`；若 tsgo 尚未兼容项目则回退到 `tsc --noEmit`。
- 前后端共享 `packages/shared` 的类型与校验 schema。

### PWA 策略

- 使用 `vite-plugin-pwa` 生成 `manifest.json` 和 Service Worker。
- 静态资源缓存，支持离线访问应用壳。
- 应用数据保存在后端 SQLite 数据库中，前端通过 TanStack Query 缓存。
- MVP 不保证离线写入能力；离线时应用优雅降级。

## 数据模型

### Prisma Schema（后端）

```prisma
model List {
  id        String   @id @default(uuid())
  name      String
  color     String
  icon      String
  order     Int
  tasks     Task[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Reminder {
  id             String      @id @default(uuid())
  taskId         String
  task           Task        @relation(fields: [taskId], references: [id], onDelete: Cascade)
  triggerAt      DateTime
  recurrence     String      // 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'weekdays'
  nextTriggerAt  DateTime?
  isEnabled      Boolean     @default(true)
}

model Task {
  id          String      @id @default(uuid())
  title       String
  notes       String      @default("")
  listId      String
  list        List        @relation(fields: [listId], references: [id], onDelete: Restrict)
  parentId    String?
  parent      Task?       @relation("TaskChildren", fields: [parentId], references: [id], onDelete: Restrict)
  children    Task[]      @relation("TaskChildren")
  isCompleted Boolean     @default(false)
  isFlagged   Boolean     @default(false)
  priority    String      @default("none") // 'none' | 'low' | 'medium' | 'high'
  dueDate     DateTime?
  dueTime     String?
  order       Int
  reminders   Reminder[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}
```

### TypeScript 接口（前端）

```typescript
interface List {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface Reminder {
  id: string;
  taskId: string;
  triggerAt: string;      // ISO 8601 UTC
  recurrence: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'weekdays';
  nextTriggerAt?: string;  // ISO 8601 UTC
  isEnabled: boolean;
}

interface Task {
  id: string;
  title: string;
  notes: string;
  listId: string;
  parentId: string | null;
  isCompleted: boolean;
  isFlagged: boolean;
  priority: 'none' | 'low' | 'medium' | 'high';
  dueDate?: string;        // ISO 8601 UTC 日期
  dueTime?: string;         // HH:MM
  order: number;
  reminders: Reminder[];
  createdAt: string;
  updatedAt: string;
}
```

### 设计规则

- 子任务是独立的一等任务，可以拥有独立的提醒、截止日期、优先级和旗标。
- 智能列表根据任务自身属性聚合，包括子任务。
- 父任务完成时，应用提示："是否同时完成所有子任务？"，提供"是"和"否"选项。
- 列表拥有显示顺序，用于手动排序。
- 任务拥有同级顺序，嵌套排序按父任务分别处理。
- **时区**：后端所有日期时间以 UTC 存储，前端以用户本地时区展示；"今天"智能列表按本地日期边界计算。
- **删除父任务**：非空父任务禁止删除，子任务必须先移除或移动；后端通过 `onDelete: Restrict` 强制执行。
- **移动父任务**：父任务移动到另一个列表时，所有后代子任务自动跟随。
- **重复任务完成**：重复任务完成后保持活跃，截止日期和提醒推进到下一次计划时间。
- **删除任务**：任务立即硬删除，但 UI 短暂显示"撤销"提示。
- **数据安全**：MVP 阶段 SQLite 数据以明文存储；加密待云端同步阶段再考虑。

## REST API 概览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/lists` | 获取所有列表 |
| POST | `/api/lists` | 创建列表 |
| PATCH | `/api/lists/:id` | 更新列表 |
| DELETE | `/api/lists/:id` | 删除列表 |
| GET | `/api/tasks` | 获取任务（支持智能列表过滤） |
| POST | `/api/tasks` | 创建任务 |
| GET | `/api/tasks/:id` | 获取任务详情，包含提醒和子任务 |
| PATCH | `/api/tasks/:id` | 更新任务 |
| DELETE | `/api/tasks/:id` | 删除任务 |
| POST | `/api/tasks/:id/complete` | 切换任务完成状态 |
| POST | `/api/tasks/:id/move` | 移动任务到另一个列表 |
| GET | `/api/search` | 按标题/备注搜索任务 |
| POST | `/api/export` | 导出数据库为 JSON |
| POST | `/api/import` | 从 JSON 导入数据库 |

## 智能列表定义

| 列表 | 过滤条件 | 排序 |
|---|---|---|
| 今天 | `dueDate` 为今天且 `isCompleted === false` | 最早到期时间优先，其次优先级 |
| 计划 | `dueDate` 存在且 `isCompleted === false` | 截止日期升序 |
| 全部 | `isCompleted === false` | 创建时间降序 |
| 已标记 | `isFlagged === true` 且 `isCompleted === false` | 优先级优先，其次截止日期 |
| 已完成 | `isCompleted === true` | 完成时间降序 |

自定义列表使用手动拖拽排序。默认视图是第一个自定义列表，如果没有自定义列表则显示"今天"。

## 通知与提醒行为

- Web 通知是尽力而为。由于 PWA 后台定时器受操作系统和浏览器限制，不保证毫秒级精确触发。
- 应用启动或切回前台时，前端从后端获取逾期提醒，并在应用内展示徽章或"逾期提醒"列表。
- 后端计算重复提醒的下一次触发时间。
- 前端 Service Worker 从后端获取即将到来的提醒，并调度本地通知。
- 重复规则使用 `date-fns` 的 add 助手函数：
  - `daily` -> `addDays(..., 1)`
  - `weekly` -> `addWeeks(..., 1)`
  - `biweekly` -> `addWeeks(..., 2)`
  - `monthly` -> `addMonths(..., 1)`
  - `yearly` -> `addYears(..., 1)`
  - `weekdays` -> 下一个周一到周五的日期

## 数据库导入/导出

- 导出：后端将所有 `List` 和 `Task` 记录序列化为带 schema 版本字段的 JSON 对象。
- 导入：后端校验 schema 版本，若导出来自旧版本则自动迁移，并在一个事务中替换数据库内容。
- 文件扩展名：`.lyco.json`。
- 前端仅负责文件上传/下载，数据转换由后端完成。

## 搜索

- 全文搜索由后端 API 驱动，针对 `Task.title` 和 `Task.notes` 查询。
- 默认按最近更新时间降序返回结果。
- MVP 阶段搜索是全局的，不按当前列表过滤。

## Bruno API 集合

- 在仓库根目录 `bruno/` 下以 `.bru` 文件形式存储 API 请求。
- 集合包含 `development` 和 `production` 两种环境。
- 每个接口对应一个请求，包含 create/update/import/export 的示例请求体。
- Bruno 用于开发阶段手动 API 测试，以及团队内共享 API 示例。

## UI 结构

- **响应式导航**：桌面端使用固定左侧边栏；移动端使用顶部标题栏 + 汉堡抽屉。
- **侧边栏/导航**：智能列表 + 自定义列表 + "新建列表"按钮。
- **主面板**：列表标题、任务列表、顶部添加任务输入框。
- **任务详情抽屉/弹窗**：标题、备注、截止日期/时间、提醒、优先级、旗标、列表、子任务。
- **搜索栏**：根据上下文过滤当前列表或全局搜索。
- **安装提示**：满足条件时显示 PWA 安装横幅/按钮。

## 路线图

### Phase 1：MVP（6–8 周）

1. Monorepo 搭建：`apps/web`、`apps/api`、`packages/shared`。
2. 后端脚手架：Hono + Prisma + SQLite + Zod + Vitest。
3. Prisma schema 与数据库 seed（采用 TDD 编写 schema 相关工具函数）。
4. REST API 接口：lists、tasks、subtasks、search、import/export（每段业务逻辑均先写测试）。
5. Bruno API 集合。
6. 前端脚手架：React + Vite + TypeScript + Tailwind + TanStack Router/Query/Store/Form + Vitest。
7. PWA 配置：manifest、Service Worker、安装提示。
8. 前端 CRUD：自定义列表、任务、子任务、智能列表、搜索（采用 TDD）。
9. 截止日期与重复提醒（采用 TDD）。
10. 浏览器通知 via Service Worker（采用 TDD）。

### Phase 2：体验打磨（2–3 周）

- 列表内/列表间/层级间拖拽排序。
- 批量操作：完成、移动、删除、标记。
- 键盘快捷键。
- 空状态与引导。
- 动画与过渡。
- 导入其他格式（ICS、CSV）。

### Phase 3：云端同步（4–6 周）

- 用户账号（JWT 或 OAuth）。
- 多端同步与冲突处理。
- 可选 WebSocket 或 SSE 实时同步。
- 共享列表（只读与协作）。

### Phase 4：高级功能（按需）

- 自然语言输入解析日期/时间。
- 位置提醒。
- 附件与图片。
- Siri Shortcuts / share target 集成。
- PWA 小组件与快捷操作。

## 成功标准

- 前后端在开发环境中可以独立启动。
- API 接口返回正确 JSON，并有 Bruno 请求覆盖。
- 应用可安装为 PWA。
- 任务、列表、提醒持久化在后端 SQLite 数据库中。
- 智能列表随任务增删改查正确更新。
- 提醒通知在 PWA 安装后尽力而为地触发。
- 数据库导出可以被全新实例导入并完整恢复数据。
- 所有业务逻辑按 TDD 开发：测试先写，实现后写。
- Vitest 覆盖率（statements、branches、functions、lines）达到 100%。
- CI 阻止未通过测试或覆盖率不达标的合并。

## 待解决决策

无。本版本所有重大决策均已与用户确认。
