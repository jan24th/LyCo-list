import { describe, expect, it } from "vitest";
import { documentClient } from "./client.js";

describe("documentClient", () => {
  it("is defined", () => {
    expect(documentClient).toBeDefined();
  });
});
