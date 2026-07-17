# 实现前端列表编辑页面 Implementation Plan

> Ticket: `tickets/008B-实现前端列表编辑页面/ticket.md`
> Plan: `tickets/008B-实现前端列表编辑页面/plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `apps/web` 中实现列表编辑弹窗，从 008A 侧边栏的"列表设置"菜单进入，调用 `PATCH /api/lists/{id}` 并处理 `409` 版本冲突。

**Architecture:** 扩展 `apps/web/src/lib/lists.ts` 新增 `updateList`；扩展 `apps/web/src/hooks/use-lists.ts` 新增 `useUpdateListMutation`；创建 `EditListDialog` 组件；修改 `Sidebar` 将"编辑"回调与弹窗绑定。为准确识别 `409`，同步增强 `apiClient` 抛出结构化 `ApiError`。

## Global Constraints

- **Tech stack:** React 19, TypeScript, TanStack Query, shadcn/ui Dialog / Input / Label / Button。
- **共享类型：** 复用 `@lyco/shared` 的 `List`、`ListUpdate` 类型。
- **冲突提示：** 收到 `409` 时向用户显示"数据已过期，请刷新后重试"。
- **校验：** 名称为空或颜色格式非法时阻止提交并显示校验错误。
- **覆盖率：** statements / branches / functions / lines 均 100%。
- **提交规范：** 约定式提交，全英文小写祈使句，末尾不加句号。

---

## Task 1: Enhance apiClient to expose HTTP status

> Covers: 场景 3（准确识别 409 并提示）。

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/api.test.ts`

**Interfaces:**
- Produces: `ApiError` class，带 `status` 和 `bodyText` 字段；`apiClient` 非 2xx 响应抛出 `ApiError`。

- [ ] **Step 1: Write the failing test**

在 `apps/web/src/lib/api.test.ts` 中追加（放到文件末尾，不影响既有测试）：

```typescript
import { ApiError } from "./api.js";

describe("ApiError", () => {
  it("exposes status and bodyText", () => {
    const error = new ApiError(409, '{"code":"CONFLICT"}', "conflict");
    expect(error.status).toBe(409);
    expect(error.bodyText).toBe('{"code":"CONFLICT"}');
    expect(error.message).toBe("conflict");
  });
});

describe("apiClient structured errors", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("throws ApiError with status on non-ok response", async () => {
    mockFetchAuthSession.mockResolvedValue({});
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => '{"code":"CONFLICT"}',
    });

    await expect(apiClient("/lists")).rejects.toBeInstanceOf(ApiError);
    await expect(apiClient("/lists")).rejects.toMatchObject({
      status: 409,
      bodyText: '{"code":"CONFLICT"}',
    });
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `bun run test -- --project apps/web src/lib/api.test.ts`
Expected: FAIL with `ApiError` not found.

- [ ] **Step 3: Write minimal implementation**

修改 `apps/web/src/lib/api.ts`，在文件顶部追加：

```typescript
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly bodyText: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
```

并将非 2xx 分支改为：

```typescript
if (!response.ok) {
  const bodyText = await response.text();
  throw new ApiError(
    response.status,
    bodyText,
    `API request failed: ${response.status} ${bodyText}`,
  );
}
```

- [ ] **Step 4: Run tests and adjust existing assertions**

Run: `bun run test -- --project apps/web src/lib/api.test.ts`
Expected: 既有 401 / 500 测试若按 message 断言仍通过；若不通过，将断言改为 `toBeInstanceOf(ApiError)` 或检查 message。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
bunx @biomejs/biome check --write
bun run test -- --project apps/web src/lib/api.test.ts
bunx tsc --noEmit -p apps/web/tsconfig.app.json
git commit -m "feat(web): expose http status in api client errors"
```

---

## Task 2: Add updateList API wrapper

> Covers: 场景 1、2、3 的 API 调用层。

**Files:**
- Modify: `apps/web/src/lib/lists.ts`
- Modify: `apps/web/src/lib/lists.test.ts`

**Interfaces:**
- Consumes: `apiClient`、`ApiError` from `@/lib/api`；`List`、`ListUpdate` from `@lyco/shared`。
- Produces: `updateList(id, body) -> List`，409 转换为中文提示错误。

- [ ] **Step 1: Write the failing test**

在 `apps/web/src/lib/lists.test.ts` 中追加：

