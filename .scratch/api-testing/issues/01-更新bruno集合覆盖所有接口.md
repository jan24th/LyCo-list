Title: 更新 Bruno 集合覆盖所有接口
Old-ID: 019
Status: needs-triage
Labels: api,testing
Estimate: 3
Blocked by: ../../infra/issues/05-实现health接口.md, ../../tasks/issues/01-实现users-assignee列表接口.md, ../../lists/issues/01-实现列表crud软删除和恢复.md, ../../tasks/issues/02-实现任务与无级子任务crud.md, ../../tasks/issues/03-实现任务移动完成恢复和乐观并发.md, ../../tasks/issues/04-实现assign事务与幂等分配通知.md, ../../reminders/issues/01-实现提醒crud与process-due.md, ../../notifications/issues/01-实现通知查询标记已读和ttl.md, ../../search/issues/02-实现search接口.md, ../../cleanup/issues/01-实现deletion-job和cleanup-lambda.md
PHASE: 1
CYCLE: 6
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md

# 更新 Bruno 集合覆盖所有接口

## 用户故事

作为开发者，我希望拥有一个覆盖所有端点的 Bruno API 集合，以便手动测试和文档化 API。

## 范围

### 包含
- 更新 Bruno 集合，使其包含所有 API 端点的请求
- 配置 Bruno 环境变量（如 base URL、token 等）
- 确保每个 API 端点至少有一个对应请求

### 不包含
- 自动化测试或 CI/CD 集成
- 非 API 接口的文档（如前端组件文档）
- 性能测试或负载测试用例

## 验收标准

### 场景 1：覆盖所有端点

Given 打开 Bruno 集合
When 查看请求列表
Then 每个 API 端点至少有一个请求

### 场景 2：环境变量配置

Given Bruno 集合已配置
When 针对已部署环境运行请求
Then 变量如 base URL 和 token 被正确使用
