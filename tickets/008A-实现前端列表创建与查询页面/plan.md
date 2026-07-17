# 实现前端列表创建与查询页面 Implementation Plan

> Ticket: `tickets/008A-实现前端列表创建与查询页面/ticket.md`
> Plan: `tickets/008A-实现前端列表创建与查询页面/plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `apps/web` 中实现侧边栏展示智能列表与自定义列表、"新建列表"弹窗、列表设置入口，并通过 TanStack Query 调用后端 `/api/lists`。

**Architecture:** 新增 `@tanstack/react-query` 作为数据层，`apps/web/src/lib/lists.ts` 封装 `apiClient` 调用，`apps/web/src/hooks/use-lists.ts` 暴露 query/mutation。`Sidebar` 组件负责展示智能列表和自定义列表，`NewListDialog` 负责创建，`ListSettingsMenu` 提供编辑/删除入口（具体弹窗在 008B/008C 实现）。组件使用 shadcn/ui 的 Dialog / DropdownMenu / Input / Label / Sonner。

## Global Constraints

- **Tech stack:** React 19, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query, `lucide-react`。
- **API base:** `apiClient` 已存在，自动注入 `Authorization: Bearer`。
- **共享类型：** 复用 `@lyco/shared` 的 `List`、`ListInput` 类型，不在前端重复定义。
- **智能列表：** 今天、计划、全部、已标记、已完成、分配给我；本期仅做静态导航入口，不实现过滤逻辑。
- **覆盖率：** statements / branches / functions / lines 均 100%。
- **提交规范：** 约定式提交，全英文小写祈使句，末尾不加句号。

---

## Task 1: Add dependencies and shadcn components

> Covers: 无单独验收场景；属于前置依赖。

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/components/ui/dialog.tsx`
- Create: `apps/web/src/components/ui/dropdown-menu.tsx`
- Create: `apps/web/src/components/ui/input.tsx`
- Create: `apps/web/src/components/ui/label.tsx`
- Create: `apps/web/src/components/ui/sonner.tsx`

**Interfaces:**
- Produces: `@tanstack/react-query`、`lucide-react`、`sonner`、`@radix-ui/*` 已安装；基础 UI 组件可用。

- [ ] **Step 1: Install dependencies**

```bash
bun add @tanstack/react-query lucide-react sonner --cwd apps/web --registry https://registry.npmmirror.com
```

- [ ] **Step 2: Install shadcn components**

```bash
cd apps/web
bunx shadcn@latest add dialog dropdown-menu input label sonner
```

- [ ] **Step 3: Verify lockfile and typecheck**

Run:
```bash
bun install --registry https://registry.npmmirror.com
bunx tsc --noEmit -p apps/web/tsconfig.app.json
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json bun.lock apps/web/src/components/ui/
bunx @biomejs/biome check --write
bunx tsc --noEmit -p apps/web/tsconfig.app.json
git commit -m "chore(web): add react-query, lucide-react, sonner and shadcn components"
```

---

## Task 2: Setup QueryClient provider and test wrapper

> Covers: 无单独验收场景；为后续 hooks / 组件测试提供统一 QueryClient 环境。

**Files:**
- Create: `apps/web/src/lib/query-client.ts`
- Create: `apps/web/src/lib/test-utils.tsx`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Produces: `queryClient` 单例；`renderWithQuery` 测试 helper；根组件包裹 `QueryClientProvider`。

- [ ] **Step 1: Write the failing test for provider setup**

创建 `apps/web/src/lib/query-client.test.ts`：

```typescript
import { describe, expect, it } from "vitest";
import { queryClient } from "./query-client.js";

describe("queryClient", () => {
  it("is configured with retry disabled by default", () => {
    expect(queryClient).toBeDefined();
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(false);
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --project apps/web src/lib/query-client.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal implementation**

创建 `apps/web/src/lib/query-client.ts`：

```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
    },
    mutations: {
      retry: false,
    },
  },
});
```

创建 `apps/web/src/lib/test-utils.tsx`：

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function renderWithQuery(ui: React.ReactElement) {
  const client = createTestQueryClient();
  return {
    ...render(
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
    ),
    client,
  };
}
```

