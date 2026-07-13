# LyCo-list 项目指令

## 项目概述

LyCo-list 是一个对标 Apple Reminders 的 PWA 待办应用。采用前后端 monorepo 架构，共享包开发，要求 TDD 与 100% 测试覆盖率。

## 技术栈

| 领域 | 工具 |
|---|---|
| 包管理器 | Bun workspaces |
| 前端 | React + Vite + TypeScript |
| 后端 | Hono + Prisma + SQLite |
| 共享包 | `packages/shared`（类型、schema、工具函数） |
| 样式 | Tailwind CSS |
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
│   └── api/          # Hono REST API
├── packages/
│   └── shared/       # 共享类型、schema、工具函数
├── bruno/            # Bruno API 请求集合
├── tickets/          # Linear 风格的 markdown 工单
└── .lychee/artifacts/
    ├── designs/       # 设计文档
    └── plans/         # 实施计划
```

## 开发流程

### 任务规划
- 实施计划存放在 `.lychee/artifacts/plans/`。
- 计划从 `tickets/` 中的工单生成。
- 所有业务逻辑和功能实现采用 TDD。

### 代码规范
- 使用 Biome 格式化和检查（`bunx @biomejs/biome check`）。
- 安装依赖时使用 `bun install --registry https://registry.npmmirror.com`。

### 类型检查
- 优先使用 `bunx tsgo`。
- 如果 tsgo 不兼容，回退到 `tsc --noEmit`。

### 测试
- 使用 `bun test` 运行测试。
- 覆盖率目标：statements、branches、functions、lines 均达到 100%。
- 覆盖率通过 Vitest 配置阈值强制生效。
- 每个 bug 修复和业务逻辑变更都必须附带测试。

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
- 禁止提交 secrets、`.env` 或本地数据库文件。

## 危险操作

执行以下操作前须告知用户：
- `git push --force`
- `git reset --hard`（存在未提交变更时）
- 批量删除（`rm -rf`）
- 数据库表删除或截断

## 设计权威

- 当工单或计划与设计文档冲突时，以 `.lychee/artifacts/designs/` 中的设计文档为准。
- 设计决策变更时，同步更新工单。
