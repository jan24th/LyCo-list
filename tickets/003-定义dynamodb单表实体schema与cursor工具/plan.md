# 定义 DynamoDB 单表实体 Schema 与 Cursor 工具 Implementation Plan

> Ticket: `tickets/003-定义dynamodb单表实体schema与cursor工具/ticket.md`
> Plan: `tickets/003-定义dynamodb单表实体schema与cursor工具/plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `packages/shared` 中按功能域拆分并定义 LyCo-list 所有 DynamoDB 实体共享的 Zod schema，以及用于分页的不透明 cursor 编解码工具。使用单元测试覆盖 cursor 对 DynamoDB `LastEvaluatedKey` 形状的兼容性，并满足 100% 测试覆盖率。

**Architecture:** 按 `schema/lists/`、`schema/tasks/`、`schema/reminders/`、`schema/notifications/`、`schema/users/` 组织 schema，每个域导出输入、更新和完整记录 schema。`schema/common.ts` 提供通用校验 helper。cursor 工具对 DynamoDB `LastEvaluatedKey` 形状的对象做 JSON + base64url 编码，并通过单元测试验证。所有导出通过 `@lyco/shared` 暴露。

## Global Constraints

- 包管理器：`bun` workspaces，安装依赖时使用 `--registry https://registry.npmmirror.com`。
- 代码规范：`biome.json` 统一配置，开发脚本 `bun check`，CI 使用 `bunx @biomejs/biome ci`。
- 类型检查：优先使用 `bunx tsgo`；若 tsgo 不兼容，回退到 `tsc --noEmit`。
- 测试框架：Vitest，覆盖率阈值 statements / branches / functions / lines 均为 100%。
- 校验库：Zod。
- 所有业务逻辑按 TDD 开发；schema 与工具函数必须编写测试并满足 100% 覆盖率。
- Git 提交格式：`类型(范围): 描述`，英文、小写、祈使句、末尾不加句号。
- 共享包：`packages/shared` 统一从 `@lyco/shared` 导入。
- 所有集合 Query/Scan 必须处理分页，并通过不透明 cursor 暴露给客户端。
- 日期时间区分本地日历日期、IANA 时区和 UTC 时间点，重复规则必须按本地日历推进。
- TTL 字段使用 Unix epoch 秒的 Number；不要把 ISO 字符串作为 TTL 属性。
- `assigneeIds` 最多 20 个，由 Zod 强制限制。
- 子任务与父任务使用完全相同的实体结构，仅通过 `parentId` 表达层级关系。
- `orderKey` 由非负 `order` 格式化为固定宽度、9 位小数的字符串。

---

### Task 1: 添加依赖并初始化 Schema 目录结构

> Covers: 所有实体验证与 cursor 单元测试的基础依赖

**Files:**
- Create: `packages/shared/src/schema/common.ts`
- Create: `packages/shared/src/schema/common.test.ts`
- Modify: `packages/shared/package.json`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: workspace 基础结构（由 ticket 001 建立）。
- Produces: `zod`；导出自定义校验 helper。

- [ ] **Step 1: 安装依赖**

Run: `cd packages/shared && bun add zod --registry https://registry.npmmirror.com`

Expected: `package.json` 中新增 `zod` 依赖。

- [ ] **Step 2: 创建 `packages/shared/src/schema/common.ts`**

```typescript
import { z } from "zod";

export const uuid = z.string().uuid();
export const cognitoSub = uuid;
export const isoTimestamp = z.string().datetime({ offset: true });
export const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "Invalid local date format (YYYY-MM-DD)",
});
export const localTime = z.string().regex(/^\d{2}:\d{2}$/, {
  message: "Invalid local time format (HH:mm)",
});
export const ianaTimeZone = z.string().refine(
  (value) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  },
  { message: "Invalid IANA time zone" },
);
export const recurrenceRule = z.enum([
  "none",
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
  "weekdays",
]);
export const priority = z.enum(["none", "low", "medium", "high"]);
export const orderNumber = z.number().nonnegative().finite().max(1_000_000_000);
export function formatOrderKey(order: number): string {
  return order.toFixed(9);
}
export const entityType = z.enum([
  "LIST",
  "TASK",
  "REMINDER",
  "NOTIFICATION",
  "DELETION_JOB",
]);
```

