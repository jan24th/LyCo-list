---
Title: 实现前台提醒与通知轮询
ID: 017
Status: TODO
Labels: web,pwa
Estimate: 3
Depends: 012,016
PHASE: 1
CYCLE: 1
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 实现前台提醒与通知轮询

## 用户故事

作为用户，我希望应用在打开时轮询提醒和通知，以便无需手动刷新即可看到更新。

## 范围

### 包含
- 应用打开时轮询到期提醒
- 应用从后台恢复前台时轮询新通知
- 页面可见性变化（如切换标签页后重新可见）时触发轮询
- 前台轮询的频率与触发条件控制

### 不包含
- 后台定时任务或服务工作者（Service Worker）轮询
- 推送通知（Push Notification）通道
- 应用关闭或锁屏状态下的提醒唤醒

## 验收标准

### 场景 1：应用打开时轮询提醒

Given 应用处于前台
When 应用打开
Then 轮询到期提醒

### 场景 2：应用恢复时轮询通知

Given 应用曾被置于后台
When 应用返回前台
Then 轮询新通知

### 场景 3：可见性变化时轮询

Given 页面可见
When 可见性变为可见
Then 触发轮询
