---
Title: 定义 DynamoDB 单表实体 Schema 与 Cursor 工具
ID: 003
Status: TODO
Labels: shared,database
Estimate: 5
Depends: 001
PHASE: 1
CYCLE: 1
Source: .github/PROJECT_WORKFLOW.md
---

# 定义 DynamoDB 单表实体 Schema 与 Cursor 工具

## User Story

作为开发者，我希望拥有共享的实体 schema 和 cursor 工具，以便 API 和 Web 客户端在数据结构和分页上保持一致。

## Acceptance Criteria

### Scenario 1: 验证实体 schema

Given 一组实体输入
When 它们通过 Zod schema 校验
Then 有效输入通过，无效输入失败

### Scenario 2: 将 DynamoDB Key 编码为 Cursor

Given 一个 DynamoDB LastEvaluatedKey
When 它被编码为 cursor
Then cursor 是不透明的且可被解码

### Scenario 3: 将 Cursor 解码回 DynamoDB Key

Given 一个 cursor 字符串
When 它被解码
Then 返回原始的 DynamoDB key