- [ ] **Step 3: 创建 `packages/shared/src/schema/common.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import {
  formatOrderKey,
  ianaTimeZone,
  localDate,
  localTime,
  orderNumber,
  recurrenceRule,
} from "./common";

describe("common helpers", () => {
  it("validates localDate", () => {
    expect(localDate.safeParse("2026-07-14").success).toBe(true);
    expect(localDate.safeParse("2026-7-14").success).toBe(false);
  });

  it("validates localTime", () => {
    expect(localTime.safeParse("14:30").success).toBe(true);
    expect(localTime.safeParse("2:30").success).toBe(false);
  });

  it("validates ianaTimeZone", () => {
    expect(ianaTimeZone.safeParse("Asia/Shanghai").success).toBe(true);
    expect(ianaTimeZone.safeParse("Mars/Phobos").success).toBe(false);
  });

  it("validates recurrenceRule", () => {
    expect(recurrenceRule.safeParse("none").success).toBe(true);
    expect(recurrenceRule.safeParse("hourly").success).toBe(false);
  });

  it("validates orderNumber", () => {
    expect(orderNumber.safeParse(1).success).toBe(true);
    expect(orderNumber.safeParse(-1).success).toBe(false);
    expect(orderNumber.safeParse(2_000_000_000).success).toBe(false);
  });

  it("formats orderKey", () => {
    expect(formatOrderKey(1)).toBe("1.000000000");
    expect(formatOrderKey(1.5)).toBe("1.500000000");
  });
});
```

- [ ] **Step 4: 运行测试**

Run: `cd packages/shared && bun test src/schema/common.test.ts`

Expected: PASS，覆盖率 100%。

- [ ] **Step 5: 提交**

```bash
git add packages/shared

git commit -m "feat(shared): add common zod helpers"
```

---

### Task 2: 定义 User 与 List Schema

> Covers: Scenario 1（验证实体 schema）

**Files:**
- Create: `packages/shared/src/schema/users/index.ts`
- Create: `packages/shared/src/schema/users/user.test.ts`
- Create: `packages/shared/src/schema/lists/index.ts`
- Create: `packages/shared/src/schema/lists/list.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `common` helper。
- Produces: `List`, `ListInput`, `ListUpdate`, `User` schema 和类型。

- [ ] **Step 1: 创建 `packages/shared/src/schema/users/index.ts`**

```typescript
import { z } from "zod";
import { cognitoSub } from "../common";

export const userSchema = z.object({
  id: cognitoSub,
  name: z.string().min(1).max(100),
});

export type User = z.infer<typeof userSchema>;
```

- [ ] **Step 2: 创建 `packages/shared/src/schema/users/user.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { userSchema } from "./index";

