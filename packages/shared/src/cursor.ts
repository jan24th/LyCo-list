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
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
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
