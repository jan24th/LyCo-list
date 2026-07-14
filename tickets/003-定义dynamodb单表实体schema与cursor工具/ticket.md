---
Title: 定义 DynamoDB 单表实体 Schema 与 Cursor 工具
ID: 003
Status: TODO
Labels: shared,database
Estimate: 5
Depends: 001
PHASE: 1
CYCLE: 1
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 定义 DynamoDB 单表实体 Schema 与 Cursor 工具

## 用户故事

作为开发者，我希望拥有共享的实体 schema 和 cursor 工具，以便 API 和 Web 客户端在数据结构和分页上保持一致。

## 范围

### 包含
- `packages/shared` 中的 Zod 实体 schema（列表、任务、提醒、用户等）
- 共享的错误响应结构与数据校验 helper
- DynamoDB `LastEvaluatedKey` 与 opaque cursor 的编码/解码工具

### 不包含
- DynamoDB 表的 SST 部署
- 实际业务 API 接口
- 复杂查询与索引设计

## 验收标准

### 场景 1：验证实体 schema

Given 一组实体输入
When 它们通过 Zod schema 校验
Then 有效输入通过，无效输入失败

### 场景 2：将 DynamoDB Key 编码为 Cursor

Given 一个 DynamoDB LastEvaluatedKey
When 它被编码为 cursor
Then cursor 是不透明的且可被解码

### 场景 3：将 Cursor 解码回 DynamoDB Key

Given 一个 cursor 字符串
When 它被解码
Then 返回原始的 DynamoDB key