修改 `apps/web/src/main.tsx`，在 `RouterProvider` 外层包裹 `QueryClientProvider`：

```typescript
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/query-client.js";

// ... existing imports ...

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- --project apps/web src/lib/query-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/query-client.ts apps/web/src/lib/query-client.test.ts apps/web/src/lib/test-utils.tsx apps/web/src/main.tsx
bunx @biomejs/biome check --write
bun run test -- --project apps/web src/lib/query-client.test.ts
bunx tsc --noEmit -p apps/web/tsconfig.app.json
git commit -m "feat(web): setup tanstack query provider and test wrapper"
```

---

## Task 3: Create list API module

> Covers: 场景 3（创建列表 API 调用）、场景 1（查询列表 API 调用）。

**Files:**
- Create: `apps/web/src/lib/lists.ts`
- Create: `apps/web/src/lib/lists.test.ts`

**Interfaces:**
- Consumes: `apiClient` from `@/lib/api`；`List`、`ListInput` from `@lyco/shared`。
- Produces: `fetchLists(cursor?, limit?) -> { items: List[]; nextCursor? }`、`createList(input) -> List`。

- [ ] **Step 1: Write the failing test**

创建 `apps/web/src/lib/lists.test.ts`：

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./api.js";
import { createList, fetchLists } from "./lists.js";

const { mockApiClient } = vi.hoisted(() => ({ mockApiClient: vi.fn() }));

vi.mock("./api.js", () => ({
  apiClient: mockApiClient,
}));

describe("fetchLists", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("fetches lists with default limit", async () => {
    mockApiClient.mockResolvedValueOnce({
      items: [{ id: "1", name: "购物" }],
    });

    const result = await fetchLists();

    expect(mockApiClient).toHaveBeenCalledWith("/api/lists?limit=50");
    expect(result.items).toHaveLength(1);
  });

  it("passes cursor when provided", async () => {
    mockApiClient.mockResolvedValueOnce({ items: [] });
    await fetchLists("cursor-123");
    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/lists?limit=50&cursor=cursor-123",
    );
  });
});

