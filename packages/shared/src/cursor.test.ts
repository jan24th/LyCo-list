import { describe, expect, it } from "vitest";
import { CursorError, decodeCursor, encodeCursor } from "./cursor.js";
import { createTableInput, startDynamoDBLocal } from "./test/dynamodb-local.js";

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

describe.skip("cursor with DynamoDB Local", () => {
  it("encodes and decodes a real LastEvaluatedKey", async () => {
    const { client, stop } = await startDynamoDBLocal();
    const tableName = "CursorTest";

    try {
      await client.createTable(createTableInput(tableName));
      await client.putItem({
        TableName: tableName,
        Item: {
          PK: { S: "LIST#111" },
          SK: { S: "METADATA" },
          name: { S: "A" },
        },
      });
      await client.putItem({
        TableName: tableName,
        Item: {
          PK: { S: "LIST#222" },
          SK: { S: "METADATA" },
          name: { S: "B" },
        },
      });

      const scan = await client.scan({ TableName: tableName, Limit: 1 });
      const lastKey = scan.LastEvaluatedKey;
      expect(lastKey).toBeDefined();

      const cursor = encodeCursor(lastKey as Record<string, unknown>);
      expect(decodeCursor(cursor)).toEqual(lastKey);
    } finally {
      await client.deleteTable({ TableName: tableName }).catch(() => null);
      await stop();
    }
  }, 60_000);
});
