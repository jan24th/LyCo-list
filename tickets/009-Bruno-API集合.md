---
Title: Bruno API 集合
Status: TODO
Labels: tools, api
Estimate: 3
PHASE: 1
CYCLE: 3
Depends: 006-REST-API列表接口, 007-REST-API任务与子任务接口, 008-REST-API搜索导入导出
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-todo-design.md
---

# Bruno API 集合

## User Story

As a 开发者，I want 可复用的 API 请求集合，So that 开发阶段可以手动测试和调试后端接口。

## Acceptance Criteria

### Scenario 1: 创建 Bruno 集合结构

Given `bruno/` 目录已存在
When 创建集合文件和 `environments` 目录
Then Bruno 可以打开并加载该集合

### Scenario 2: 配置开发/生产环境

Given 集合已创建
When 创建 `development.bru` 和 `production.bru`
Then 请求可以切换 base URL 和变量

### Scenario 3: 覆盖核心接口

Given 后端 API 已实现
When 为 lists、tasks、search、import、export 创建 `.bru` 请求
Then 每个请求都包含示例请求体和断言

### Scenario 4: 验证集合可用

Given 后端服务运行在开发环境
When 在 Bruno 中执行请求
Then 所有请求返回预期响应

## References

- [Bruno Documentation](https://docs.usebruno.com/)
- [Bruno Git Collections](https://docs.usebruno.com/git-sync/git-sync)