describe("createList", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("posts list input to api", async () => {
    mockApiClient.mockResolvedValueOnce({ id: "2", name: "工作" });

    const result = await createList({
      name: "工作",
      color: "#ef4444",
      icon: "briefcase",
      order: 1,
    });

    expect(mockApiClient).toHaveBeenCalledWith("/api/lists", {
      method: "POST",
      body: JSON.stringify({
        name: "工作",
        color: "#ef4444",
        icon: "briefcase",
        order: 1,
      }),
    });
    expect(result.name).toBe("工作");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --project apps/web src/lib/lists.test.ts`
Expected: FAIL with exports not found.

- [ ] **Step 3: Write minimal implementation**

创建 `apps/web/src/lib/lists.ts`：

```typescript
import { apiClient } from "./api.js";
import type { List, ListInput } from "@lyco/shared";

export interface ListsResponse {
  items: List[];
  nextCursor?: string;
}

export async function fetchLists(
  cursor?: string,
  limit = 50,
): Promise<ListsResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) {
    params.set("cursor", cursor);
  }
  return apiClient(`/api/lists?${params.toString()}`);
}

export async function createList(input: ListInput): Promise<List> {
  return apiClient("/api/lists", {
    method: "POST",
    body: JSON.stringify(input),
  });
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
git commit -m "feat(web): add list api client wrappers"
```

---

## Task 4: Create list query and mutation hooks

> Covers: 场景 1（查询缓存）、场景 3（创建成功后刷新缓存）。

**Files:**
- Create: `apps/web/src/hooks/use-lists.ts`
- Create: `apps/web/src/hooks/use-lists.test.tsx`

**Interfaces:**
- Consumes: `fetchLists`、`createList` from `@/lib/lists`。
- Produces: `useListsQuery()`、`useCreateListMutation()`。

- [ ] **Step 1: Write the failing test**

创建 `apps/web/src/hooks/use-lists.test.tsx`：

```typescript
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createList, fetchLists } from "@/lib/lists.js";
import { renderWithQuery } from "@/lib/test-utils.js";
import { useCreateListMutation, useListsQuery } from "./use-lists.js";

const { mockFetchLists, mockCreateList } = vi.hoisted(() => ({
  mockFetchLists: vi.fn(),
  mockCreateList: vi.fn(),
}));

vi.mock("@/lib/lists.js", () => ({
  fetchLists: mockFetchLists,
  createList: mockCreateList,
}));

describe("useListsQuery", () => {
  beforeEach(() => {
    mockFetchLists.mockReset();
  });

  it("returns lists on success", async () => {
    mockFetchLists.mockResolvedValueOnce({
      items: [{ id: "1", name: "购物" }],
    });

    const { result } = renderHook(() => useListsQuery(), {
      wrapper: renderWithQuery,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
  });

  it("returns error state on failure", async () => {
    mockFetchLists.mockRejectedValueOnce(new Error("network error"));

    const { result } = renderHook(() => useListsQuery(), {
      wrapper: renderWithQuery,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("network error");
  });
});

describe("useCreateListMutation", () => {
  beforeEach(() => {
    mockFetchLists.mockReset();
    mockCreateList.mockReset();
  });

  it("invalidates lists query on success", async () => {
    mockCreateList.mockResolvedValueOnce({ id: "2", name: "工作" });
    mockFetchLists
      .mockResolvedValueOnce({ items: [{ id: "1", name: "购物" }] })
      .mockResolvedValueOnce({
        items: [
          { id: "1", name: "购物" },
          { id: "2", name: "工作" },
        ],
      });

    const { result: queryResult } = renderHook(() => useListsQuery(), {
      wrapper: renderWithQuery,
    });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));

    const { result: mutationResult } = renderHook(
      () => useCreateListMutation(),
      { wrapper: renderWithQuery },
    );

    act(() => {
      mutationResult.current.mutate({
        name: "工作",
        color: "#ef4444",
        icon: "briefcase",
        order: 1,
      });
    });

    await waitFor(() => expect(mutationResult.current.isSuccess).toBe(true));
    expect(mockCreateList).toHaveBeenCalledWith({
      name: "工作",
      color: "#ef4444",
      icon: "briefcase",
      order: 1,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --project apps/web src/hooks/use-lists.test.tsx`
Expected: FAIL with exports not found.

- [ ] **Step 3: Write minimal implementation**

创建 `apps/web/src/hooks/use-lists.ts`：

```typescript
import { createList, fetchLists } from "@/lib/lists.js";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export const LISTS_QUERY_KEY = ["lists"];

export function useListsQuery() {
  return useQuery({
    queryKey: LISTS_QUERY_KEY,
    queryFn: () => fetchLists(),
  });
}

export function useCreateListMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createList,
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
git commit -m "feat(web): add list query and create mutation hooks"
```

---

## Task 5: Create Sidebar component

> Covers: 场景 1（展示自定义列表）、场景 2（展示智能列表）。

**Files:**
- Create: `apps/web/src/components/Sidebar.tsx`
- Create: `apps/web/src/components/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `useListsQuery` from `@/hooks/use-lists`；`ListSettingsMenu`（Task 6）和 `NewListDialog`（Task 7）将被集成。
- Produces: `Sidebar` 组件渲染智能列表与自定义列表。

- [ ] **Step 1: Write the failing test**

创建 `apps/web/src/components/Sidebar.test.tsx`：

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/lib/test-utils.js";
import { Sidebar } from "./Sidebar.js";

const { mockUseListsQuery } = vi.hoisted(() => ({
  mockUseListsQuery: vi.fn(),
}));

vi.mock("@/hooks/use-lists.js", () => ({
  useListsQuery: mockUseListsQuery,
  useCreateListMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

describe("Sidebar", () => {
  it("renders smart lists", () => {
    mockUseListsQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      error: null,
    });

    renderWithQuery(<Sidebar />);

    expect(screen.getByText("今天")).toBeInTheDocument();
    expect(screen.getByText("计划")).toBeInTheDocument();
    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("已标记")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(screen.getByText("分配给我")).toBeInTheDocument();
  });

  it("renders custom lists with name, color and settings", () => {
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

    expect(screen.getByText("购物")).toBeInTheDocument();
    expect(screen.getByLabelText("列表设置")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseListsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    renderWithQuery(<Sidebar />);

    expect(screen.getByText("加载中…")).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockUseListsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("boom"),
    });

    renderWithQuery(<Sidebar />);

    expect(screen.getByText("加载失败")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --project apps/web src/components/Sidebar.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal implementation**

创建 `apps/web/src/components/Sidebar.tsx`：

```typescript
import { useListsQuery } from "@/hooks/use-lists.js";
import {
  Calendar,
  CheckCircle,
  Circle,
  Flag,
  Inbox,
  List,
  Plus,
  User,
} from "lucide-react";
import { ListSettingsMenu } from "./ListSettingsMenu.js";
import { NewListDialog } from "./NewListDialog.js";

const SMART_LISTS = [
  { id: "today", name: "今天", icon: Calendar },
  { id: "scheduled", name: "计划", icon: Circle },
  { id: "all", name: "全部", icon: Inbox },
  { id: "flagged", name: "已标记", icon: Flag },
  { id: "completed", name: "已完成", icon: CheckCircle },
  { id: "assigned", name: "分配给我", icon: User },
];

export function Sidebar() {
  const { data, isLoading, error } = useListsQuery();

  return (
    <aside className="w-64 border-r border-slate-200 bg-white p-4">
      <h2 className="mb-4 px-3 text-lg font-semibold">LyCo-list</h2>
      <nav className="space-y-1">
        {SMART_LISTS.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-slate-100"
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </a>
        ))}
      </nav>
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
                onEdit={() => {}}
                onDelete={() => {}}
              />
            </li>
          ))}
        </ul>
        <div className="mt-2">
          <NewListDialog />
        </div>
      </div>
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
git commit -m "feat(web): add sidebar with smart and custom lists"
```

---

## Task 6: Create ListSettingsMenu component

> Covers: 场景 5（自定义列表设置入口）。

**Files:**
- Create: `apps/web/src/components/ListSettingsMenu.tsx`
- Create: `apps/web/src/components/ListSettingsMenu.test.tsx`

**Interfaces:**
- Consumes: `List` type from `@lyco/shared`；shadcn DropdownMenu。
- Produces: `ListSettingsMenu` 组件，暴露 `onEdit(list)` / `onDelete(list)` 回调。

- [ ] **Step 1: Write the failing test**

创建 `apps/web/src/components/ListSettingsMenu.test.tsx`：

```typescript
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { List } from "@lyco/shared";
import { ListSettingsMenu } from "./ListSettingsMenu.js";

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

describe("ListSettingsMenu", () => {
  it("triggers onEdit when edit is clicked", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <ListSettingsMenu list={mockList} onEdit={onEdit} onDelete={onDelete} />,
    );

    fireEvent.click(screen.getByLabelText("列表设置"));
    fireEvent.click(screen.getByText("编辑"));

    expect(onEdit).toHaveBeenCalledWith(mockList);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("triggers onDelete when delete is clicked", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <ListSettingsMenu list={mockList} onEdit={onEdit} onDelete={onDelete} />,
    );

    fireEvent.click(screen.getByLabelText("列表设置"));
    fireEvent.click(screen.getByText("删除"));

    expect(onDelete).toHaveBeenCalledWith(mockList);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --project apps/web src/components/ListSettingsMenu.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal implementation**

创建 `apps/web/src/components/ListSettingsMenu.tsx`：

```typescript
import type { List } from "@lyco/shared";
import { MoreHorizontal, Pencil, Trash } from "lucide-react";
import { Button } from "./ui/button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu.js";

export interface ListSettingsMenuProps {
  list: List;
  onEdit: (list: List) => void;
  onDelete: (list: List) => void;
}

export function ListSettingsMenu({
  list,
  onEdit,
  onDelete,
}: ListSettingsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="列表设置">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(list)}>
          <Pencil className="mr-2 h-4 w-4" />
          编辑
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDelete(list)}>
          <Trash className="mr-2 h-4 w-4" />
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- --project apps/web src/components/ListSettingsMenu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ListSettingsMenu.tsx apps/web/src/components/ListSettingsMenu.test.tsx
bunx @biomejs/biome check --write
bun run test -- --project apps/web src/components/ListSettingsMenu.test.tsx
bunx tsc --noEmit -p apps/web/tsconfig.app.json
git commit -m "feat(web): add list settings menu with edit and delete entries"
```

---

## Task 7: Create NewListDialog component

> Covers: 场景 3（创建列表）、场景 4（创建失败提示）。

**Files:**
- Create: `apps/web/src/components/NewListDialog.tsx`
- Create: `apps/web/src/components/NewListDialog.test.tsx`

**Interfaces:**
- Consumes: `useCreateListMutation` from `@/hooks/use-lists`；shadcn Dialog / Input / Label / Button。
- Produces: `NewListDialog` 组件；创建成功后关闭弹窗、清空表单、刷新列表缓存。

- [ ] **Step 1: Write the failing test**

创建 `apps/web/src/components/NewListDialog.test.tsx`：

```typescript
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/lib/test-utils.js";
import { NewListDialog } from "./NewListDialog.js";

const { mockUseCreateListMutation } = vi.hoisted(() => ({
  mockUseCreateListMutation: vi.fn(),
}));

vi.mock("@/hooks/use-lists.js", () => ({
  useCreateListMutation: mockUseCreateListMutation,
  useListsQuery: () => ({
    data: { items: [] },
    isLoading: false,
    error: null,
  }),
}));

describe("NewListDialog", () => {
  it("creates a list when form is submitted", async () => {
    const mutate = vi.fn((_input, options) => {
      options?.onSuccess?.();
    });
    mockUseCreateListMutation.mockReturnValue({
      mutate,
      isPending: false,
      error: null,
    });

    renderWithQuery(<NewListDialog />);

    fireEvent.click(screen.getByText("新建列表"));
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "购物" },
    });
    fireEvent.click(screen.getByText("创建"));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "购物" }),
      expect.any(Object),
    );
  });

  it("does not submit when name is empty", async () => {
    const mutate = vi.fn();
    mockUseCreateListMutation.mockReturnValue({
      mutate,
      isPending: false,
      error: null,
    });

    renderWithQuery(<NewListDialog />);

    fireEvent.click(screen.getByText("新建列表"));
    fireEvent.click(screen.getByText("创建"));

    expect(mutate).not.toHaveBeenCalled();
  });

  it("displays error message on failure", () => {
    mockUseCreateListMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: new Error("创建失败"),
    });

    renderWithQuery(<NewListDialog />);

    fireEvent.click(screen.getByText("新建列表"));
    expect(screen.getByText("创建失败")).toBeInTheDocument();
  });

  it("disables submit while pending", () => {
    mockUseCreateListMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      error: null,
    });

    renderWithQuery(<NewListDialog />);

    fireEvent.click(screen.getByText("新建列表"));
    expect(screen.getByText("创建")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --project apps/web src/components/NewListDialog.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal implementation**

创建 `apps/web/src/components/NewListDialog.tsx`：

```typescript
import { Button } from "@/components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { useCreateListMutation } from "@/hooks/use-lists.js";
import { Plus } from "lucide-react";
import { useState } from "react";

export function NewListDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [icon, setIcon] = useState("list");
  const { mutate, isPending, error } = useCreateListMutation();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    mutate(
      { name: trimmed, color, icon, order: 0 },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setColor("#3b82f6");
          setIcon("list");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2 px-3">
          <Plus className="h-4 w-4" />
          新建列表
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建列表</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="list-name">名称</Label>
            <Input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="列表名称"
            />
          </div>
          <div>
            <Label htmlFor="list-color">颜色</Label>
            <Input
              id="list-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="list-icon">图标</Label>
            <Input
              id="list-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="list"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error.message}</p>
          )}
          <Button type="submit" disabled={isPending || !name.trim()}>
            创建
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- --project apps/web src/components/NewListDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/NewListDialog.tsx apps/web/src/components/NewListDialog.test.tsx
bunx @biomejs/biome check --write
bun run test -- --project apps/web src/components/NewListDialog.test.tsx
bunx tsc --noEmit -p apps/web/tsconfig.app.json
git commit -m "feat(web): add new list dialog with validation and error state"
```

---

## Task 8: Integrate Sidebar into App layout

> Covers: 场景 1-5 的最终 UI 集成。

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/index.css`（可选，若需要侧边栏高度样式）

**Interfaces:**
- Consumes: `Sidebar` 组件。
- Produces: 全局布局包含左侧边栏 + 右侧主内容区。

- [ ] **Step 1: Update App layout**

修改 `apps/web/src/App.tsx`：

```typescript
import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./components/Sidebar.js";

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify existing route tests still pass**

Run:
```bash
bun run test -- --project apps/web
```
Expected: all existing tests pass；若 `App.tsx` 无独立测试，通过现有路由/组件测试间接覆盖。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx
bunx @biomejs/biome check --write
bun run test -- --project apps/web
bunx tsc --noEmit -p apps/web/tsconfig.app.json
git commit -m "feat(web): integrate sidebar into app layout"
```

---

## Task 9: Verify full suite and integration

> Covers: 全部验收标准的最终验证。

**Files:**
- 不新增文件；只运行命令。

- [ ] **Step 1: Run full monorepo test suite with coverage**

Run: `bun run test`
Expected: all projects pass, coverage thresholds 100%.

- [ ] **Step 2: Run typecheck**

Run:
```bash
bunx tsc --noEmit -p apps/web/tsconfig.app.json
bunx tsc --noEmit -p apps/web/tsconfig.node.json
bunx tsc --noEmit -p packages/shared/tsconfig.json
bunx tsc --noEmit -p apps/api/tsconfig.json
```
Expected: no errors.

- [ ] **Step 3: Run Biome check**

Run: `bunx @biomejs/biome check`
Expected: no errors.

- [ ] **Step 4: Commit if any fixes**

```bash
# 仅当 Step 1-3 中发现并修复了问题时提交
git add -A
bunx @biomejs/biome check --write
bun run test
bunx tsc --noEmit -p apps/web/tsconfig.app.json
git commit -m "fix(web): address review and coverage gaps in list sidebar"
```

---

## Self-Review

**1. Ticket coverage:**
- 场景 1 展示自定义列表 → Task 5 Sidebar。
- 场景 2 展示智能列表 → Task 5 Sidebar SMART_LISTS。
- 场景 3 创建列表 → Task 4 mutation + Task 7 NewListDialog。
- 场景 4 创建失败提示 → Task 7 error 展示。
- 场景 5 列表设置入口 → Task 6 ListSettingsMenu。
- 无遗漏。

**2. Placeholder scan:**
- 无 "TBD"/"TODO"；所有步骤含具体代码与命令；无模糊描述。

**3. Type consistency:**
- `ListInput` / `List` 均来自 `@lyco/shared`。
- `fetchLists` 返回 `{ items: List[]; nextCursor? }`。
- `useCreateListMutation` 使用 `ListInput`。

**4. Plan reliability:**
- 依赖 008 后端 API；plan 假设 `/api/lists` 已按 008 实现。
- 依赖 004（前端骨架）、005（认证回调）已完成；`apiClient` 已存在。
- 新增依赖与 shadcn 组件均给出安装命令。
- 无隐藏假设。

---

## Sync Back to Ticket and Source

无需修改 `ticket.md` 或设计文档：本 plan 完全遵循 ticket 范围与设计文档的前端 UI 结构。

---

## Execution Handoff

**Plan complete and saved to `tickets/008A-实现前端列表创建与查询页面/plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints

**Which approach?**
