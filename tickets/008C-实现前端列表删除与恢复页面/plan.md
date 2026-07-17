# 实现前端列表删除与恢复页面 Implementation Plan

> Ticket: `tickets/008C-实现前端列表删除与恢复页面/ticket.md`
> Plan: `tickets/008C-实现前端列表删除与恢复页面/plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `apps/web` 中实现列表删除二次确认弹窗、删除成功后显示带"撤销"按钮的 toast、点击撤销调用 `POST /api/lists/{id}/restore` 恢复列表，并处理 `409` 版本冲突。

**Architecture:** 扩展 `apps/web/src/lib/lists.ts` 新增 `deleteList`、`restoreList`；扩展 `use-lists.ts` 新增 `useDeleteListMutation`、`useRestoreListMutation`；创建 `DeleteListDialog` 组件处理二次确认；修改 `Sidebar` 管理删除状态、展示 `DeleteListDialog`、在删除成功后通过 `sonner` 显示可撤销 toast。撤销使用删除成功后返回的最新 `version` 作为 `expectedVersion`。

## Global Constraints

- **Tech stack:** React 19, TypeScript, TanStack Query, shadcn/ui Dialog / Button, `sonner`。
- **共享类型：** 复用 `@lyco/shared` 的 `List` 类型。
- **删除流程：** 二次确认 → `DELETE /api/lists/{id}?expectedVersion=x` → 成功后列表缓存失效、toast 显示"撤销"。
- **撤销流程：** toast 点击"撤销" → `POST /api/lists/{id}/restore` 携带删除后的 `version` → 成功后列表缓存失效。
- **冲突提示：** 删除/恢复收到 `409` 时显示"数据已过期，请刷新后重试"。
- **覆盖率：** statements / branches / functions / lines 均 100%。
- **提交规范：** 约定式提交，全英文小写祈使句，末尾不加句号。

---

## Task 1: Add deleteList and restoreList API wrappers

> Covers: 场景 1-4 的 API 调用层。

**Files:**
- Modify: `apps/web/src/lib/lists.ts`
- Modify: `apps/web/src/lib/lists.test.ts`

**Interfaces:**
- Consumes: `apiClient`、`ApiError` from `@/lib/api`。
- Produces: `deleteList(id, expectedVersion) -> List`、`restoreList(id, expectedVersion) -> List`，均将 `409` 转换为中文提示。

- [ ] **Step 1: Write the failing test**

在 `apps/web/src/lib/lists.test.ts` 中追加：

```typescript
import { deleteList, restoreList } from "./lists.js";

describe("deleteList", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("deletes list with expectedVersion", async () => {
    mockApiClient.mockResolvedValueOnce({
      id: "1",
      name: "购物",
      version: 2,
      deletedAt: "2026-01-02T00:00:00.000Z",
    });

    const result = await deleteList("1", 1);

    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/lists/1?expectedVersion=1",
      { method: "DELETE" },
    );
    expect(result.version).toBe(2);
  });

  it("throws refresh-and-retry message on 409", async () => {
    mockApiClient.mockRejectedValueOnce(
      new ApiError(409, '{"code":"CONFLICT"}', "conflict"),
    );

    await expect(deleteList("1", 1)).rejects.toThrow(
      "数据已过期，请刷新后重试",
    );
  });
});

