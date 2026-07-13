# GitHub Projects 工作流

LyCo-list 使用 GitHub Issues 作为 ticket 权威来源，使用 GitHub Projects 作为状态看板。

## Project

建议创建一个仓库级 Project：

- 名称：`LyCo-list MVP`
- 视图：
  - `Board`：按 `Status` 分组
  - `Backlog`：按优先级和阶段排序
  - `Phase 1`：过滤 `Phase = Phase 1`

## 字段

| 字段 | 类型 | 取值 |
|---|---|---|
| Status | Single select | Backlog, Ready, In progress, In review, Done |
| Phase | Single select | Phase 1, Phase 2, Phase 3, Phase 4 |
| Area | Single select | web, api, shared, infra, docs, testing |
| Priority | Single select | P0, P1, P2, P3 |
| Plan | Text | `.lychee/artifacts/plans/` 中的计划路径 |

## Issue 规则

- 每个 ticket 使用 GitHub Issue 表达，优先使用 `.github/ISSUE_TEMPLATE/` 中的模板。
- Issue 标题使用约定式前缀：`feat: ...`、`fix: ...`、`chore: ...`、`docs: ...`、`test: ...`。
- 复杂 Issue 在实现前创建计划文件，并在 Issue 与计划文件中互相链接。
- Issue 或计划与 `.lychee/artifacts/designs/` 冲突时，以设计文档为准。
- 每个业务逻辑变更都必须先写失败测试，并保持 Vitest 覆盖率 100%。

## 首批 MVP Issues

建议从设计文档 Phase 1 拆分以下 Issues：

1. `chore: 搭建 SST v3 monorepo 基础结构`
2. `feat(infra): 配置 Cognito Hosted UI 与关闭公开注册`
3. `feat(shared): 定义 DynamoDB 单表实体 schema 与 cursor 工具`
4. `feat(web): 初始化 React PWA 前端骨架`
5. `feat(web): 实现 Cognito 登录回调与 401 重定向处理`
6. `feat(api): 实现 health 接口`
7. `feat(api): 实现 users assignee 列表接口`
8. `feat(lists): 实现列表 CRUD、软删除和恢复`
9. `feat(tasks): 实现任务与无级子任务 CRUD`
10. `feat(tasks): 实现任务移动、完成、恢复和乐观并发`
11. `feat(tasks): 实现 assign 事务与幂等分配通知`
12. `feat(reminders): 实现提醒 CRUD 与 process-due`
13. `feat(notifications): 实现通知查询、标记已读和 TTL`
14. `feat(web): 实现智能列表和搜索页面`
15. `feat(api): 实现 search 接口`
16. `feat(web): 配置 PWA manifest、Service Worker 和安装提示`
17. `feat(web): 实现前台提醒与通知轮询`
18. `feat(api): 实现 DELETION_JOB 和 cleanup Lambda`
19. `test(api): 更新 Bruno 集合覆盖所有接口`