```typescript
import { ApiError } from "./api.js";
import { updateList } from "./lists.js";

describe("updateList", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("patches list with expectedVersion", async () => {
    mockApiClient.mockResolvedValueOnce({ id: "1", name: "新名称", version: 2 });

    const result = await updateList("1", {
      name: "新名称",
      expectedVersion: 1,
    });

    expect(mockApiClient).toHaveBeenCalledWith("/api/lists/1", {
      method: "PATCH",
      body: JSON.stringify({ name: "新名称", expectedVersion: 1 }),
    });
    expect(result.version).toBe(2);
  });

  it("throws refresh-and-retry message on 409", async () => {
    mockApiClient.mockRejectedValueOnce(
      new ApiError(409, '{"code":"CONFLICT"}', "conflict"),
    );

    await expect(
      updateList("1", { name: "x", expectedVersion: 1 }),
    ).rejects.toThrow("数据已过期，请刷新后重试");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --project apps/web src/lib/lists.test.ts`
Expected: FAIL with `updateList` not found.

- [ ] **Step 3: Write minimal implementation**

修改 `apps/web/src/lib/lists.ts`，追加：

```typescript
import { ApiError } from "./api.js";
import type { ListUpdate } from "@lyco/shared";

export interface ListUpdateBody extends ListUpdate {
  expectedVersion: number;
}

export async function updateList(
  id: string,
  input: ListUpdateBody,
): Promise<List> {
  try {
    return await apiClient(`/api/lists/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error("数据已过期，请刷新后重试");
    }
    throw error;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- --project apps/web src/lib/lists.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/lists.ts apps/web/src/lib/lists.test.ts
bunx @biomejs/biome check --write
bun run test -- --project apps/web src/lib/lists.test.ts
bunx tsc --noEmit -p apps/web/tsconfig.app.json
git commit -m "feat(web): add update list api wrapper with 409 handling"
```

---

## Task 3: Add useUpdateListMutation hook

> Covers: 场景 1-3 的缓存刷新。

**Files:**
- Modify: `apps/web/src/hooks/use-lists.ts`
- Modify: `apps/web/src/hooks/use-lists.test.tsx`

**Interfaces:**
- Consumes: `updateList`、`ListUpdateBody` from `@/lib/lists`。
- Produces: `useUpdateListMutation()`。

- [ ] **Step 1: Write the failing test**

在 `apps/web/src/hooks/use-lists.test.tsx` 中追加：

```typescript
import { updateList } from "@/lib/lists.js";
import { useUpdateListMutation } from "./use-lists.js";

const { mockUpdateList } = vi.hoisted(() => ({
  mockUpdateList: vi.fn(),
}));

vi.mock("@/lib/lists.js", () => ({
  fetchLists: mockFetchLists,
  createList: mockCreateList,
  updateList: mockUpdateList,
}));

