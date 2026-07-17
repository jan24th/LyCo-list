# 实现列表 CRUD、软删除和恢复 Implementation Plan

> Ticket: `tickets/008-实现列表crud软删除和恢复/ticket.md`
> Plan: `tickets/008-实现列表crud软删除和恢复/plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 在 `apps/api` 中实现 `lists` Lambda，暴露 `GET /api/lists`、`POST /api/lists`、`PATCH /api/lists/{id}`、`DELETE /api/lists/{id}`、`POST /api/lists/{id}/restore`，支持乐观并发 `expectedVersion`、软删除/恢复、分页 cursor，并达到 100% 测试覆盖率。

**Architecture:** 使用 `@aws-sdk/lib-dynamodb` 操作 DynamoDB 单表 `LycoTable`，列表以 `LIST#<id>` / `METADATA` 为主键、`LISTS` 为 GSI1PK 查询全部列表。数据层 `apps/api/src/lists/db.ts` 封装创建/查询/更新/删除/恢复，处理 `ConditionalCheckFailedException` 为 `ConflictError`；`index.ts` 做 HTTP 路由、请求校验与错误映射。测试采用 AWS SDK mock（按 ticket 说明当前环境先使用 mock，后续再迁移 DynamoDB Local）。

## Global Constraints

- **Runtime:** AWS Lambda `nodejs22.x`（设计文档注：待 SST v3 / AWS 区域支持 `nodejs24.x` 后统一升级）。
- **表名：** DynamoDB 单表名 `LycoTable`，GSI 名 `GSI1`。
- **版本号：** 创建时 `version = 1`；每次更新、软删除、恢复递增 1。
- **乐观并发：** 修改/删除/恢复携带 `expectedVersion`，不匹配返回 `409` `{ error, code: "CONFLICT" }`。
- **软删除：** 列表删除仅写入 `deletedAt` 并递增 `version`；本期不设置 `undoUntil`、`deletionVersion`，不创建 `DELETION_JOB`。
- **恢复：** 清除 `deletedAt` 并递增 `version`；本期不检查撤销期限、不返回 `410 GONE`。
- **分页：** `limit` 默认 50、最大 100；`nextCursor` 不透明，封装 DynamoDB `LastEvaluatedKey`。
- **审计字段：** `createdBy` / `updatedBy` 取 Cognito JWT `sub`。
- **覆盖率：** statements / branches / functions / lines 均 100%。
- **提交规范：** 约定式提交，全英文小写祈使句，末尾不加句号。

**Tech Stack:** Bun, TypeScript, AWS Lambda, API Gateway HTTP API v2, DynamoDB, SST v3, Zod, Vitest, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`.

---

## Task 1: Provision DynamoDB table and API routes

> Covers: 无单独验收场景，属于基础设施前置；支撑场景 1-7。

**Files:**
- Modify: `sst.config.ts`
- Modify: `apps/api/package.json`
- Modify: `package.json`（可选，若根目录未装 `@aws-sdk/client-dynamodb` / `@aws-sdk/lib-dynamodb`）

**Interfaces:**
- Produces: 环境变量 `TABLE_NAME` 注入 `lists` Lambda；DynamoDB 表 `LycoTable` 带 GSI1；API Gateway 路由绑定。

- [x] **Step 1: Add AWS SDK dependencies to `apps/api`**

```bash
bun add @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb --cwd apps/api --registry https://registry.npmmirror.com
```

- [x] **Step 2: Add DynamoDB table and list routes in `sst.config.ts`**

在 `sst.config.ts` 的 `run()` 中，在 `const api = new sst.aws.ApiGatewayV2(...)` 之后、`const web = ...` 之前插入：

```typescript
const table = new sst.aws.Dynamo("LycoTable", {
  fields: {
    PK: "string",
    SK: "string",
    GSI1PK: "string",
    GSI1SK: "string",
  },
  primaryIndex: { hashKey: "PK", rangeKey: "SK" },
  globalIndexes: {
    GSI1: { hashKey: "GSI1PK", rangeKey: "GSI1SK" },
  },
  ttl: "expiresAtEpoch",
});
```

然后在文件末尾、其他 `api.route(...)` 之后添加列表路由：

```typescript
const listHandler = {
  handler: "apps/api/src/lists/index.handler",
  runtime: "nodejs22.x",
  environment: {
    TABLE_NAME: table.name,
  },
  permissions: [
    {
      actions: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"],
      resources: [table.arn, $interpolate`${table.arn}/index/GSI1`],
    },
  ],
};

const listAuth = {
  auth: {
    jwt: {
      authorizer: cognitoAuthorizer.id,
    },
  },
};

api.route("GET /api/lists", listHandler, listAuth);
api.route("POST /api/lists", listHandler, listAuth);
api.route("ANY /api/lists/{proxy+}", listHandler, listAuth);
```

- [x] **Step 3: Verify SST config type-checks**

Run: `bunx tsc --noEmit -p apps/api/tsconfig.json`
Expected: no errors.

- [x] **Step 4: Commit**

```bash
git add sst.config.ts apps/api/package.json
bunx @biomejs/biome check --write
bunx tsc --noEmit -p apps/api/tsconfig.json
bun run test -- --project apps/api
# 此时 apps/api 没有 lists 测试，应 passWithNoTests
git commit -m "infra(api): add dynamodb table and lists lambda route"
```

---

## Task 2: Extend shared list schemas with expectedVersion

> Covers: 场景 6、场景 7（`expectedVersion` 校验）；间接支撑所有修改接口。

**Files:**
- Modify: `packages/shared/src/schema/lists/index.ts`

**Interfaces:**
- Consumes: `listUpdateSchema`（已存在）。
- Produces: `listUpdateBodySchema`、`listRestoreBodySchema`、`listDeleteQuerySchema` 及对应类型。

- [x] **Step 1: Write the failing test**

在 `packages/shared/src/schema/lists/index.test.ts` 创建文件（若不存在）：

```typescript
import { describe, expect, it } from "vitest";
import {
  listDeleteQuerySchema,
  listRestoreBodySchema,
  listUpdateBodySchema,
} from "./index.js";

