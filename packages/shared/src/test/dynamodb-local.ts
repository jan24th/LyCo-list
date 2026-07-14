import { DynamoDB } from "@aws-sdk/client-dynamodb";
import dynamodbLocal from "dynamodb-local";

const port = 8000;

export async function startDynamoDBLocal(): Promise<{
  client: DynamoDB;
  stop: () => Promise<void>;
}> {
  await dynamodbLocal.launch(port, null, ["-sharedDb"]);
  const client = new DynamoDB({
    endpoint: `http://localhost:${port}`,
    region: "local",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });

  return {
    client,
    stop: async () => {
      await dynamodbLocal.stop(port);
    },
  };
}

export function createTableInput(tableName: string) {
  return {
    TableName: tableName,
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" as const },
      { AttributeName: "SK", KeyType: "RANGE" as const },
    ],
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" as const },
      { AttributeName: "SK", AttributeType: "S" as const },
    ],
    BillingMode: "PAY_PER_REQUEST" as const,
  };
}
