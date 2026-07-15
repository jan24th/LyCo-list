# 按 stage 收紧 API Gateway CORS Implementation Plan

> Ticket: `tickets/001B-按stage收紧api-gateway-cors/ticket.md`
> Plan: `tickets/001B-按stage收紧api-gateway-cors/plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `sst.config.ts` 中 `sst.aws.ApiGatewayV2` 的 `cors.allowOrigins` 从硬编码 `"*"` 改为按 `dev` / `acc` / `prod` stage 收紧，并同步更新 design 文档 CORS 章节。

**Architecture:** 在 `run()` 函数内新增一个 stage 到 origin 数组的映射，保持现有 `ApiGatewayV2` 构造逻辑不变；非 `acc` / `prod` stage（含 `dev` 及所有临时 stage）默认回退到 `"*"`，避免本地开发和临时环境因来源未登记而跨域失败。

## Global Constraints

- `dev` stage CORS：`allowOrigins: ["*"]`
- `acc` stage CORS：`allowOrigins: ["https://app.acc.jan24th.today"]`
- `prod` stage CORS：`allowOrigins: ["https://app.jan24th.today"]`
- 未知 stage 默认回退到 `dev` 行为：`allowOrigins: ["*"]`
- 不添加 WAF、前端代码、API 路由逻辑或 Cognito Hosted UI CORS 配置
- 代码规范：`bunx @biomejs/biome check sst.config.ts` 通过
- 类型检查：`bun run typecheck` 通过（根 tsconfig 未包含 `sst.config.ts`，因此额外运行 `bunx tsc --noEmit sst.config.ts` 进行补充校验）

**Tech Stack:** SST v3 (`sst.aws.ApiGatewayV2`), Bun, TypeScript, Biome

---

### Task 1: 按 stage 收紧 `sst.config.ts` 的 CORS

> Covers: Scenario 1 (dev stage 允许所有 origin), Scenario 2 (acc stage 只允许验收前端域名), Scenario 3 (prod stage 只允许生产前端域名), Scenario 4 (类型检查与代码规范通过)

**Files:**
- Modify: `sst.config.ts`
- Review: `sst.config.ts` diff

**Interfaces:**
- Consumes: `$app.stage` (SST 全局 stage 变量)
- Produces: `corsOrigins` 局部常量，类型为 `string[]`，直接传入 `sst.aws.ApiGatewayV2` 的 `cors.allowOrigins`

- [ ] **Step 1: 确认当前 CORS 配置**

  读取 `sst.config.ts` 第 33-38 行，确认当前代码为：

  ```ts
  const api = new sst.aws.ApiGatewayV2("Api", {
    cors: {
      allowOrigins: ["*"],
      allowMethods: ["*"],
      allowHeaders: ["content-type", "authorization"],
    },
    domain: domain.api,
  });
  ```

- [ ] **Step 2: 替换为按 stage 映射**

  将上述 `allowOrigins: ["*"]` 替换为 `corsOrigins` 常量：

  ```ts
  const corsOrigins = ((): string[] => {
    switch ($app.stage) {
      case "acc":
        return ["https://app.acc.jan24th.today"];
      case "prod":
        return ["https://app.jan24th.today"];
      default:
        return ["*"];
    }
  })();

  const api = new sst.aws.ApiGatewayV2("Api", {
    cors: {
      allowOrigins: corsOrigins,
      allowMethods: ["*"],
      allowHeaders: ["content-type", "authorization"],
    },
    domain: domain.api,
  });
  ```

  注意：
  - `default` 分支覆盖 `dev` 及所有未列出的 stage。
  - 不要改动 `allowMethods` 和 `allowHeaders`。

- [ ] **Step 3: 运行项目类型检查**

  Run: `bun run typecheck`
  Expected: 命令成功退出，无类型错误。

- [ ] **Step 4: 运行 `sst.config.ts` 独立类型检查**

  由于根 `tsconfig.json` 的 `include` 为空，`bun run typecheck` 不会覆盖 `sst.config.ts`。补充执行：

  Run:
  ```bash
  bunx tsc --noEmit --skipLibCheck --module NodeNext --moduleResolution NodeNext --target ES2022 --strict sst.config.ts
  ```

  Expected: 命令成功退出，无输出。

- [ ] **Step 5: 运行代码规范检查**

  Run: `bunx @biomejs/biome check sst.config.ts`
  Expected: 成功退出，无格式化或 lint 错误。

- [ ] **Step 6: 人工/代码审查确认**

  Run: `git diff -- sst.config.ts`
  Expected diff 摘要：
  - 新增 `const corsOrigins = ...` 映射。
  - `allowOrigins` 的值由 `["*"]` 改为 `corsOrigins`。
  - 无其他变更。

- [ ] **Step 7: 提交**

  ```bash
  git add sst.config.ts
  git commit -m "feat(infra): tighten api gateway cors by stage"
  ```

---

### Task 2: 同步更新 design 文档 CORS 章节

> Covers: 范围中“同步更新 design 文档 CORS 章节，保持设计权威来源一致”

**Files:**
- Modify: `.lychee/artifacts/designs/2026-07-13-lyco-list-design.md`
- Review: `.lychee/artifacts/designs/2026-07-13-lyco-list-design.md`

**Interfaces:**
- Consumes: 范围中 stage → origin 映射规则
- Produces: 更新后的 CORS 设计章节

- [ ] **Step 1: 读取现有 CORS 章节**

  读取 `.lychee/artifacts/designs/2026-07-13-lyco-list-design.md` 第 701-705 行，确认当前内容：

  ```markdown
  ### CORS

  - `dev` stage：API Gateway CORS 允许所有 origin（便于本地开发）。
  - `prod` stage：只允许完整 origin `https://app.jan24th.today`。
  ```

- [ ] **Step 2: 更新 CORS 章节**

  将上述内容替换为：

  ```markdown
  ### CORS

  API Gateway HTTP API 的 CORS 按 `$app.stage` 配置：

  - `dev` stage：`allowOrigins: ["*"]`，允许所有 origin（便于本地开发）。
  - `acc` stage：`allowOrigins: ["https://app.acc.jan24th.today"]`，只允许验收环境前端。
  - `prod` stage：`allowOrigins: ["https://app.jan24th.today"]`，只允许生产环境前端。
  - 其他未列出的 stage 默认回退到 `dev` 配置，即 `allowOrigins: ["*"]`。
  ```

- [ ] **Step 3: 确认更新后的章节**

  Run: `grep -n -A 8 "^### CORS" .lychee/artifacts/designs/2026-07-13-lyco-list-design.md`
  Expected: 输出包含 `dev`、`acc`、`prod` 和默认回退规则，且域名与 `sst.config.ts` 完全一致。

- [ ] **Step 4: 提交**

  ```bash
  git add .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
  git commit -m "docs(design): update cors section to match stage-specific config"
  ```

---

### Task 3: 最终验证与 ticket 状态同步

> Covers: Scenario 4 (类型检查与代码规范通过)

**Files:**
- Modify: `tickets/001B-按stage收紧api-gateway-cors/ticket.md`
- Review: `sst.config.ts`, `.lychee/artifacts/designs/2026-07-13-lyco-list-design.md`

- [ ] **Step 1: 重新运行全部检查**

  Run: `bun run typecheck`
  Expected: 通过。

  Run: `bunx tsc --noEmit --skipLibCheck --module NodeNext --moduleResolution NodeNext --target ES2022 --strict sst.config.ts`
  Expected: 通过。

  Run: `bunx @biomejs/biome check sst.config.ts`
  Expected: 通过。

- [ ] **Step 2: 可选：使用 sst diff 验证 dev stage**

  如果当前环境已配置 AWS 凭证且希望获得基础设施层面的确认，可运行：

  Run: `bunx sst diff --stage dev`
  Expected: 命令成功执行，输出中 `ApiGatewayV2` 的 `cors.allowOrigins` 包含 `"*"`；若无 AWS 凭证可跳过本步骤。

- [ ] **Step 3: 更新 ticket 状态**

  编辑 `tickets/001B-按stage收紧api-gateway-cors/ticket.md`，将 YAML frontmatter 中的 `Status: TODO` 改为 `Status: DONE`。

  ```bash
  git add tickets/001B-按stage收紧api-gateway-cors/ticket.md
  git commit -m "docs(ticket): mark 001B as done"
  ```

---

## Self-Review

**1. Ticket coverage:**
- Scenario 1 (dev stage `"*"`) → Task 1 `default` 分支。
- Scenario 2 (acc stage 仅 `https://app.acc.jan24th.today`) → Task 1 `case "acc"`。
- Scenario 3 (prod stage 仅 `https://app.jan24th.today`) → Task 1 `case "prod"`。
- Scenario 4 (类型检查与代码规范) → Task 1 Step 3/4/5 及 Task 3 Step 1。
- Design 文档同步 → Task 2。

**2. Placeholder scan:** 无 TBD/TODO/"implement later"/"similar to Task N"；所有代码块均包含可直接使用的完整内容。

**3. Type consistency:** `corsOrigins` 为 `string[]`，与 `sst.aws.ApiGatewayV2` 的 `cors.allowOrigins` 类型匹配；design 文档域名与代码一致。

**4. Hidden assumptions:** 已明确未知 stage 回退到 `dev`；已说明根 `typecheck` 不覆盖 `sst.config.ts`，并给出补充校验命令；已说明 `sst diff` 为可选且需要 AWS 凭证。