describe("listUpdateBodySchema", () => {
  it("requires expectedVersion and allows partial list fields", () => {
    const result = listUpdateBodySchema.parse({
      name: "购物",
      expectedVersion: 2,
    });
    expect(result).toEqual({ name: "购物", expectedVersion: 2 });
  });

  it("rejects negative expectedVersion", () => {
    expect(() =>
      listUpdateBodySchema.parse({ expectedVersion: -1 }),
    ).toThrow();
  });

  it("rejects missing expectedVersion", () => {
    expect(() => listUpdateBodySchema.parse({ name: "购物" })).toThrow();
  });
});

describe("listRestoreBodySchema", () => {
  it("requires expectedVersion", () => {
    expect(listRestoreBodySchema.parse({ expectedVersion: 3 })).toEqual({
      expectedVersion: 3,
    });
  });

  it("rejects string expectedVersion", () => {
    expect(() =>
      listRestoreBodySchema.parse({ expectedVersion: "3" }),
    ).toThrow();
  });
});

describe("listDeleteQuerySchema", () => {
  it("coerces string expectedVersion", () => {
    expect(
      listDeleteQuerySchema.parse({ expectedVersion: "3" }),
    ).toEqual({ expectedVersion: 3 });
  });

  it("rejects missing expectedVersion", () => {
    expect(() => listDeleteQuerySchema.parse({})).toThrow();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun run test -- --project packages/shared src/schema/lists/index.test.ts`
Expected: FAIL with exports not found.

- [x] **Step 3: Write minimal implementation**

在 `packages/shared/src/schema/lists/index.ts` 末尾追加：

```typescript
export const listUpdateBodySchema = z.object({
  name: listBaseSchema.shape.name.optional(),
  color: listBaseSchema.shape.color.removeDefault().optional(),
  icon: listBaseSchema.shape.icon.removeDefault().optional(),
  order: listBaseSchema.shape.order.removeDefault().optional(),
  expectedVersion: z.number().int().nonnegative(),
});

export const listRestoreBodySchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});

export const listDeleteQuerySchema = z.object({
  expectedVersion: z.coerce.number().int().nonnegative(),
});

export type ListUpdateBody = z.infer<typeof listUpdateBodySchema>;
export type ListRestoreBody = z.infer<typeof listRestoreBodySchema>;
export type ListDeleteQuery = z.infer<typeof listDeleteQuerySchema>;
```

- [x] **Step 4: Run test to verify it passes**

Run: `bun run test -- --project packages/shared src/schema/lists/index.test.ts`
Expected: PASS.

- [x] **Step 5: Run full shared suite and typecheck**

Run:
```bash
bun run test -- --project packages/shared
bunx tsc --noEmit -p packages/shared/tsconfig.json
```
Expected: all pass, coverage 100%.

- [x] **Step 6: Commit**

```bash
git add packages/shared/src/schema/lists/index.ts packages/shared/src/schema/lists/index.test.ts
bunx @biomejs/biome check --write
bun run test -- --project packages/shared
bunx tsc --noEmit -p packages/shared/tsconfig.json
git commit -m "feat(shared): add expectedVersion schemas for list mutations"
```

---

## Task 3: Build DynamoDB repository

> Covers: 场景 1（创建）、场景 2（查询分页）、场景 3（软删除）、场景 4（过滤）、场景 5（恢复）、场景 6/7（版本冲突底层）。

**Files:**
- Create: `apps/api/src/lists/client.ts`
- Create: `apps/api/src/lists/client.test.ts`
- Create: `apps/api/src/lists/db.ts`
- Create: `apps/api/src/lists/db.test.ts`

**Interfaces:**
- Consumes: `listInputSchema`, `listUpdateSchema` 类型（`ListInput`, `ListUpdate`），`encodeCursor`/`decodeCursor`（仅测试用），`formatOrderKey`。
- Produces: `createList(input, metadata) -> List`, `queryActiveLists(limit = 50, cursor?) -> { items, nextCursor? }`（服务层将 `limit` clamp 到 [1, 100]）, `updateList(id, input, expectedVersion, userId, now) -> List`, `deleteList(id, expectedVersion, userId, now) -> List`, `restoreList(id, expectedVersion, userId, now) -> List`, plus `NotFoundError` / `ConflictError`。

- [x] **Step 1: Write the repository implementation first (this is the core file)**

创建 `apps/api/src/lists/client.ts`：

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const documentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({}),
);
```

创建 `apps/api/src/lists/db.ts`：

```typescript
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  type QueryCommandOutput,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  type CursorKey,
  type List,
  type ListInput,
  type ListUpdate,
  formatOrderKey,
  listSchema,
} from "@lyco/shared";
import { documentClient } from "./client.js";

function getTableName(): string {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error("TABLE_NAME environment variable is not set");
  }
  return tableName;
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

function buildKeys(id: string) {
  return { PK: `LIST#${id}`, SK: "METADATA" };
}

function buildGsi(list: List) {
  return {
    GSI1PK: "LISTS",
    GSI1SK: `ORDER#${formatOrderKey(list.order)}#LIST#${list.id}`,
  };
}

function toRecord(list: List): Record<string, unknown> {
  return {
    ...buildKeys(list.id),
    ...buildGsi(list),
    entityType: "LIST",
    ...list,
  };
}

function toList(item: Record<string, unknown>): List | null {
  const parsed = listSchema.safeParse(item);
  return parsed.success ? parsed.data : null;
}

export async function createList(
  input: ListInput,
  metadata: { id: string; userId: string; now: string },
): Promise<List> {
  const list: List = {
    ...input,
    id: metadata.id,
    version: 1,
    createdAt: metadata.now,
    updatedAt: metadata.now,
    createdBy: metadata.userId,
    updatedBy: metadata.userId,
  };

  await documentClient.send(
    new PutCommand({
      TableName: getTableName(),
      Item: toRecord(list),
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );

  return list;
}

export async function queryActiveLists(
  limit = 50,
  cursor?: CursorKey,
): Promise<{ items: List[]; nextCursor?: CursorKey }> {
  const effectiveLimit = Math.min(Math.max(limit, 1), 100);
  const items: List[] = [];
  let lastEvaluatedKey: CursorKey | undefined = cursor;
  let hasMore = true;

  while (hasMore && items.length < effectiveLimit) {
    const response: QueryCommandOutput = await documentClient.send(
      new QueryCommand({
        TableName: getTableName(),
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: { ":pk": "LISTS" },
        Limit: effectiveLimit - items.length,
        ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {}),
      }),
    );

    const pageItems = (response.Items ?? [])
      .map(toList)
      .filter((parsed): parsed is List => !!parsed && !parsed.deletedAt);
    const remaining = effectiveLimit - items.length;
    const take = Math.min(pageItems.length, remaining);

    items.push(...pageItems.slice(0, take));
    lastEvaluatedKey = response.LastEvaluatedKey as CursorKey | undefined;
    hasMore = take === pageItems.length && !!lastEvaluatedKey;
  }

  return {
    items,
    ...(lastEvaluatedKey ? { nextCursor: lastEvaluatedKey } : {}),
  };
}

export async function getListById(id: string): Promise<List | null> {
  const response = await documentClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: buildKeys(id),
    }),
  );
  return response.Item ? toList(response.Item) : null;
}

