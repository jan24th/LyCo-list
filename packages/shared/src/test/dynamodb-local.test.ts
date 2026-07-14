import { describe, expect, it } from "vitest";
import { createTableInput, startDynamoDBLocal } from "./dynamodb-local.js";

describe("createTableInput", () => {
  it("returns a valid DynamoDB create table input", () => {
    const input = createTableInput("TestTable");
    expect(input.TableName).toBe("TestTable");
    expect(input.KeySchema).toHaveLength(2);
    expect(input.AttributeDefinitions).toHaveLength(2);
    expect(input.BillingMode).toBe("PAY_PER_REQUEST");
  });
});

describe.skip("startDynamoDBLocal", () => {
  it("starts a local instance and creates a table", async () => {
    const { client, stop } = await startDynamoDBLocal();
    await client.createTable(createTableInput("TestTable"));
    const tables = await client.listTables({});
    expect(tables.TableNames).toContain("TestTable");
    await client.deleteTable({ TableName: "TestTable" });
    await stop();
  }, 60_000);
});