describe("useUpdateListMutation", () => {
  beforeEach(() => {
    mockFetchLists.mockReset();
    mockUpdateList.mockReset();
  });

  it("invalidates lists query on success", async () => {
    mockUpdateList.mockResolvedValueOnce({ id: "1", name: "新名称", version: 2 });
    mockFetchLists
      .mockResolvedValueOnce({ items: [{ id: "1", name: "旧名称" }] })
      .mockResolvedValueOnce({ items: [{ id: "1", name: "新名称" }] });

    const { result: queryResult } = renderHook(() => useListsQuery(), {
      wrapper: renderWithQuery,
    });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));

    const { result: mutationResult } = renderHook(
      () => useUpdateListMutation(),
      { wrapper: renderWithQuery },
    );

    act(() => {
      mutationResult.current.mutate({
        id: "1",
        input: { name: "新名称", expectedVersion: 1 },
      });
    });

    await waitFor(() => expect(mutationResult.current.isSuccess).toBe(true));
    expect(mockUpdateList).toHaveBeenCalledWith("1", {
      name: "新名称",
      expectedVersion: 1,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --project apps/web src/hooks/use-lists.test.tsx`
Expected: FAIL with `useUpdateListMutation` not found。

- [ ] **Step 3: Write minimal implementation**

修改 `apps/web/src/hooks/use-lists.ts`，追加：

```typescript
import { updateList, type ListUpdateBody } from "@/lib/lists.js";

export function useUpdateListMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ListUpdateBody }) =>
      updateList(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LISTS_QUERY_KEY });
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- --project apps/web src/hooks/use-lists.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-lists.ts apps/web/src/hooks/use-lists.test.tsx
bunx @biomejs/biome check --write
bun run test -- --project apps/web src/hooks/use-lists.test.tsx
bunx tsc --noEmit -p apps/web/tsconfig.app.json
git commit -m "feat(web): add update list mutation hook"
```

---

## Task 4: Create EditListDialog component

> Covers: 场景 1（编辑名称）、场景 2（编辑颜色/图标）、场景 3（409 提示）、场景 4（校验失败）。

**Files:**
- Create: `apps/web/src/components/EditListDialog.tsx`
- Create: `apps/web/src/components/EditListDialog.test.tsx`

**Interfaces:**
- Consumes: `List` from `@lyco/shared`；`useUpdateListMutation` from `@/hooks/use-lists`。
- Produces: `EditListDialog` 组件，受控 `open` / `onOpenChange`。

- [ ] **Step 1: Write the failing test**

创建 `apps/web/src/components/EditListDialog.test.tsx`：

```typescript
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/lib/test-utils.js";
import type { List } from "@lyco/shared";
import { EditListDialog } from "./EditListDialog.js";

const mockList: List = {
  id: "list-1",
  name: "购物",
  color: "#3b82f6",
  icon: "list",
  order: 0,
  version: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdBy: "u1",
  updatedBy: "u1",
};

const { mockUseUpdateListMutation } = vi.hoisted(() => ({
  mockUseUpdateListMutation: vi.fn(),
}));

vi.mock("@/hooks/use-lists.js", () => ({
  useUpdateListMutation: mockUseUpdateListMutation,
}));

describe("EditListDialog", () => {
  it("updates list name on submit", async () => {
    const mutate = vi.fn((_variables, options) => {
      options?.onSuccess?.();
    });
    mockUseUpdateListMutation.mockReturnValue({
      mutate,
      isPending: false,
      error: null,
    });

    render(
      renderWithQuery(
        <EditListDialog list={mockList} open={true} onOpenChange={() => {}} />,
      ).container,
    );

    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "新名称" },
    });
    fireEvent.click(screen.getByText("保存"));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate).toHaveBeenCalledWith(
      {
        id: "list-1",
        input: {
          name: "新名称",
          color: "#3b82f6",
          icon: "list",
          expectedVersion: 1,
        },
      },
      expect.any(Object),
    );
  });

  it("does not submit when name is empty", () => {
    const mutate = vi.fn();
    mockUseUpdateListMutation.mockReturnValue({
      mutate,
      isPending: false,
      error: null,
    });

    render(
      renderWithQuery(
        <EditListDialog list={mockList} open={true} onOpenChange={() => {}} />,
      ).container,
    );

    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByText("保存"));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText("名称不能为空")).toBeInTheDocument();
  });

  it("shows 409 conflict message", () => {
    mockUseUpdateListMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: new Error("数据已过期，请刷新后重试"),
    });

    render(
      renderWithQuery(
        <EditListDialog list={mockList} open={true} onOpenChange={() => {}} />,
      ).container,
    );

    expect(
      screen.getByText("数据已过期，请刷新后重试"),
    ).toBeInTheDocument();
  });

  it("disables submit while pending", () => {
    mockUseUpdateListMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      error: null,
    });

    render(
      renderWithQuery(
        <EditListDialog list={mockList} open={true} onOpenChange={() => {}} />,
      ).container,
    );

    expect(screen.getByText("保存")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --project apps/web src/components/EditListDialog.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal implementation**

创建 `apps/web/src/components/EditListDialog.tsx`：

```typescript
import { Button } from "@/components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { useUpdateListMutation } from "@/hooks/use-lists.js";
import type { List } from "@lyco/shared";
import { useState } from "react";

export interface EditListDialogProps {
  list: List;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditListDialog({
  list,
  open,
  onOpenChange,
}: EditListDialogProps) {
  const [name, setName] = useState(list.name);
  const [color, setColor] = useState(list.color);
  const [icon, setIcon] = useState(list.icon);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { mutate, isPending, error } = useUpdateListMutation();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError("名称不能为空");
      return;
    }
    setValidationError(null);

    mutate(
      {
        id: list.id,
        input: {
          name: trimmed,
          color,
          icon,
          expectedVersion: list.version,
        },
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑列表</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-list-name">名称</Label>
            <Input
              id="edit-list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="edit-list-color">颜色</Label>
            <Input
              id="edit-list-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="edit-list-icon">图标</Label>
            <Input
              id="edit-list-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
            />
          </div>
          {validationError && (
            <p className="text-sm text-red-600">{validationError}</p>
          )}
          {error && (
            <p className="text-sm text-red-600">{error.message}</p>
          )}
          <Button type="submit" disabled={isPending || !name.trim()}>
            保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- --project apps/web src/components/EditListDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/EditListDialog.tsx apps/web/src/components/EditListDialog.test.tsx
bunx @biomejs/biome check --write
bun run test -- --project apps/web src/components/EditListDialog.test.tsx
bunx tsc --noEmit -p apps/web/tsconfig.app.json
git commit -m "feat(web): add edit list dialog with validation and conflict handling"
```

---

## Task 5: Wire EditListDialog into Sidebar

> Covers: 场景 1-3 的入口与弹窗联动。

**Files:**
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/components/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `EditListDialog` from Task 4；`List` type。
- Produces: `Sidebar` 点击"编辑"后打开 `EditListDialog`。

- [ ] **Step 1: Update Sidebar tests**

在 `apps/web/src/components/Sidebar.test.tsx` 中：
1. 在 `vi.mock("@/hooks/use-lists.js", ...)` 里追加 `useUpdateListMutation: () => ({ mutate: vi.fn(), isPending: false, error: null })`。
2. 追加测试：

```typescript
it("opens edit dialog when edit is clicked", () => {
  mockUseListsQuery.mockReturnValue({
    data: {
      items: [
        {
          id: "list-1",
          name: "购物",
          color: "#3b82f6",
          icon: "list",
          order: 0,
          version: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          createdBy: "u1",
          updatedBy: "u1",
        },
      ],
    },
    isLoading: false,
    error: null,
  });

  renderWithQuery(<Sidebar />);

  fireEvent.click(screen.getByLabelText("列表设置"));
  fireEvent.click(screen.getByText("编辑"));

  expect(screen.getByText("编辑列表")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --project apps/web src/components/Sidebar.test.tsx`
Expected: FAIL because `EditListDialog` not yet imported / state not wired。

- [ ] **Step 3: Update Sidebar implementation**

修改 `apps/web/src/components/Sidebar.tsx`：

```typescript
import { useState } from "react";
import { EditListDialog } from "./EditListDialog.js";
```

在组件内新增状态：

```typescript
const [editingList, setEditingList] = useState<List | null>(null);
```

将 `ListSettingsMenu` 的 `onEdit` 改为：

```typescript
<ListSettingsMenu
  list={list}
  onEdit={setEditingList}
  onDelete={() => {}}
/>
```

在 `return` 末尾、关闭 `</aside>` 之前插入：

```typescript
{editingList && (
  <EditListDialog
    list={editingList}
    open={true}
    onOpenChange={(open) => {
      if (!open) setEditingList(null);
    }}
  />
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- --project apps/web src/components/Sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Sidebar.tsx apps/web/src/components/Sidebar.test.tsx
bunx @biomejs/biome check --write
bun run test -- --project apps/web src/components/Sidebar.test.tsx
bunx tsc --noEmit -p apps/web/tsconfig.app.json
git commit -m "feat(web): wire edit list dialog into sidebar"
```

---

## Task 6: Verify full suite

- [ ] **Step 1: Run full web test suite**

Run: `bun run test -- --project apps/web`
Expected: PASS, coverage 100%.

- [ ] **Step 2: Run typecheck and Biome**

Run:
```bash
bunx tsc --noEmit -p apps/web/tsconfig.app.json
bunx tsc --noEmit -p apps/web/tsconfig.node.json
bunx @biomejs/biome check
```
Expected: no errors.

- [ ] **Step 3: Commit if any fixes**

```bash
git add -A
bunx @biomejs/biome check --write
bun run test -- --project apps/web
bunx tsc --noEmit -p apps/web/tsconfig.app.json
git commit -m "fix(web): address review and coverage gaps in edit list flow"
```

---

## Self-Review

**1. Ticket coverage:**
- 场景 1 编辑名称 → Task 4。
- 场景 2 编辑颜色/图标 → Task 4。
- 场景 3 版本冲突 409 → Task 1 ApiError + Task 2 updateList + Task 4 提示。
- 场景 4 校验失败 → Task 4 名称/颜色校验。
- 无遗漏。

**2. Placeholder scan:**
- 无 "TBD"/"TODO"；所有步骤含具体代码与命令。

**3. Type consistency:**
- `ListUpdateBody` 扩展 `@lyco/shared` 的 `ListUpdate`。
- `useUpdateListMutation` 变量类型 `{ id: string; input: ListUpdateBody }`。
- `EditListDialogProps` 使用 `List`。

**4. Plan reliability:**
- 依赖 008A 已完成；本 plan 修改 008A 创建的 Sidebar / use-lists / lists 文件。
- `ApiError` 增强虽小，但是准确识别 409 的必要改动，且更新了对应测试。
- 无隐藏假设。

---

## Sync Back to Ticket and Source

无需修改 `ticket.md` 或设计文档：本 plan 完全遵循 ticket 范围。

---

## Execution Handoff

**Plan complete and saved to `tickets/008B-实现前端列表编辑页面/plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints

**Which approach?**