export async function updateList(
  id: string,
  input: ListUpdate,
  expectedVersion: number,
  userId: string,
  now: string,
): Promise<List> {
  const existing = await getListById(id);
  if (!existing) {
    throw new NotFoundError(`List ${id} not found`);
  }

  const next: List = {
    ...existing,
    ...input,
    version: existing.version + 1,
    updatedAt: now,
    updatedBy: userId,
  };

  try {
    await documentClient.send(
      new PutCommand({
        TableName: getTableName(),
        Item: toRecord(next),
        ConditionExpression:
          "version = :expectedVersion AND attribute_not_exists(deletedAt)",
        ExpressionAttributeValues: { ":expectedVersion": expectedVersion },
      }),
    );
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      throw new ConflictError(`List ${id} version mismatch`);
    }
    throw error;
  }

  return next;
}

export async function deleteList(
  id: string,
  expectedVersion: number,
  userId: string,
  now: string,
): Promise<List> {
  const existing = await getListById(id);
  if (!existing) {
    throw new NotFoundError(`List ${id} not found`);
  }

  try {
    const response = await documentClient.send(
      new UpdateCommand({
        TableName: getTableName(),
        Key: buildKeys(id),
        ConditionExpression:
          "version = :expectedVersion AND attribute_not_exists(deletedAt)",
        UpdateExpression:
          "SET deletedAt = :now, #version = :nextVersion, updatedAt = :now, updatedBy = :userId",
        ExpressionAttributeNames: { "#version": "version" },
        ExpressionAttributeValues: {
          ":expectedVersion": expectedVersion,
          ":nextVersion": expectedVersion + 1,
          ":now": now,
          ":userId": userId,
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    const parsed = toList(response.Attributes ?? {});
    if (!parsed) {
      throw new NotFoundError(`List ${id} not found`);
    }
    return parsed;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      throw new ConflictError(`List ${id} version mismatch`);
    }
    throw error;
  }
}

export async function restoreList(
  id: string,
  expectedVersion: number,
  userId: string,
  now: string,
): Promise<List> {
  const existing = await getListById(id);
  if (!existing) {
    throw new NotFoundError(`List ${id} not found`);
  }

  try {
    const response = await documentClient.send(
      new UpdateCommand({
        TableName: getTableName(),
        Key: buildKeys(id),
        ConditionExpression:
          "version = :expectedVersion AND attribute_exists(deletedAt)",
        UpdateExpression:
          "REMOVE deletedAt SET #version = :nextVersion, updatedAt = :now, updatedBy = :userId",
        ExpressionAttributeNames: { "#version": "version" },
        ExpressionAttributeValues: {
          ":expectedVersion": expectedVersion,
          ":nextVersion": expectedVersion + 1,
          ":now": now,
          ":userId": userId,
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    const parsed = toList(response.Attributes ?? {});
    if (!parsed) {
      throw new NotFoundError(`List ${id} not found`);
    }
    return parsed;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      throw new ConflictError(`List ${id} version mismatch`);
    }
    throw error;
  }
}
```

- [x] **Step 2: Write repository tests**

创建 `apps/api/src/lists/client.test.ts`：

```typescript
import { describe, expect, it } from "vitest";
import { documentClient } from "./client.js";

describe("documentClient", () => {
  it("is defined", () => {
    expect(documentClient).toBeDefined();
  });
});
```

创建 `apps/api/src/lists/db.test.ts`：

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.hoisted(() => vi.fn());

vi.mock("./client.js", () => ({
  documentClient: { send: sendMock },
}));

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  ConflictError,
  NotFoundError,
  createList,
  deleteList,
  getListById,
  queryActiveLists,
  restoreList,
  updateList,
} from "./db.js";

function makeList(overrides: Record<string, unknown> = {}) {
  return {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    name: "购物",
    color: "#3b82f6",
    icon: "list",
    order: 0,
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
    updatedBy: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
    ...overrides,
  };
}

const idA = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const idB = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const idC = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

function makeDdbRecord(overrides: Record<string, unknown> = {}) {
  const list = makeList(overrides);
  return {
    PK: `LIST#${list.id}`,
    SK: "METADATA",
    GSI1PK: "LISTS",
    GSI1SK: `ORDER#${list.order.toFixed(9)}#LIST#${list.id}`,
    entityType: "LIST",
    ...list,
  };
}

function clearTableName() {
  // biome-ignore lint/performance/noDelete: need to actually remove the env var
  delete process.env.TABLE_NAME;
}

describe("createList", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    clearTableName();
  });

  it("creates a list with version 1 and audit fields", async () => {
    sendMock.mockResolvedValueOnce({});

    const result = await createList(
      { name: "购物", color: "#3b82f6", icon: "list", order: 1 },
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        userId: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
        now: "2026-01-01T00:00:00.000Z",
      },
    );

    expect(result).toMatchObject({
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      name: "购物",
      version: 1,
      createdBy: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
      updatedBy: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      TableName: "test-table",
      ConditionExpression: "attribute_not_exists(PK)",
    });
  });

  it("throws if TABLE_NAME is missing", async () => {
    clearTableName();
    await expect(
      createList(
        { name: "x", color: "#3b82f6", icon: "list", order: 0 },
        { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", userId: "u", now: "t" },
      ),
    ).rejects.toThrow("TABLE_NAME environment variable is not set");
  });
});

describe("queryActiveLists", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    clearTableName();
  });

  it("returns active lists and filters deleted", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        makeDdbRecord({ id: idA, name: "A" }),
        makeDdbRecord({
          id: idB,
          name: "B",
          deletedAt: "2026-01-02T00:00:00.000Z",
        }),
        makeDdbRecord({ id: idC, name: "C" }),
      ],
    });

    const result = await queryActiveLists(50);

    expect(result.items).toHaveLength(2);
    expect(result.items.map((l) => l.name)).toEqual(["A", "C"]);
    expect(result.nextCursor).toBeUndefined();
  });

  it("defaults limit to 50 when not provided", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [makeDdbRecord({ id: idA, name: "A" })],
    });

    const result = await queryActiveLists();

    expect(result.items).toHaveLength(1);
    expect(sendMock.mock.calls[0][0].input.Limit).toBe(50);
  });

  it("skips malformed items", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        makeDdbRecord({ id: idA, name: "A" }),
        { PK: "LIST#x", SK: "METADATA", name: "missing fields" },
      ],
    });

    const result = await queryActiveLists(50);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("A");
  });

  it("returns empty array when no lists", async () => {
    sendMock.mockResolvedValueOnce({ Items: [] });
    const result = await queryActiveLists(50);
    expect(result.items).toEqual([]);
  });

  it("handles missing Items field", async () => {
    sendMock.mockResolvedValueOnce({});
    const result = await queryActiveLists(50);
    expect(result.items).toEqual([]);
  });

  it("follows pages until limit is filled", async () => {
    sendMock
      .mockResolvedValueOnce({
        Items: [makeDdbRecord({ id: idA, name: "A" })],
        LastEvaluatedKey: { PK: `LIST#${idA}`, SK: "METADATA" },
      })
      .mockResolvedValueOnce({
        Items: [makeDdbRecord({ id: idB, name: "B" })],
        LastEvaluatedKey: { PK: `LIST#${idB}`, SK: "METADATA" },
      })
      .mockResolvedValueOnce({
        Items: [makeDdbRecord({ id: idC, name: "C" })],
      });

    const result = await queryActiveLists(3);

    expect(result.items).toHaveLength(3);
    expect(sendMock).toHaveBeenCalledTimes(3);
    expect(result.nextCursor).toBeUndefined();
  });

  it("returns nextCursor when more pages remain after limit", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [makeDdbRecord({ id: idA }), makeDdbRecord({ id: idB })],
      LastEvaluatedKey: { PK: `LIST#${idB}`, SK: "METADATA" },
    });

    const result = await queryActiveLists(1);

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toEqual({
      PK: `LIST#${idB}`,
      SK: "METADATA",
    });
  });

  it("clamps limit above 100 to 100", async () => {
    sendMock.mockResolvedValueOnce({
      Items: Array.from({ length: 100 }, (_, i) =>
        makeDdbRecord({ id: idA, name: `Item ${i}` }),
      ),
      LastEvaluatedKey: { PK: `LIST#${idA}`, SK: "METADATA" },
    });

    const result = await queryActiveLists(500);

    expect(result.items).toHaveLength(100);
    expect(sendMock.mock.calls[0][0].input.Limit).toBe(100);
    expect(result.nextCursor).toBeDefined();
  });

  it("clamps limit below 1 to 1", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [makeDdbRecord({ id: idA, name: "Only" })],
      LastEvaluatedKey: { PK: `LIST#${idA}`, SK: "METADATA" },
    });

    const result = await queryActiveLists(0);

    expect(result.items).toHaveLength(1);
    expect(sendMock.mock.calls[0][0].input.Limit).toBe(1);
  });

  it("resumes from cursor", async () => {
    sendMock.mockResolvedValueOnce({ Items: [] });

    await queryActiveLists(10, { PK: "LIST#x", SK: "METADATA" });

    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      ExclusiveStartKey: { PK: "LIST#x", SK: "METADATA" },
    });
  });
});