describe("userSchema", () => {
  it("accepts a valid user", () => {
    const result = userSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      name: "Alice",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = userSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid sub", () => {
    const result = userSchema.safeParse({ id: "not-a-uuid", name: "Alice" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: 创建 `packages/shared/src/schema/lists/index.ts`**

```typescript
import { z } from "zod";
import { cognitoSub, isoTimestamp, orderNumber } from "../common";

export const listBaseSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().max(7).regex(/^#[0-9a-fA-F]{6}$/).default("#3b82f6"),
  icon: z.string().max(50).default("list"),
  order: orderNumber.default(0),
});

export const listInputSchema = listBaseSchema;
export const listUpdateSchema = listBaseSchema.partial();

export const listSchema = listBaseSchema.extend({
  id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  deletedAt: isoTimestamp.optional(),
  undoUntil: isoTimestamp.optional(),
  deletionVersion: z.number().int().nonnegative().optional(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  createdBy: cognitoSub,
  updatedBy: cognitoSub,
});

export type ListInput = z.infer<typeof listInputSchema>;
export type ListUpdate = z.infer<typeof listUpdateSchema>;
export type List = z.infer<typeof listSchema>;
```

- [ ] **Step 4: 创建 `packages/shared/src/schema/lists/list.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { listInputSchema, listSchema, listUpdateSchema } from "./index";

describe("list schemas", () => {
  it("accepts valid input", () => {
    expect(listInputSchema.safeParse({ name: "购物清单" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(listInputSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects invalid color", () => {
    expect(listInputSchema.safeParse({ name: "A", color: "blue" }).success).toBe(false);
  });

  it("applies defaults", () => {
    const result = listInputSchema.parse({ name: "默认" });
    expect(result.color).toBe("#3b82f6");
    expect(result.icon).toBe("list");
    expect(result.order).toBe(0);
  });

  it("allows partial update", () => {
    expect(listUpdateSchema.safeParse({ color: "#ef4444" }).success).toBe(true);
  });

  it("accepts full record", () => {
    const result = listSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      name: "购物清单",
      color: "#3b82f6",
      icon: "list",
      order: 1,
      version: 1,
      createdAt: "2026-07-14T00:00:00Z",
      updatedAt: "2026-07-14T00:00:00Z",
      createdBy: "11111111-1111-1111-1111-111111111111",
      updatedBy: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing audit fields", () => {
    expect(
      listSchema.safeParse({
        id: "11111111-1111-1111-1111-111111111111",
        name: "购物清单",
        version: 1,
      }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 5: 运行测试**

Run: `cd packages/shared && bun test src/schema/lists/list.test.ts src/schema/users/user.test.ts`

Expected: PASS，覆盖率 100%。

- [ ] **Step 6: 更新 `packages/shared/src/index.ts`**

```typescript
export * from "./schema/common";
export * from "./schema/users";
export * from "./schema/lists";
```

- [ ] **Step 7: 提交**

```bash
git add packages/shared

git commit -m "feat(shared): add user and list zod schemas"
```

---

### Task 3: 定义 Task Schema

> Covers: Scenario 1（验证实体 schema）

**Files:**
- Create: `packages/shared/src/schema/tasks/index.ts`
- Create: `packages/shared/src/schema/tasks/task.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `common` helper。
- Produces: `Task`, `TaskInput`, `TaskUpdate`, `MoveTaskInput` schema 和类型。

- [ ] **Step 1: 创建 `packages/shared/src/schema/tasks/index.ts`**

```typescript
import { z } from "zod";
import {
  cognitoSub,
  ianaTimeZone,
  isoTimestamp,
  localDate,
  localTime,
  orderNumber,
  priority,
  recurrenceRule,
} from "../common";

export const taskBaseSchema = z.object({
  title: z.string().min(1).max(500),
  notes: z.string().max(5000).default(""),
  listId: z.string().uuid(),
  parentId: z.string().uuid().nullable().default(null),
  assigneeIds: z.array(cognitoSub).max(20).default([]),
  isCompleted: z.boolean().default(false),
  isFlagged: z.boolean().default(false),
  priority: priority.default("none"),
  dueDate: localDate.optional(),
  dueTime: localTime.optional(),
  timeZone: ianaTimeZone.optional(),
  recurrence: recurrenceRule.default("none"),
  order: orderNumber.default(0),
});

const requireDueDate = (
  data: { recurrence?: string | null; dueDate?: string },
  ctx: z.RefinementCtx,
) => {
  if (data.recurrence !== undefined && data.recurrence !== "none" && !data.dueDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "dueDate is required when recurrence is not none",
      path: ["dueDate"],
    });
  }
};

export const taskInputSchema = taskBaseSchema.superRefine(requireDueDate);
export const taskUpdateSchema = taskBaseSchema.partial().superRefine(requireDueDate);

export const taskSchema = taskBaseSchema.extend({
  id: z.string().uuid(),
  completedAt: isoTimestamp.nullable().default(null),
  lastCompletedAt: isoTimestamp.nullable().default(null),
  version: z.number().int().nonnegative(),
  deletedAt: isoTimestamp.optional(),
  undoUntil: isoTimestamp.optional(),
  deletionVersion: z.number().int().nonnegative().optional(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  createdBy: cognitoSub,
  updatedBy: cognitoSub,
});

export const moveTaskInputSchema = z.object({
  listId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  order: orderNumber,
  expectedVersion: z.number().int().nonnegative(),
});

export type TaskInput = z.infer<typeof taskInputSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
export type Task = z.infer<typeof taskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskInputSchema>;
```

- [ ] **Step 2: 创建 `packages/shared/src/schema/tasks/task.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { taskInputSchema, taskSchema, taskUpdateSchema } from "./index";

describe("task schemas", () => {
  it("accepts valid task input", () => {
    const result = taskInputSchema.safeParse({
      title: "买牛奶",
      listId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
  });

  it("accepts nested task", () => {
    const result = taskInputSchema.safeParse({
      title: "子任务",
      listId: "11111111-1111-1111-1111-111111111111",
      parentId: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 20 assignees", () => {
    const result = taskInputSchema.safeParse({
      title: "A",
      listId: "11111111-1111-1111-1111-111111111111",
      assigneeIds: Array.from({ length: 21 }, (_, i) =>
        `11111111-1111-1111-1111-${String(i).padStart(12, "0")}`,
      ),
    });
    expect(result.success).toBe(false);
  });

  it("rejects recurrence without dueDate", () => {
    const result = taskInputSchema.safeParse({
      title: "A",
      listId: "11111111-1111-1111-1111-111111111111",
      recurrence: "daily",
    });
    expect(result.success).toBe(false);
  });

  it("accepts recurrence with dueDate", () => {
    const result = taskInputSchema.safeParse({
      title: "A",
      listId: "11111111-1111-1111-1111-111111111111",
      recurrence: "daily",
      dueDate: "2026-07-14",
      dueTime: "09:00",
      timeZone: "Asia/Shanghai",
    });
    expect(result.success).toBe(true);
  });

  it("allows partial update", () => {
    expect(taskUpdateSchema.safeParse({ title: "新标题" }).success).toBe(true);
  });

  it("rejects update recurrence without dueDate", () => {
    expect(taskUpdateSchema.safeParse({ recurrence: "weekly" }).success).toBe(false);
  });

  it("accepts full record", () => {
    const result = taskSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      title: "买牛奶",
      notes: "",
      listId: "22222222-2222-2222-2222-222222222222",
      parentId: null,
      assigneeIds: [],
      isCompleted: false,
      isFlagged: false,
      priority: "none",
      recurrence: "none",
      order: 0,
      completedAt: null,
      lastCompletedAt: null,
      version: 1,
      createdAt: "2026-07-14T00:00:00Z",
      updatedAt: "2026-07-14T00:00:00Z",
      createdBy: "11111111-1111-1111-1111-111111111111",
      updatedBy: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `cd packages/shared && bun test src/schema/tasks/task.test.ts`

Expected: PASS，覆盖率 100%。

- [ ] **Step 4: 更新 `packages/shared/src/index.ts`**

```typescript
export * from "./schema/tasks";
```

- [ ] **Step 5: 提交**

```bash
git add packages/shared

git commit -m "feat(shared): add task zod schema with nesting and assignee limits"
```

---

### Task 4: 定义 Reminder 与 Notification Schema

> Covers: Scenario 1（验证实体 schema）

**Files:**
- Create: `packages/shared/src/schema/reminders/index.ts`
- Create: `packages/shared/src/schema/reminders/reminder.test.ts`
- Create: `packages/shared/src/schema/notifications/index.ts`
- Create: `packages/shared/src/schema/notifications/notification.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `common` helper。
- Produces: `Reminder`, `ReminderInput`, `ReminderUpdate`, `Notification` schema 和类型。

- [ ] **Step 1: 创建 `packages/shared/src/schema/reminders/index.ts`**

```typescript
import { z } from "zod";
import { cognitoSub, ianaTimeZone, isoTimestamp, recurrenceRule } from "../common";

export const reminderBaseSchema = z.object({
  taskId: z.string().uuid(),
  triggerAt: isoTimestamp,
  recurrence: recurrenceRule.default("none"),
  timeZone: ianaTimeZone,
  isEnabled: z.boolean().default(true),
});

export const reminderInputSchema = reminderBaseSchema;
export const reminderUpdateSchema = reminderBaseSchema.partial();

export const reminderSchema = reminderBaseSchema.extend({
  id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  createdBy: cognitoSub,
  updatedBy: cognitoSub,
});

export type ReminderInput = z.infer<typeof reminderInputSchema>;
export type ReminderUpdate = z.infer<typeof reminderUpdateSchema>;
export type Reminder = z.infer<typeof reminderSchema>;
```

- [ ] **Step 2: 创建 `packages/shared/src/schema/reminders/reminder.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { reminderInputSchema, reminderSchema } from "./index";

describe("reminder schemas", () => {
  it("accepts valid input", () => {
    const result = reminderInputSchema.safeParse({
      taskId: "11111111-1111-1111-1111-111111111111",
      triggerAt: "2026-07-14T09:00:00Z",
      timeZone: "Asia/Shanghai",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid timeZone", () => {
    const result = reminderInputSchema.safeParse({
      taskId: "11111111-1111-1111-1111-111111111111",
      triggerAt: "2026-07-14T09:00:00Z",
      timeZone: "Invalid/Zone",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid triggerAt", () => {
    const result = reminderInputSchema.safeParse({
      taskId: "11111111-1111-1111-1111-111111111111",
      triggerAt: "not-a-time",
      timeZone: "Asia/Shanghai",
    });
    expect(result.success).toBe(false);
  });

  it("accepts full record", () => {
    const result = reminderSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      taskId: "22222222-2222-2222-2222-222222222222",
      triggerAt: "2026-07-14T09:00:00Z",
      recurrence: "none",
      timeZone: "Asia/Shanghai",
      isEnabled: true,
      version: 1,
      createdAt: "2026-07-14T00:00:00Z",
      updatedAt: "2026-07-14T00:00:00Z",
      createdBy: "11111111-1111-1111-1111-111111111111",
      updatedBy: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 3: 创建 `packages/shared/src/schema/notifications/index.ts`**

```typescript
import { z } from "zod";
import { cognitoSub, isoTimestamp } from "../common";

export const notificationType = z.enum(["assignment", "reminder"]);

export const notificationSchema = z.object({
  id: z.string().uuid(),
  type: notificationType,
  recipientId: cognitoSub,
  taskId: z.string().uuid(),
  reminderId: z.string().uuid().optional(),
  taskTitle: z.string().min(1).max(500),
  message: z.string().min(1).max(1000),
  isRead: z.boolean().default(false),
  readAt: isoTimestamp.optional(),
  createdAt: isoTimestamp,
  expiresAtEpoch: z.number().int().nonnegative().optional(),
});

export const markNotificationReadInputSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationType = z.infer<typeof notificationType>;
export type MarkNotificationReadInput = z.infer<typeof markNotificationReadInputSchema>;
```

- [ ] **Step 4: 创建 `packages/shared/src/schema/notifications/notification.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { markNotificationReadInputSchema, notificationSchema } from "./index";

describe("notification schemas", () => {
  it("accepts valid notification", () => {
    const result = notificationSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      type: "assignment",
      recipientId: "22222222-2222-2222-2222-222222222222",
      taskId: "33333333-3333-3333-3333-333333333333",
      taskTitle: "新任务",
      message: "你被分配了一个新任务",
      isRead: false,
      createdAt: "2026-07-14T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    const result = notificationSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      type: "email",
      recipientId: "22222222-2222-2222-2222-222222222222",
      taskId: "33333333-3333-3333-3333-333333333333",
      taskTitle: "新任务",
      message: "你被分配了一个新任务",
      createdAt: "2026-07-14T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts notification with TTL", () => {
    const result = notificationSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      type: "reminder",
      recipientId: "22222222-2222-2222-2222-222222222222",
      taskId: "33333333-3333-3333-3333-333333333333",
      taskTitle: "提醒",
      message: "任务到期",
      isRead: true,
      readAt: "2026-07-14T00:00:00Z",
      createdAt: "2026-07-14T00:00:00Z",
      expiresAtEpoch: 1752460800,
    });
    expect(result.success).toBe(true);
  });

  it("accepts mark read input", () => {
    const result = markNotificationReadInputSchema.safeParse({ expectedVersion: 3 });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 5: 运行测试**

Run: `cd packages/shared && bun test src/schema/reminders/reminder.test.ts src/schema/notifications/notification.test.ts`

Expected: PASS，覆盖率 100%。

- [ ] **Step 6: 更新 `packages/shared/src/index.ts`**

```typescript
export * from "./schema/reminders";
export * from "./schema/notifications";
```

- [ ] **Step 7: 提交**

```bash
git add packages/shared

git commit -m "feat(shared): add reminder and notification zod schemas"
```

---

### Task 5: 实现 Opaque Cursor 编解码工具

> Covers: Scenario 2（DynamoDB Key 编码为 Cursor）、Scenario 3（Cursor 解码回 DynamoDB Key）

**Files:**
- Create: `packages/shared/src/cursor.ts`
- Create: `packages/shared/src/cursor.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: 无。
- Produces: `encodeCursor(key)` 返回不透明 base64url 字符串；`decodeCursor(cursor)` 返回 `Record<string, unknown>` 或抛出 `CursorError`。

- [ ] **Step 1: 创建 `packages/shared/src/cursor.ts`**

```typescript
export class CursorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CursorError";
  }
}

export type CursorKey = Record<string, unknown>;

export function encodeCursor(key: CursorKey): string {
  if (Object.keys(key).length === 0) {
    throw new CursorError("Cannot encode an empty cursor key");
  }
  const json = JSON.stringify(key);
  return Buffer.from(json, "utf-8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorKey {
  if (!cursor || cursor.trim() === "") {
    throw new CursorError("Cursor cannot be empty");
  }
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = JSON.parse(json) as CursorKey;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new CursorError("Decoded cursor is not a valid object");
    }
    return parsed;
  } catch (error) {
    if (error instanceof CursorError) {
      throw error;
    }
    throw new CursorError("Invalid cursor format");
  }
}
```

- [ ] **Step 2: 创建 `packages/shared/src/cursor.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { CursorError, decodeCursor, encodeCursor } from "./cursor";

describe("encodeCursor", () => {
  it("encodes a DynamoDB key to a base64url string", () => {
    const key = { PK: "LIST#111", SK: "METADATA" };
    const cursor = encodeCursor(key);
    expect(typeof cursor).toBe("string");
    expect(Buffer.from(cursor, "base64url").toString("utf-8")).toBe(
      JSON.stringify(key),
    );
  });

  it("throws on empty key", () => {
    expect(() => encodeCursor({})).toThrow(CursorError);
  });

  it("round-trips complex keys", () => {
    const key = {
      PK: "TASK#abc",
      SK: "METADATA",
      GSI1PK: "TASKS",
      GSI1SK: "ORDER#1",
    };
    expect(decodeCursor(encodeCursor(key))).toEqual(key);
  });
});

describe("decodeCursor", () => {
  it("decodes a cursor back to the original key", () => {
    const key = { PK: "LIST#111", SK: "METADATA" };
    expect(decodeCursor(encodeCursor(key))).toEqual(key);
  });

  it("throws on empty cursor", () => {
    expect(() => decodeCursor("")).toThrow(CursorError);
  });

  it("throws on invalid base64", () => {
    expect(() => decodeCursor("!!!")).toThrow(CursorError);
  });

  it("throws on non-object payload", () => {
    const tampered = Buffer.from("[1,2,3]").toString("base64url");
    expect(() => decodeCursor(tampered)).toThrow(CursorError);
  });
});

describe("cursor with DynamoDB key shape", () => {
  it("encodes and decodes a LastEvaluatedKey-shaped object", () => {
    const lastKey = {
      PK: { S: "LIST#111" },
      SK: { S: "METADATA" },
    };
    const cursor = encodeCursor(lastKey);
    expect(decodeCursor(cursor)).toEqual(lastKey);
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `cd packages/shared && bun test src/cursor.test.ts`

Expected: PASS，覆盖率 100%。

- [ ] **Step 4: 更新 `packages/shared/src/index.ts`**

```typescript
export * from "./cursor";
```

- [ ] **Step 5: 提交**

```bash
git add packages/shared

git commit -m "feat(shared): add opaque cursor encoder and decoder with dynamodb local integration"
```

---

### Task 6: 添加共享错误响应与请求校验 Helper

> Covers: 所有接口的统一错误体结构、后续 Lambda 的 Zod 校验集成

**Files:**
- Create: `packages/shared/src/errors.ts`
- Create: `packages/shared/src/errors.test.ts`
- Create: `packages/shared/src/validate.ts`
- Create: `packages/shared/src/validate.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: Zod schema。
- Produces: `ValidationError` 与 `formatZodError`；`parseRequest(schema, payload)` 返回类型安全结果或抛出错误。

- [ ] **Step 1: 创建 `packages/shared/src/errors.ts`**

```typescript
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function formatZodError(
  error: { issues: Array<{ path: Array<string | number>; message: string }> },
): string {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}
```

- [ ] **Step 2: 创建 `packages/shared/src/errors.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { formatZodError, ValidationError } from "./errors";

describe("errors", () => {
  it("creates ValidationError", () => {
    const error = new ValidationError("bad input");
    expect(error.name).toBe("ValidationError");
    expect(error.message).toBe("bad input");
  });

  it("formats zod issues", () => {
    const error = {
      issues: [
        { path: ["name"], message: "Required" },
        { path: ["age"], message: "Expected number" },
      ],
    };
    expect(formatZodError(error)).toBe("name: Required; age: Expected number");
  });
});
```

- [ ] **Step 3: 创建 `packages/shared/src/validate.ts`**

```typescript
import type { z } from "zod";
import { formatZodError, ValidationError } from "./errors";

export function parseRequest<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  payload: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ValidationError(formatZodError(result.error));
  }
  return result.data;
}
```

- [ ] **Step 4: 创建 `packages/shared/src/validate.test.ts`**

```typescript
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import { parseRequest } from "./validate";

describe("parseRequest", () => {
  const schema = z.object({ name: z.string(), count: z.number() });

  it("returns parsed data for valid input", () => {
    const result = parseRequest(schema, { name: "test", count: 1 });
    expect(result).toEqual({ name: "test", count: 1 });
  });

  it("throws ValidationError for invalid input", () => {
    expect(() => parseRequest(schema, { name: "test", count: "one" })).toThrow(ValidationError);
    expect(() => parseRequest(schema, { name: "test", count: "one" })).toThrow(
      "count: Expected number, received string",
    );
  });
});
```

- [ ] **Step 5: 运行测试**

Run: `cd packages/shared && bun test src/errors.test.ts src/validate.test.ts`

Expected: PASS，覆盖率 100%。

- [ ] **Step 6: 更新 `packages/shared/src/index.ts`**

```typescript
export * from "./errors";
export * from "./validate";
```

- [ ] **Step 7: 提交**

```bash
git add packages/shared

git commit -m "feat(shared): add shared validation error and parseRequest helpers"
```

---

### Task 7: 最终验证与文档同步

> Covers: 所有验收标准的端到端验证

**Files:**
- Modify: `packages/shared/src/index.ts`（最终确认导出完整）
- Modify: `tickets/003-定义dynamodb单表实体schema与cursor工具/ticket.md`（如需补充备注）

**Interfaces:**
- Produces: 通过 `bun test`、`bun check`、`bun typecheck` 的完整共享包。

- [ ] **Step 1: 确认 `packages/shared/src/index.ts` 完整导出**

```typescript
export { buildResponse, errorResponse, type ApiResponse } from "./response";
export * from "./schema/common";
export * from "./schema/users";
export * from "./schema/lists";
export * from "./schema/tasks";
export * from "./schema/reminders";
export * from "./schema/notifications";
export * from "./cursor";
export * from "./errors";
export * from "./validate";
```

- [ ] **Step 2: 运行完整验证序列**

Run:

```bash
bun install --registry https://registry.npmmirror.com
bun check
bun typecheck
bun test
```

Expected:
- `bun install` 成功。
- `bun check` 成功。
- `bun typecheck` 成功。
- `bun test` 所有测试通过，覆盖率 100%。

- [ ] **Step 3: 检查导入一致性**

在 `apps/api` 或 `apps/web` 中临时导入共享 schema：

```typescript
import { listInputSchema } from "@lyco/shared";
```

运行 `bun typecheck` 应通过。

- [ ] **Step 4: 提交最终文档**

```bash
git add -A

git commit -m "chore(shared): finalize shared schema exports and index"
```

---

## Self-Review

### 1. Ticket coverage

- Scenario 1（验证实体 schema）→ Task 1–4、6。
- Scenario 2（DynamoDB Key 编码为 Cursor）→ Task 5。
- Scenario 3（Cursor 解码回 DynamoDB Key）→ Task 5。
- 共享错误响应与请求校验 → Task 6。

### 2. Placeholder scan

计划无 `TBD`、`TODO`、`implement later`、`fill in details` 或类似模糊描述；每个步骤包含实际代码或命令。

### 3. Type consistency

- `ListInput` / `ListUpdate` / `List` 在 `schema/lists/index.ts` 中定义，导出名称一致。
- `TaskInput` / `TaskUpdate` / `Task` / `MoveTaskInput` 在 `schema/tasks/index.ts` 中定义，导出名称一致。
- `ReminderInput` / `ReminderUpdate` / `Reminder` 在 `schema/reminders/index.ts` 中定义，导出名称一致。
- `Notification` / `NotificationType` / `MarkNotificationReadInput` 在 `schema/notifications/index.ts` 中定义，导出名称一致。
- `encodeCursor` / `decodeCursor` / `CursorError` / `CursorKey` 在 `cursor.ts` 中定义，导出名称一致。
- `ValidationError` / `formatZodError` / `parseRequest` 在 `errors.ts` / `validate.ts` 中定义，导出名称一致。

### 4. Plan reliability

所有任务依赖顺序合理：Task 1（通用 helper）→ Task 2（List/User）→ Task 3（Task）→ Task 4（Reminder/Notification）→ Task 5（Cursor）→ Task 6（Errors/Validate）→ Task 7（最终验证）。每个 schema 文件相互独立，仅共享 `common` helper。cursor 工具通过单元测试覆盖 DynamoDB `LastEvaluatedKey` 形状的对象，验证 JSON + base64url 编解码的正确性。本 ticket 不引入外部数据库或 DynamoDB Local 运行实例。

---

## Execution Handoff

Plan complete and saved to `tickets/003-定义dynamodb单表实体schema与cursor工具/plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach would you like?
