---
Title: 实现通知查询、标记已读和 TTL
ID: 013
Status: TODO
Labels: api,notifications
Estimate: 5
Depends: 011,012
PHASE: 1
CYCLE: 1
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 实现通知查询、标记已读和 TTL

## 用户故事

作为用户，我希望查询通知、标记已读并让通知过期，以便收件箱保持整洁。

## 范围

### 包含
- 实现通知分页查询接口（未读通知）
- 实现通知标记已读接口
- 标记已读时写入数值型 TTL 字段 `expiresAtEpoch`
- 查询层过滤已过期通知

### 不包含
- 应用关闭后的可靠后台通知（Phase 2）
- 通知的创建与路由策略（由 assign 和 reminders 接口负责）

## 验收标准

### 场景 1：查询通知

Given 已认证用户拥有通知
When 用户查询通知
Then 返回分页结果

### 场景 2：标记通知为已读

Given 一个未读通知
When 用户将其标记为已读
Then 通知的已读状态被更新

### 场景 3：TTL 过期

Given 通知的 TTL 已过期
When 清理运行
Then 通知被删除
