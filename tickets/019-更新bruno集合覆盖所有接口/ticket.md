---
Title: 更新 Bruno 集合覆盖所有接口
ID: 019
Status: TODO
Labels: api,testing
Estimate: 3
Depends: 006,007,008,009,010,011,012,013,015,018
PHASE: 1
CYCLE: 6
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

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
