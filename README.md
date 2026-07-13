# LyCo-list 项目说明

Lychee & Coco Todo List —— 一个对标 Apple Reminders 的 PWA 待办应用。

## 功能特性

- **任务与列表**：创建、编辑、完成和删除任务，支持自定义列表。
- **无级嵌套子任务**：子任务是独立的一等任务，拥有独立的提醒、截止日期和优先级。
- **智能列表**：今天、计划、全部、已标记、已完成。
- **截止日期与重复提醒**：支持每天、每周、每两周、每月、每年、工作日重复。
- **搜索**：基于任务标题和备注的全文搜索。
- **导入/导出**：通过 `.lyco.json` 文件备份和恢复整个数据库。
- **PWA**：可安装为应用，支持离线应用壳缓存。
- **浏览器通知**：通过 Service Worker 尽力而为地触发提醒通知。

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

## 项目结构

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

## 快速开始

环境要求：
- 已安装 [Bun](https://bun.sh/)

安装依赖：

```bash
bun install
```

启动后端：

```bash
cd apps/api
bun dev
```

启动前端：

```bash
cd apps/web
bun dev
```

## 常用脚本

在仓库根目录运行：

| 命令 | 说明 |
|---|---|
| `bun check` | 使用 Biome 检查格式与规范 |
| `bun typecheck` | 为所有包执行类型检查（tsgo 或 tsc 回退） |
| `bun test` | 使用 Vitest 运行所有测试 |
| `bun coverage` | 运行测试并强制检查覆盖率 |

## 开发规范

- 所有业务逻辑采用 TDD（测试驱动开发）。
- 覆盖率目标：statements、branches、functions、lines 均达到 100%。
- 提交信息遵循约定式提交：`类型(范围): 描述`。
- 当前实现待办见 `tickets/`，完整设计见 `.lychee/artifacts/designs/`。

## 许可证

MIT
