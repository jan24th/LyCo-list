# LyCo-list 项目指令

## 项目概述

LyCo-list 是一个对标 Apple Reminders 的 PWA 待办应用。采用前后端 monorepo 架构，共享包开发，要求 TDD 与 100% 测试覆盖率。

## 技术栈

| 领域 | 工具 |
|---|---|
| 包管理器 | Bun workspaces |
| 前端 | React + Vite + TypeScript |
| 后端 | AWS Lambda（Node.js 24）+ API Gateway + DynamoDB + Cognito |
| 部署 | SST v3 |
| 延迟清理 | `sst.aws.CronV2`（EventBridge Scheduler）+ cleanup Lambda |
| 共享包 | `packages/shared`（类型、schema、工具函数） |
| 样式 | Tailwind CSS |
| 基础组件 | shadcn/ui |
| 路由 | TanStack Router |
| 数据获取 | TanStack Query |
| 客户端状态 | TanStack Store |
| 表单 | TanStack Form |
| 校验 | Zod |
| API 测试 | Bruno（`bruno/` 目录） |
| 代码规范 | Biome |
| 类型检查 | 优先 tsgo；`tsc --noEmit` 回退 |
| 测试 | Vitest，覆盖率阈值 100% |

## Monorepo 结构

```
LyCo-list/
├── apps/
│   ├── web/          # React PWA 前端
│   └── api/          # Lambda 函数 + SST 配置
│       ├── functions/
│       │   ├── lists/
│       │   ├── tasks/
│       │   ├── reminders/
│       │   ├── search/
│       │   ├── users/
│       │   ├── notifications/
│       │   ├── cleanup/
│       │   └── health/
│       └── sst.config.ts
├── packages/
│   └── shared/       # 共享类型、schema、工具函数
├── bruno/            # Bruno API 请求集合
├── .github/          # GitHub Issue 模板与项目协作配置
├── sst.config.ts     # SST 根配置
└── .lychee/artifacts/
    ├── designs/       # 设计文档
    └── plans/         # 实施计划
```

## 开发流程

### 任务规划
- 实施计划存放在 `.lychee/artifacts/plans/`。
- Issue 使用 GitHub Issues 创建和维护，GitHub Projects 作为状态看板。
- 实施计划从 GitHub Issue 生成，并在计划与 Issue 描述中互相链接。
- Issue 应使用 `.github/ISSUE_TEMPLATE/` 中的模板，明确验收标准、测试要求和关联设计。
- 所有业务逻辑和功能实现采用 TDD。

### 代码规范
- 使用 Biome 格式化和检查（`bunx @biomejs/biome check`）。
- 安装依赖时使用 `bun install --registry https://registry.npmmirror.com`。

### 类型检查
- 优先使用 `bunx tsgo`。
- 如果 tsgo 不兼容，回退到 `tsc --noEmit`。

### 数据与 API
- DynamoDB 实体必须能通过自身 ID 直接读取；子任务只用 `parentId` 表达层级，不使用不同主键格式。
- 所有集合 Query/Scan 必须处理分页，并通过不透明 cursor 暴露给客户端。
- 修改、移动、完成、删除和恢复现有实体必须使用 `expectedVersion` 条件写；冲突返回 `409`。
- Assign 与通知创建必须使用事务和确定性通知 ID，保证重试幂等。
- DynamoDB TTL 字段使用 Unix epoch 秒的 Number；不要把 ISO 字符串作为 TTL 属性。
- 日期时间区分本地日历日期、IANA 时区和 UTC 时间点，重复规则必须按本地日历推进。

### 测试
- 使用 `bun test` 运行测试。
- 覆盖率目标：statements、branches、functions、lines 均达到 100%。
- 覆盖率通过 Vitest 配置阈值强制生效。
- 每个 bug 修复和业务逻辑变更都必须附带测试。
- AWS 服务相关代码优先使用 DynamoDB Local 做集成测试，避免纯 mock。
- 时间相关测试必须固定系统时间和 IANA 时区，覆盖月末、闰年与 DST。
- TTL 测试验证数值字段和查询过滤，不等待 DynamoDB 的异步物理删除。
- 删除清理测试必须覆盖 cursor 断点续传与 `UnprocessedItems` 重试。
- PWA 通知测试只承诺应用启动、恢复前台和页面可见期间的轮询；MVP 不宣称应用关闭后仍能定时唤醒。

### Git 提交
- 遵循约定式提交：`类型(范围): 描述`。
- 类型：`feat`、`fix`、`refactor`、`chore`、`docs`、`test`、`perf`。
- 使用小写、祈使句，末尾不加句号。
- 示例：`feat(api): 添加列表创建接口`。

## 沟通方式

- 使用中文回复用户。
- 项目内代码注释、PR 描述和 Git 提交信息可以使用中文，保持清晰即可。
- 保持简洁：避免不必要的抽象，不构建臆测性的灵活性。
- 修改相邻代码前，先确认是否为任务所需。

## 安全

- 禁止批量导出环境变量（`env`、`printenv`、`set | grep`）。
- 检查特定变量时使用 `echo $VAR_NAME`。
- 禁止提交 secrets、`.env`、本地数据库文件或 AWS 凭证文件。
- 禁止在代码中硬编码 AWS access key / secret key。

## 危险操作

执行以下操作前须告知用户：
- `git push --force`
- `git reset --hard`（存在未提交变更时）
- 批量删除（`rm -rf`）
- DynamoDB 表删除或截断
- `sst remove` 删除生产环境资源
- 修改 Cognito User Pool 导致用户无法登录的配置变更

## 设计权威

- 当 GitHub Issue 或计划与设计文档冲突时，以 `.lychee/artifacts/designs/` 中的设计文档为准。
- 设计决策变更时，同步更新相关 GitHub Issue、README 和本文件。
