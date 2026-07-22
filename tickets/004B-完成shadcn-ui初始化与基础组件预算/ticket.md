---
Title: 完成 shadcn/ui 初始化与基础组件预算
ID: 004B
Status: ARCHIVED
Labels: web,frontend,ui
Estimate: 3
Depends: 004
PHASE: 1
CYCLE: 1
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 完成 shadcn/ui 初始化与基础组件预算

## 用户故事

作为前端开发者，我希望项目拥有完整且稳定的 shadcn/ui 主题基线和经过预算的基础组件集合，以便后续页面使用一致的颜色、间距、圆角、暗色模式与交互反馈。

## 背景

已归档的 ticket 004 只添加了 `components.json`、`cn` 工具和 Button，未完整生成 shadcn/ui 的语义颜色、暗色主题、圆角映射、动画依赖与全部 alias。008A 分支因此需要在开发业务组件时反向修补主题变量和动画依赖。本 ticket 在继续开发页面前补齐初始化，并固定 Phase 1 的高确定性组件集合。

## 范围

### 包含

- 补齐适用于 Tailwind CSS v4 的 shadcn/ui 官方 CSS 初始化基线
- 定义 light / dark 两套语义颜色、圆角层级、边框、focus ring、图表与侧边栏 token
- 使用系统主题作为默认值，并提供统一 Theme Provider；MVP 不提供手动主题切换入口
- 补齐 `components.json` 中 `components`、`ui`、`lib`、`utils`、`hooks` aliases
- 固定 shadcn/ui CLI 与生成组件所需依赖版本，避免后续 ticket 因生成器版本变化产生风格漂移
- 安装并保留以下 Phase 1 高确定性基础组件：
  - 应用壳：Button、Sheet、Separator、Scroll Area、Tooltip
  - 表单：Input、Textarea、Label、Checkbox、Select、Switch
  - 操作与反馈：Dialog、Alert Dialog、Dropdown Menu、Popover、Sonner
  - 数据展示：Badge、Avatar、Skeleton
- 用代表性验收 surface 与 smoke test 验证基础组件在 light / dark 系统主题下共享同一套 token；该 surface 不加入业务路由
- 在前端 README 记录组件添加命令、主题约束和“优先复用现有 shadcn/ui 组件”的规则

### 延后但已预算的组件

| 组件 | 预期使用场景 | 延后原因 |
|---|---|---|
| Calendar | 截止日期与提醒设置 | 需先确定日期、时间与 IANA 时区的组合交互 |
| Command | 全局搜索与快捷选择 | 需先确定 014 的搜索信息架构和移动端呈现方式 |

### 不包含

- 预装 Calendar、Command 或其他尚无明确 Phase 1 消费者的组件
- 业务页面、业务表单和业务状态管理
- 自定义 Apple Reminders 视觉复刻或独立设计系统包
- 用户手动切换主题的设置入口
- 修改 shadcn/ui 生成组件以加入尚未被业务需要的变体

## 验收标准

### 场景 1：完整主题基线

Given Web 应用加载全局样式
When 渲染使用 background、foreground、primary、secondary、muted、accent、destructive、border、input 和 ring 的组件
Then light 与 dark 系统主题均使用已定义的语义 token，且不存在未解析的颜色或圆角变量

### 场景 2：系统深色模式

Given 操作系统偏好深色主题
When 用户首次打开应用
Then 应用默认使用 dark 主题
And 操作系统主题变化后应用同步更新

### 场景 3：基础组件可复用

Given 后续前端 ticket 需要应用壳、表单、弹窗、反馈或加载状态
When 从 `@/components/ui` 导入预算内组件
Then 组件无需再次运行初始化或补充主题依赖即可正常构建和渲染

### 场景 4：配置 alias 完整

Given 开发者运行 shadcn/ui CLI 添加新组件
When CLI 读取 `components.json`
Then `components`、`ui`、`lib`、`utils`、`hooks` 路径均可解析到现有 TypeScript alias

### 场景 5：组件生成结果稳定

Given 不同后续 ticket 添加新的 shadcn/ui 组件
When 使用项目文档指定的 CLI 与依赖版本
Then 生成代码沿用相同 style、base color、CSS variables 和 icon library 配置

## 测试要求

- 配置、生成组件和纯样式变更无需为每个组件复制单元测试
- 为 Theme Provider 的系统主题默认值与主题变化行为编写测试
- 添加代表性 smoke test，覆盖一个表单组件和一个 overlay 组件的正常渲染与交互
- 运行 `bun run test`、类型检查、Biome 检查和生产构建
- 覆盖率须达到 statements / branches / functions / lines 100%

## 归档记录

- 合并时间：2026-07-22
- 合并分支：`codex/004b-shadcn-baseline` → `main`
- 合并提交：`9580df3`
- 状态：已完成并归档
- 备注：PR #12 已完成固定 Radix/new-york 工具链、19 个 Phase 1 组件、完整 light/dark 语义主题、首屏系统主题同步、代表性 smoke test 与前端 README 约束。

## 关联设计

- `.lychee/artifacts/designs/2026-07-13-lyco-list-design.md` 技术栈、前端 UI 结构与主题要求
- `tickets/004-初始化react-pwa前端骨架/ticket.md`

## 后续工单

- 004A 使用 Sheet、Button、Separator、Scroll Area 与 Tooltip 建立响应式应用壳
- 008A–008C 复用 Dialog、Alert Dialog、Dropdown Menu、表单组件和 Sonner
- 012 的前端提醒设置在交互方案确定后评估 Calendar
- 014 在搜索信息架构确定后评估 Command