describe("getListById", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    clearTableName();
  });

  it("returns parsed list when found", async () => {
    sendMock.mockResolvedValueOnce({ Item: makeDdbRecord({ name: "Found" }) });
    const result = await getListById("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    expect(result?.name).toBe("Found");
  });

  it("returns null when not found", async () => {
    sendMock.mockResolvedValueOnce({});
    const result = await getListById("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    expect(result).toBeNull();
  });

  it("returns null when item is malformed", async () => {
    sendMock.mockResolvedValueOnce({
      Item: { PK: "LIST#x", SK: "METADATA", name: "missing fields" },
    });
    const result = await getListById("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    expect(result).toBeNull();
  });
});

describe("updateList", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    clearTableName();
  });

  it("updates fields and increments version", async () => {
    sendMock
      .mockResolvedValueOnce({
        Item: makeDdbRecord({ version: 1, name: "Old" }),
      })
      .mockResolvedValueOnce({});

    const result = await updateList(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      { name: "New" },
      1,
      "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
      "2026-01-02T00:00:00.000Z",
    );

    expect(result.name).toBe("New");
    expect(result.version).toBe(2);
    expect(result.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      ConditionExpression:
        "version = :expectedVersion AND attribute_not_exists(deletedAt)",
    });
  });

  it("throws NotFoundError when list does not exist", async () => {
    sendMock.mockResolvedValueOnce({});
    await expect(
      updateList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", {}, 1, "u", "t"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ConflictError on version mismatch", async () => {
    sendMock.mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) });
    sendMock.mockRejectedValueOnce(
      new ConditionalCheckFailedException({
        message: "version mismatch",
        $metadata: {},
      }),
    );

    await expect(
      updateList(
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        { name: "x" },
        1,
        "u",
        "t",
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rethrows unexpected errors", async () => {
    sendMock.mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) });
    sendMock.mockRejectedValueOnce(new Error("dynamodb down"));

    await expect(
      updateList(
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        { name: "x" },
        1,
        "u",
        "t",
      ),
    ).rejects.toThrow("dynamodb down");
  });
});