describe("restoreList", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("restores list with expectedVersion", async () => {
    mockApiClient.mockResolvedValueOnce({ id: "1", name: "购物", version: 3 });

    const result = await restoreList("1", 2);

    expect(mockApiClient).toHaveBeenCalledWith("/api/lists/1/restore", {
      method: "POST",
      body: JSON.stringify({ expectedVersion: 2 }),
    });
    expect(result.version).toBe(3);
  });

  it("throws refresh-and-retry message on 409", async () => {
    mockApiClient.mockRejectedValueOnce(
      new ApiError(409, '{"code":"CONFLICT"}', "conflict"),
    );

    await expect(restoreList("1", 2)).rejects.toThrow(
      "数据已过期，请刷新后重试",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --project apps/web src/lib/lists.test.ts`
Expected: FAIL with exports not found.

- [ ] **Step 3: Write minimal implementation**

修改 `apps/web/src/lib/lists.ts`，追加：

```typescript
export async function deleteList(
  id: string,
  expectedVersion: number,
): Promise<List> {
  try {
    return await apiClient(`/api/lists/${id}?expectedVersion=${expectedVersion}`, {
      method: "DELETE",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error("数据已过期，请刷新后重试");
    }
    throw error;
  }
}

export async function restoreList(
  id: string,
  expectedVersion: number,
): Promise<List> {
  try {
    return await apiClient(`/api/lists/${id}/restore`, {
      method: "POST",
      body: JSON.stringify({ expectedVersion }),
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
git commit -m "feat(web): add delete and restore list api wrappers"
```

---

## Task 2: Add delete and restore mutations

> Covers: 场景 2-4 的缓存失效。

**Files:**
- Modify: `apps/web/src/hooks/use-lists.ts`
- Modify: `apps/web/src/hooks/use-lists.test.tsx`

**Interfaces:**
- Consumes: `deleteList`、`restoreList` from `@/lib/lists`。
- Produces: `useDeleteListMutation()`、`useRestoreListMutation()`。

- [ ] **Step 1: Write the failing test**

在 `apps/web/src/hooks/use-lists.test.tsx` 中：
1. 在 `vi.mock("@/lib/lists.js", ...)` 里追加 `mockDeleteList` 和 `mockRestoreList`。
2. 追加测试：

```typescript
const { mockDeleteList, mockRestoreList } = vi.hoisted(() => ({
  mockDeleteList: vi.fn(),
  mockRestoreList: vi.fn(),
}));

vi.mock("@/lib/lists.js", () => ({
  fetchLists: mockFetchLists,
  createList: mockCreateList,
  updateList: mockUpdateList,
  deleteList: mockDeleteList,
  restoreList: mockRestoreList,
}));

import { useDeleteListMutation, useRestoreListMutation } from "./use-lists.js";

describe("useDeleteListMutation", () => {
  beforeEach(() => {
    mockDeleteList.mockReset();
    mockFetchLists.mockReset();
  });

  it("invalidates lists query on success", async () => {
    mockDeleteList.mockResolvedValueOnce({ id: "1", version: 2 });
    mockFetchLists.mockResolvedValue({ items: [] });

    const { result } = renderHook(() => useDeleteListMutation(), {
      wrapper: renderWithQuery,
    });

    act(() => {
      result.current.mutate({ id: "1", expectedVersion: 1 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDeleteList).toHaveBeenCalledWith("1", 1);
  });
});

describe("useRestoreListMutation", () => {
  beforeEach(() => {
    mockRestoreList.mockReset();
    mockFetchLists.mockReset();
  });

  it("invalidates lists query on success", async () => {
    mockRestoreList.mockResolvedValueOnce({ id: "1", version: 3 });
    mockFetchLists.mockResolvedValue({ items: [{ id: "1" }] });

    const { result } = renderHook(() => useRestoreListMutation(), {
      wrapper: renderWithQuery,
    });

    act(() => {
      result.current.mutate({ id: "1", expectedVersion: 2 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRestoreList).toHaveBeenCalledWith("1", 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --project apps/web src/hooks/use-lists.test.tsx`
Expected: FAIL with exports not found.

- [ ] **Step 3: Write minimal implementation**

修改 `apps/web/src/hooks/use-lists.ts`，追加：

```typescript
import { deleteList, restoreList } from "@/lib/lists.js";

export function useDeleteListMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      expectedVersion,
    }: {
      id: string;
      expectedVersion: number;
    }) => deleteList(id, expectedVersion),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LISTS_QUERY_KEY });
    },
  });
}

export function useRestoreListMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      expectedVersion,
    }: {
      id: string;
      expectedVersion: number;
    }) => restoreList(id, expectedVersion),
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
git commit -m "feat(web): add delete and restore list mutation hooks"
```

---

## Task 3: Add Sonner Toaster provider

> Covers: toast 渲染基础。

**Files:**
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Produces: 全局 `<Toaster />` 挂载。

- [ ] **Step 1: Add Toaster to root**

修改 `apps/web/src/main.tsx`，在 `RouterProvider` 后追加 `<Toaster />`：

```typescript
import { Toaster } from "@/components/ui/sonner.js";

// ... inside render:
createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 2: Verify typecheck and tests**

Run:
```bash
bunx tsc --noEmit -p apps/web/tsconfig.app.json
bun run test -- --project apps/web src/lib/lists.test.ts src/hooks/use-lists.test.tsx
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/main.tsx
bunx @biomejs/biome check --write
bunx tsc --noEmit -p apps/web/tsconfig.app.json
git commit -m "feat(web): mount sonner toaster for undo notifications"
```

---

## Task 4: Create DeleteListDialog component

> Covers: 场景 1（二次确认）、场景 4（删除 409）。

**Files:**
- Create: `apps/web/src/components/DeleteListDialog.tsx`
- Create: `apps/web/src/components/DeleteListDialog.test.tsx`

**Interfaces:**
- Consumes: `List` from `@lyco/shared`；`useDeleteListMutation` from `@/hooks/use-lists`。
- Produces: `DeleteListDialog` 组件，确认后调用删除；通过 `onDeleted(deletedList)` 回调通知父级。

- [ ] **Step 1: Write the failing test**

创建 `apps/web/src/components/DeleteListDialog.test.tsx`：

```typescript
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/lib/test-utils.js";
import type { List } from "@lyco/shared";
import { DeleteListDialog } from "./DeleteListDialog.js";

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

const { mockUseDeleteListMutation } = vi.hoisted(() => ({
  mockUseDeleteListMutation: vi.fn(),
}));

vi.mock("@/hooks/use-lists.js", () => ({
  useDeleteListMutation: mockUseDeleteListMutation,
}));

describe("DeleteListDialog", () => {
  it("calls delete mutation on confirm and notifies parent", async () => {
    const onOpenChange = vi.fn();
    const onDeleted = vi.fn();
    const mutate = vi.fn((_variables, options) => {
      options?.onSuccess?.({ ...mockList, version: 2 });
    });
    mockUseDeleteListMutation.mockReturnValue({
      mutate,
      isPending: false,
      error: null,
    });

    render(
      renderWithQuery(
        <DeleteListDialog
          list={mockList}
          open={true}
          onOpenChange={onOpenChange}
          onDeleted={onDeleted}
        />,
      ).container,
    );

    fireEvent.click(screen.getByText("删除"));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate).toHaveBeenCalledWith(
      { id: "list-1", expectedVersion: 1 },
      expect.any(Object),
    );
    expect(onDeleted).toHaveBeenCalledWith(
      expect.objectContaining({ version: 2 }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not delete on cancel", () => {
    const mutate = vi.fn();
    mockUseDeleteListMutation.mockReturnValue({
      mutate,
      isPending: false,
      error: null,
    });

    render(
      renderWithQuery(
        <DeleteListDialog
          list={mockList}
          open={true}
          onOpenChange={() => {}}
          onDeleted={() => {}}
        />,
      ).container,
    );

    fireEvent.click(screen.getByText("取消"));
    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows 409 conflict message", () => {
    mockUseDeleteListMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: new Error("数据已过期，请刷新后重试"),
    });

    render(
      renderWithQuery(
        <DeleteListDialog
          list={mockList}
          open={true}
          onOpenChange={() => {}}
          onDeleted={() => {}}
        />,
      ).container,
    );

    expect(
      screen.getByText("数据已过期，请刷新后重试"),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --project apps/web src/components/DeleteListDialog.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal implementation**

创建 `apps/web/src/components/DeleteListDialog.tsx`：

```typescript
import { Button } from "@/components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.js";
import { useDeleteListMutation } from "@/hooks/use-lists.js";
import type { List } from "@lyco/shared";

export interface DeleteListDialogProps {
  list: List;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (list: List) => void;
}

export function DeleteListDialog({
  list,
  open,
  onOpenChange,
  onDeleted,
}: DeleteListDialogProps) {
  const { mutate, isPending, error } = useDeleteListMutation();

  function handleConfirm() {
    mutate(
      { id: list.id, expectedVersion: list.version },
      {
        onSuccess: (deletedList) => {
          onOpenChange(false);
          onDeleted(deletedList);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>删除列表</DialogTitle>
          <DialogDescription>
            确定要删除列表「{list.name}」吗？其中的任务将不再显示。
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-sm text-red-600">{error.message}</p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={isPending}
          >
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- --project apps/web src/components/DeleteListDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/DeleteListDialog.tsx apps/web/src/components/DeleteListDialog.test.tsx
bunx @biomejs/biome check --write
bun run test -- --project apps/web src/components/DeleteListDialog.test.tsx
bunx tsc --noEmit -p apps/web/tsconfig.app.json
git commit -m "feat(web): add delete list confirmation dialog"
```

---

## Task 5: Wire delete/restore flow into Sidebar

> Covers: 场景 1（打开确认）、场景 2（删除后隐藏）、场景 3（撤销恢复）、场景 4（409）。

**Files:**
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/components/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `DeleteListDialog` from Task 4；`useDeleteListMutation`、`useRestoreListMutation`；`sonner` `toast`。
- Produces: 点击"删除"打开确认弹窗；删除成功后显示可撤销 toast；撤销调用恢复 mutation。

- [ ] **Step 1: Update Sidebar tests**

在 `apps/web/src/components/Sidebar.test.tsx` 中：
1. 将 `vi.mock("@/hooks/use-lists.js", ...)` 扩展为包含 `useDeleteListMutation` 和 `useRestoreListMutation`。
2. 在文件顶部 mock `sonner`：

```typescript
const { mockToast } = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));
```

3. 追加/替换以下测试：

```typescript
it("opens delete dialog when delete is clicked", () => {
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
  fireEvent.click(screen.getByText("删除"));

  expect(screen.getByText("删除列表")).toBeInTheDocument();
});

```

由于 Sidebar 内部状态复杂，更严格的撤销测试通过单独测试辅助函数完成。为保持 100% 覆盖率，在 `Sidebar.tsx` 中提取并导出纯函数 `buildDeleteToastConfig(deletedList, restore)`，然后测试它。

在 `Sidebar.test.tsx` 中追加：

```typescript
import { buildDeleteToastConfig } from "./Sidebar.js";

describe("buildDeleteToastConfig", () => {
  it("configures undo action with restored version", () => {
    const restore = vi.fn();
    const config = buildDeleteToastConfig(
      { ...mockList, version: 2 },
      restore,
    );

    expect(config.duration).toBe(5000);
    expect(config.action?.label).toBe("撤销");

    config.action?.onClick?.();
    expect(restore).toHaveBeenCalledWith({ id: "list-1", version: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --project apps/web src/components/Sidebar.test.tsx`
Expected: FAIL with exports/state not wired.

- [ ] **Step 3: Update Sidebar implementation**

修改 `apps/web/src/components/Sidebar.tsx`：

```typescript
import { useState } from "react";
import { toast } from "sonner";
import { DeleteListDialog } from "./DeleteListDialog.js";
import {
  useDeleteListMutation,
  useListsQuery,
  useRestoreListMutation,
} from "@/hooks/use-lists.js";

export interface DeletedListMeta {
  id: string;
  version: number;
}

export function buildDeleteToastConfig(
  deletedList: List,
  onUndo: (meta: DeletedListMeta) => void,
) {
  return {
    duration: 5000,
    action: {
      label: "撤销",
      onClick: () =>
        onUndo({ id: deletedList.id, version: deletedList.version }),
    },
  };
}

export function Sidebar() {
  const { data, isLoading, error } = useListsQuery();
  const restoreMutation = useRestoreListMutation();
  const [deletingList, setDeletingList] = useState<List | null>(null);

  function handleDeleted(deletedList: List) {
    toast.success(
      `「${deletedList.name}」已删除`,
      buildDeleteToastConfig(deletedList, (meta) => {
        restoreMutation.mutate({
          id: meta.id,
          expectedVersion: meta.version,
        });
      }),
    );
  }

  return (
    <aside className="w-64 border-r border-slate-200 bg-white p-4">
      {/* ... 智能列表 ... */}
      <div className="mt-6">
        <h3 className="mb-2 px-3 text-xs font-semibold text-slate-500">
          我的列表
        </h3>
        {isLoading && (
          <p className="px-3 text-sm text-slate-500">加载中…</p>
        )}
        {error && (
          <p className="px-3 text-sm text-red-600">加载失败</p>
        )}
        <ul className="space-y-1">
          {data?.items.map((list) => (
            <li
              key={list.id}
              className="group flex items-center justify-between rounded-md px-3 py-2 hover:bg-slate-100"
            >
              <a
                href={`#list-${list.id}`}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: list.color }}
                />
                {list.name}
              </a>
              <ListSettingsMenu
                list={list}
                onEdit={setEditingList}
                onDelete={setDeletingList}
              />
            </li>
          ))}
        </ul>
        <div className="mt-2">
          <NewListDialog />
        </div>
      </div>
      {editingList && (
        <EditListDialog
          list={editingList}
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingList(null);
          }}
        />
      )}
      {deletingList && (
        <DeleteListDialog
          list={deletingList}
          open={true}
          onOpenChange={(open) => {
            if (!open) setDeletingList(null);
          }}
          onDeleted={handleDeleted}
        />
      )}
    </aside>
  );
}
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
git commit -m "feat(web): wire delete confirmation and undo toast into sidebar"
```

---

## Task 6: Verify full suite

- [ ] **Step 1: Run full web test suite with coverage**

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
git commit -m "fix(web): address review and coverage gaps in delete/restore flow"
```

---

## Self-Review

**1. Ticket coverage:**
- 场景 1 删除二次确认 → Task 4 DeleteListDialog。
- 场景 2 删除后隐藏 → Task 2/5 缓存失效。
- 场景 3 撤销恢复 → Task 1/2 restore + Task 5 toast action。
- 场景 4 版本冲突 409 → Task 1 wrappers + Task 4/5 错误展示。
- 测试要求中的"撤销超时" → Task 5 `buildDeleteToastConfig` 验证 duration。
- 无遗漏。

**2. Placeholder scan:**
- 无 "TBD"/"TODO"；所有步骤含具体代码与命令。

**3. Type consistency:**
- `deleteList` / `restoreList` 参数为 `(id, expectedVersion)`。
- `useDeleteListMutation` / `useRestoreListMutation` 变量类型一致。
- `DeletedListMeta` 包含 `id` 和恢复所需的 `version`。
- `buildDeleteToastConfig` 接收删除后的 `List`。

**4. Plan reliability:**
- 依赖 008A（Sidebar、ListSettingsMenu、hooks 结构）和 008B（EditListDialog、ApiError）。
- 删除成功后使用返回的 `version` 作为 restore 的 `expectedVersion`，与后端递增规则一致。
- toast duration 5000ms，撤销按钮过期后由 sonner 自动处理。
- 无隐藏假设。

---

## Sync Back to Ticket and Source

无需修改 `ticket.md` 或设计文档：本 plan 完全遵循 ticket 范围与设计文档的软删除/恢复规则。

---

## Execution Handoff

**Plan complete and saved to `tickets/008C-实现前端列表删除与恢复页面/plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints

**Which approach?**