describe("deleteList", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    clearTableName();
  });

  it("sets deletedAt and increments version", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockResolvedValueOnce({
        Attributes: makeDdbRecord({
          deletedAt: "2026-01-02T00:00:00.000Z",
          version: 2,
        }),
      });

    const result = await deleteList(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      1,
      "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
      "2026-01-02T00:00:00.000Z",
    );

    expect(result.deletedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(result.version).toBe(2);
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      TableName: "test-table",
      Key: { PK: "LIST#a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", SK: "METADATA" },
    });
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      ConditionExpression:
        "version = :expectedVersion AND attribute_not_exists(deletedAt)",
    });
  });

  it("throws ConflictError on version mismatch", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockRejectedValueOnce(
        new ConditionalCheckFailedException({
          message: "version mismatch",
          $metadata: {},
        }),
      );

    await expect(
      deleteList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 1, "u", "t"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws NotFoundError when list does not exist", async () => {
    sendMock.mockResolvedValueOnce({});

    await expect(
      deleteList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 1, "u", "t"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rethrows unexpected errors", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockRejectedValueOnce(new Error("dynamodb down"));

    await expect(
      deleteList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 1, "u", "t"),
    ).rejects.toThrow("dynamodb down");
  });

  it("throws NotFoundError when returned attributes are malformed", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockResolvedValueOnce({
        Attributes: { PK: "LIST#x", SK: "METADATA", name: "missing fields" },
      });

    await expect(
      deleteList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 1, "u", "t"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when returned attributes are missing", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockResolvedValueOnce({});

    await expect(
      deleteList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 1, "u", "t"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("restoreList", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    clearTableName();
  });

  it("removes deletedAt and increments version", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) })
      .mockResolvedValueOnce({
        Attributes: makeDdbRecord({ version: 3 }),
      });

    const result = await restoreList(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      2,
      "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
      "2026-01-03T00:00:00.000Z",
    );

    expect(result.deletedAt).toBeUndefined();
    expect(result.version).toBe(3);
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      TableName: "test-table",
      Key: { PK: "LIST#a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", SK: "METADATA" },
    });
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      ConditionExpression:
        "version = :expectedVersion AND attribute_exists(deletedAt)",
    });
  });

  it("throws ConflictError on version mismatch", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) })
      .mockRejectedValueOnce(
        new ConditionalCheckFailedException({
          message: "version mismatch",
          $metadata: {},
        }),
      );

    await expect(
      restoreList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 2, "u", "t"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws NotFoundError when list does not exist", async () => {
    sendMock.mockResolvedValueOnce({});

    await expect(
      restoreList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 2, "u", "t"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rethrows unexpected errors", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) })
      .mockRejectedValueOnce(new Error("dynamodb down"));

    await expect(
      restoreList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 2, "u", "t"),
    ).rejects.toThrow("dynamodb down");
  });

  it("throws NotFoundError when returned attributes are malformed", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) })
      .mockResolvedValueOnce({
        Attributes: { PK: "LIST#x", SK: "METADATA", name: "missing fields" },
      });

    await expect(
      restoreList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 2, "u", "t"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when returned attributes are missing", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) })
      .mockResolvedValueOnce({});

    await expect(
      restoreList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 2, "u", "t"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
```

- [x] **Step 3: Run repository tests**

Run: `bun run test -- --project apps/api src/lists/db.test.ts`
Expected: PASS, coverage 100% for `db.ts` and `client.ts`。

- [x] **Step 4: Commit**

```bash
git add apps/api/src/lists/client.ts apps/api/src/lists/client.test.ts apps/api/src/lists/db.ts apps/api/src/lists/db.test.ts
bunx @biomejs/biome check --write
bun run test -- --project apps/api
bunx tsc --noEmit -p apps/api/tsconfig.json
git commit -m "feat(api): add list dynamodb repository"
```

---

## Task 4: Implement lists Lambda handler

> Covers: 场景 1（POST /api/lists）、场景 2（GET /api/lists）、场景 3（DELETE）、场景 5（restore）、场景 6/7（409 路由层）。

**Files:**
- Create: `apps/api/src/lists/index.ts`
- Create: `apps/api/src/lists/index.test.ts`

**Interfaces:**
- Consumes: `db.ts` 导出的全部 mutation/query 函数与错误类；`packages/shared` 的 schema / response / cursor / validate 工具。
- Produces: Lambda handler `lists/index.handler` 处理 `GET/POST/PATCH/DELETE /api/lists*` 与 `POST /api/lists/{id}/restore`。

- [x] **Step 1: Write handler tests first**

创建 `apps/api/src/lists/index.test.ts`：

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const randomUUIDMock = vi.hoisted(() =>
  vi.fn(() => "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"),
);

vi.mock("node:crypto", () => ({
  randomUUID: randomUUIDMock,
}));

const dbMock = vi.hoisted(() => ({
  createList: vi.fn(),
  queryActiveLists: vi.fn(),
  updateList: vi.fn(),
  deleteList: vi.fn(),
  restoreList: vi.fn(),
}));

vi.mock("./db.js", () => ({
  ...dbMock,
  ConflictError: class ConflictError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
}));

import { encodeCursor } from "@lyco/shared";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda";
import { ConflictError, NotFoundError } from "./db.js";
import { handler } from "./index.js";

function createEvent(
  method: string,
  path: string,
  options: {
    query?: Record<string, string>;
    body?: string;
  } = {},
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    version: "2.0",
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: "",
    headers: {},
    queryStringParameters: options.query ?? {},
    body: options.body ?? undefined,
    requestContext: {
      domainName: "",
      domainPrefix: "",
      http: {
        method,
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      requestId: "test-request-id",
      routeKey: `${method} ${path}`,
      stage: "dev",
      time: "14/Jul/2026:00:00:00 +0000",
      timeEpoch: 1752460800000,
      accountId: "",
      apiId: "",
      authorizer: {
        principalId: "current-user",
        integrationLatency: 0,
        jwt: {
          claims: { sub: "d92a155c-70a1-70cf-8bd5-0dd5d4772093" },
          scopes: [],
        },
      },
    },
    isBase64Encoded: false,
  };
}

async function invokeHandler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const result = await handler(event, {} as never, () => {});
  if (typeof result === "string" || result === undefined) {
    throw new Error("expected object response");
  }
  return result;
}

const mockList = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  name: "购物",
  color: "#3b82f6",
  icon: "list",
  order: 0,
  version: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdBy: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
  updatedBy: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
};

describe("lists handler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    for (const mock of Object.values(dbMock)) {
      mock.mockReset();
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a list", async () => {
    dbMock.createList.mockResolvedValueOnce(mockList);

    const result = await invokeHandler(
      createEvent("POST", "/api/lists", {
        body: JSON.stringify({ name: "购物" }),
      }),
    );

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.name).toBe("购物");
    expect(dbMock.createList).toHaveBeenCalledWith(
      { name: "购物", color: "#3b82f6", icon: "list", order: 0 },
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        userId: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
        now: "2026-01-01T00:00:00.000Z",
      },
    );
  });

  it("returns 400 for invalid create body", async () => {
    const result = await invokeHandler(
      createEvent("POST", "/api/lists", {
        body: JSON.stringify({ name: "" }),
      }),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("lists active lists with pagination", async () => {
    dbMock.queryActiveLists.mockResolvedValueOnce({
      items: [mockList],
      nextCursor: { PK: "LIST#x", SK: "METADATA" },
    });

    const result = await invokeHandler(
      createEvent("GET", "/api/lists", { query: { limit: "10" } }),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.items).toEqual([mockList]);
    expect(body.nextCursor).toBe(
      encodeCursor({ PK: "LIST#x", SK: "METADATA" }),
    );
    expect(dbMock.queryActiveLists).toHaveBeenCalledWith(10, undefined);
  });

  it("returns 400 for invalid cursor", async () => {
    const result = await invokeHandler(
      createEvent("GET", "/api/lists", { query: { cursor: "!!!" } }),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("INVALID_CURSOR");
  });

  it("resumes from valid cursor", async () => {
    dbMock.queryActiveLists.mockResolvedValueOnce({ items: [] });
    const cursor = encodeCursor({ PK: "LIST#x", SK: "METADATA" });

    await invokeHandler(
      createEvent("GET", "/api/lists", { query: { cursor } }),
    );

    expect(dbMock.queryActiveLists).toHaveBeenCalledWith(50, {
      PK: "LIST#x",
      SK: "METADATA",
    });
  });

  it("updates a list", async () => {
    dbMock.updateList.mockResolvedValueOnce({
      ...mockList,
      name: "新名称",
      version: 2,
    });

    const result = await invokeHandler(
      createEvent("PATCH", "/api/lists/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", {
        body: JSON.stringify({ name: "新名称", expectedVersion: 1 }),
      }),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.name).toBe("新名称");
    expect(dbMock.updateList).toHaveBeenCalledWith(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      { name: "新名称" },
      1,
      "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("returns 400 for missing expectedVersion in update", async () => {
    const result = await invokeHandler(
      createEvent("PATCH", "/api/lists/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", {
        body: JSON.stringify({ name: "x" }),
      }),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("soft deletes a list", async () => {
    dbMock.deleteList.mockResolvedValueOnce({
      ...mockList,
      deletedAt: "2026-01-01T00:00:00.000Z",
      version: 2,
    });

    const result = await invokeHandler(
      createEvent("DELETE", "/api/lists/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", {
        query: { expectedVersion: "1" },
      }),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.deletedAt).toBeDefined();
    expect(dbMock.deleteList).toHaveBeenCalledWith(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      1,
      "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("returns 400 for missing expectedVersion in delete", async () => {
    const result = await invokeHandler(
      createEvent("DELETE", "/api/lists/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("restores a list", async () => {
    dbMock.restoreList.mockResolvedValueOnce({ ...mockList, version: 3 });

    const result = await invokeHandler(
      createEvent(
        "POST",
        "/api/lists/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/restore",
        {
          body: JSON.stringify({ expectedVersion: 2 }),
        },
      ),
    );

    expect(result.statusCode).toBe(200);
    expect(dbMock.restoreList).toHaveBeenCalledWith(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      2,
      "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("returns 409 on conflict error", async () => {
    dbMock.updateList.mockRejectedValueOnce(
      new ConflictError("version mismatch"),
    );
    const result = await invokeHandler(
      createEvent("PATCH", "/api/lists/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", {
        body: JSON.stringify({ name: "x", expectedVersion: 1 }),
      }),
    );

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body ?? "{}").code).toBe("CONFLICT");
  });

  it("returns 404 on not found", async () => {
    dbMock.deleteList.mockRejectedValueOnce(new NotFoundError("not found"));
    const result = await invokeHandler(
      createEvent("DELETE", "/api/lists/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", {
        query: { expectedVersion: "1" },
      }),
    );

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body ?? "{}").code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid JSON body", async () => {
    const result = await invokeHandler(
      createEvent("POST", "/api/lists", { body: "not-json" }),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is missing", async () => {
    const result = await invokeHandler(
      createEvent(
        "POST",
        "/api/lists/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/restore",
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for unknown route", async () => {
    const result = await invokeHandler(
      createEvent("GET", "/api/lists/unknown/route"),
    );
    expect(result.statusCode).toBe(404);
  });

  it("returns 500 on unexpected errors", async () => {
    dbMock.queryActiveLists.mockRejectedValueOnce(new Error("boom"));
    const result = await invokeHandler(createEvent("GET", "/api/lists"));
    expect(result.statusCode).toBe(500);
  });

  it("falls back to unknown user id when sub is missing", async () => {
    const event = createEvent("GET", "/api/lists");
    (event.requestContext.authorizer.jwt.claims as { sub?: unknown }).sub =
      undefined;
    dbMock.queryActiveLists.mockResolvedValueOnce({ items: [] });

    const result = await invokeHandler(event);

    expect(result.statusCode).toBe(200);
  });

  it("falls back to unknown user id when sub is not a string", async () => {
    const event = createEvent("GET", "/api/lists");
    (event.requestContext.authorizer.jwt.claims as { sub?: unknown }).sub = 123;
    dbMock.queryActiveLists.mockResolvedValueOnce({ items: [] });

    const result = await invokeHandler(event);

    expect(result.statusCode).toBe(200);
  });

  it("is typed as APIGatewayProxyHandlerV2WithJWTAuthorizer", () => {
    const typed: APIGatewayProxyHandlerV2WithJWTAuthorizer = handler;
    expect(typed).toBeDefined();
  });
});
```

- [x] **Step 2: Run handler tests to verify they fail**

Run: `bun run test -- --project apps/api src/lists/index.test.ts`
Expected: FAIL with handler not found / missing exports.

- [x] **Step 3: Write minimal handler implementation**

创建 `apps/api/src/lists/index.ts`：

```typescript
import { randomUUID } from "node:crypto";
import {
  CursorError,
  type CursorKey,
  ValidationError,
  buildResponse,
  decodeCursor,
  encodeCursor,
  errorResponse,
  listDeleteQuerySchema,
  listInputSchema,
  listQuerySchema,
  listRestoreBodySchema,
  listUpdateBodySchema,
  parseRequest,
} from "@lyco/shared";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda";
import {
  ConflictError,
  NotFoundError,
  createList,
  deleteList,
  queryActiveLists,
  restoreList,
  updateList,
} from "./db.js";

function getUserId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  return typeof event.requestContext.authorizer.jwt.claims.sub === "string"
    ? event.requestContext.authorizer.jwt.claims.sub
    : "unknown";
}

function parseBody(body: string | undefined): unknown {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new ValidationError("Invalid JSON body");
  }
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event,
) => {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath;
    const userId = getUserId(event);
    const now = new Date().toISOString();

    if (method === "GET" && path === "/api/lists") {
      const query = parseRequest(listQuerySchema, {
        limit: event.queryStringParameters?.limit,
        cursor: event.queryStringParameters?.cursor,
      });
      let startKey: CursorKey | undefined;
      if (query.cursor) {
        startKey = decodeCursor(query.cursor);
      }
      const result = await queryActiveLists(query.limit, startKey);
      return buildResponse(200, {
        items: result.items,
        ...(result.nextCursor
          ? { nextCursor: encodeCursor(result.nextCursor) }
          : {}),
      });
    }

    if (method === "POST" && path === "/api/lists") {
      const body = parseRequest(listInputSchema, parseBody(event.body));
      const list = await createList(body, {
        id: randomUUID(),
        userId,
        now,
      });
      return buildResponse(201, list);
    }

    const singleMatch = /^\/api\/lists\/([0-9a-f-]+)$/.exec(path);
    if (singleMatch) {
      const id = singleMatch[1];

      if (method === "PATCH") {
        const body = parseRequest(listUpdateBodySchema, parseBody(event.body));
        const { expectedVersion, ...input } = body;
        const list = await updateList(id, input, expectedVersion, userId, now);
        return buildResponse(200, list);
      }

      if (method === "DELETE") {
        const query = parseRequest(listDeleteQuerySchema, {
          expectedVersion: event.queryStringParameters?.expectedVersion,
        });
        const list = await deleteList(id, query.expectedVersion, userId, now);
        return buildResponse(200, list);
      }
    }

    const restoreMatch = /^\/api\/lists\/([0-9a-f-]+)\/restore$/.exec(path);
    if (restoreMatch && method === "POST") {
      const id = restoreMatch[1];
      const body = parseRequest(listRestoreBodySchema, parseBody(event.body));
      const list = await restoreList(id, body.expectedVersion, userId, now);
      return buildResponse(200, list);
    }

    return buildResponse(404, { error: "Not found" });
  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse(error.message, "VALIDATION_ERROR", 400);
    }
    if (error instanceof NotFoundError) {
      return errorResponse(error.message, "NOT_FOUND", 404);
    }
    if (error instanceof ConflictError) {
      return errorResponse(error.message, "CONFLICT", 409);
    }
    if (error instanceof CursorError) {
      return errorResponse(error.message, "INVALID_CURSOR", 400);
    }
    console.error(error);
    return errorResponse("failed to process list request");
  }
};
```

- [x] **Step 4: Run handler tests to verify they pass**

Run: `bun run test -- --project apps/api src/lists/index.test.ts`
Expected: PASS, coverage 100% for `index.ts`。

- [x] **Step 5: Commit**

```bash
git add apps/api/src/lists/index.ts apps/api/src/lists/index.test.ts
bunx @biomejs/biome check --write
bun run test -- --project apps/api
bunx tsc --noEmit -p apps/api/tsconfig.json
git commit -m "feat(api): implement list crud and restore handler"
```

---

## Task 5: Add Bruno requests for lists

> Covers: 验收标准手动验证；非自动化测试要求，但需补齐集合。

**Files:**
- Create: `bruno/lyco-list/lists/folder.bru`
- Create: `bruno/lyco-list/lists/list lists.bru`
- Create: `bruno/lyco-list/lists/create list.bru`
- Create: `bruno/lyco-list/lists/update list.bru`
- Create: `bruno/lyco-list/lists/delete list.bru`
- Create: `bruno/lyco-list/lists/restore list.bru`

**Interfaces:**
- Consumes: collection 级 bearer 认证（`bruno/lyco-list/collection.bru` 使用环境 secret `{{accessToken}}`，ticket 001 约定），请求以 `auth: inherit` 继承。
- Produces: 5 个 `.bru` 请求文件与 1 个 `folder.bru`。

- [x] **Step 1: Create Bruno folder and files**

创建 `bruno/lyco-list/lists/folder.bru`：

```
meta {
  name: lists
}
```

创建 `bruno/lyco-list/lists/list lists.bru`：

```
meta {
  name: list lists
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/api/lists?limit=50
  body: none
  auth: inherit
}

params:query {
  limit: 50
}
```

创建 `bruno/lyco-list/lists/create list.bru`：

```
meta {
  name: create list
  type: http
  seq: 2
}

post {
  url: {{baseUrl}}/api/lists
  body: json
  auth: inherit
}

body:json {
  {
    "name": "购物",
    "color": "#3b82f6",
    "icon": "list",
    "order": 0
  }
}
```

创建 `bruno/lyco-list/lists/update list.bru`：

```
meta {
  name: update list
  type: http
  seq: 3
}

patch {
  url: {{baseUrl}}/api/lists/{{listId}}
  body: json
  auth: inherit
}

body:json {
  {
    "name": "新名称",
    "expectedVersion": 1
  }
}
```

创建 `bruno/lyco-list/lists/delete list.bru`：

```
meta {
  name: delete list
  type: http
  seq: 4
}

delete {
  url: {{baseUrl}}/api/lists/{{listId}}?expectedVersion=2
  body: none
  auth: inherit
}

params:query {
  expectedVersion: 2
}
```

创建 `bruno/lyco-list/lists/restore list.bru`：

```
meta {
  name: restore list
  type: http
  seq: 5
}

post {
  url: {{baseUrl}}/api/lists/{{listId}}/restore
  body: json
  auth: inherit
}

body:json {
  {
    "expectedVersion": 3
  }
}
```

- [x] **Step 2: Verify Biome formatting**

Run: `bunx @biomejs/biome check bruno/lyco-list/lists`
Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add bruno/lyco-list/lists
bunx @biomejs/biome check --write bruno/lyco-list/lists
git commit -m "docs(bruno): add list crud and restore requests"
```

---

## Task 6: Verify full suite and integration

> Covers: 全部验收标准的最终验证；确保覆盖率、类型、格式全部通过。

**Files:**
- 不新增文件；只运行命令。

- [x] **Step 1: Run full test suite with coverage**

Run: `bun run test`
Expected: all projects pass, coverage thresholds 100%.

- [x] **Step 2: Run typecheck**

Run:
```bash
bunx tsc --noEmit -p apps/api/tsconfig.json
bunx tsc --noEmit -p packages/shared/tsconfig.json
```
Expected: no errors.

- [x] **Step 3: Run Biome check**

Run: `bunx @biomejs/biome check`
Expected: no errors.

- [x] **Step 4: Commit if any fixes**

```bash
# 仅当 Step 1-3 中发现并修复了问题时提交
git add -A
bunx @biomejs/biome check --write
bun run test
bunx tsc --noEmit -p apps/api/tsconfig.json
bunx tsc --noEmit -p packages/shared/tsconfig.json
git commit -m "fix(api): address review and coverage gaps in lists lambda"
```

---

## Self-Review

**1. Ticket coverage:**
- 场景 1 创建列表 → Task 4 POST /api/lists。
- 场景 2 查询分页 → Task 3 `queryActiveLists` + Task 4 GET /api/lists。
- 场景 3 软删除 → Task 3 `deleteList` + Task 4 DELETE /api/lists/{id}。
- 场景 4 过滤已删除 → Task 3 `queryActiveLists` 服务层过滤。
- 场景 5 恢复 → Task 3 `restoreList` + Task 4 POST /api/lists/{id}/restore。
- 场景 6 旧版本冲突 → Task 3/4 Update 条件写 + 409。
- 场景 7 删除/恢复冲突 → Task 3/4 Delete/Restore 条件写 + 409。
- 无遗漏。

**2. Placeholder scan:**
- 无 "TBD"/"TODO"/"implement later"；所有步骤含具体代码与命令；无 "add appropriate error handling" 等模糊描述。

**3. Type consistency:**
- `expectedVersion` 在 `listUpdateBodySchema`、`listRestoreBodySchema` 为 `number`；在 `listDeleteQuerySchema` 为 `coerce.number`；handler 分别解析为数字后传入 db 函数。
- `queryActiveLists` 返回 `{ items, nextCursor? }`，handler 使用 `encodeCursor` 包装。
- `version` 递增逻辑在 db 函数中一致：`existing.version + 1` 或 `expectedVersion + 1`。

**4. Plan reliability:**
- 依赖 ticket 003（shared schema/cursor）和 006（health/verify/users 模式）已提供；本 plan 假设 `packages/shared` 已有 `listSchema` / `formatOrderKey` / `encodeCursor` / `decodeCursor` / `parseRequest`。
- 实际 DynamoDB 表 `LycoTable` 和 GSI1 在 Task 1 中新增；与 ticket 003 "不包含 DynamoDB 表部署" 不冲突。
- 当前采用 AWS SDK mock 与 ticket 008 测试要求一致。
- 无隐藏假设：所有输入校验、错误码、审计字段均显式列出。

---

## Sync Back to Ticket and Source

无需修改 `ticket.md` 或设计文档：本 plan 完全遵循 ticket 范围与设计文档的列表键设计、软删除规则、版本规则。

> **实施后审计回写（2026-07-17）**：实现合并（PR #10）后执行 plan ↔ implementation 一致性审计，发现 4 处实现偏离，已将本 plan 的代码块与步骤同步为最终实现：
> 1. Bruno 请求归入 `bruno/lyco-list/lists/` collection，使用 `auth: inherit` 继承 collection 级 bearer 认证，并补充 `folder.bru`（commit `e0f7332`、`3021a9f`）。
> 2. `queryActiveLists` 增加 `limit = 50` 默认值并将 `limit` clamp 到 [1, 100]（commit `d51102e`、`f76b4cd`）。
> 3. `deleteList` / `restoreList` 增加 `getListById` 前置存在性检查，移除 `ResourceNotFoundException` 分支（DynamoDB `UpdateCommand` 对不存在的 item 会创建新 item，原方案有缺陷）（commit `f76b4cd`）。
> 4. handler 错误链补充 `CursorError → 400 INVALID_CURSOR` 分支（`CursorError` 直接继承 `Error`，原 catch 链会落入 500）（commit `95d6c8a`）。

---

## Execution Handoff

**Plan complete and saved to `tickets/008-实现列表crud软删除和恢复/plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints

**Which approach?**
