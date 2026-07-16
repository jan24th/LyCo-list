import { describe, expect, it } from "vitest";
import {
  cognitoSub,
  formatOrderKey,
  ianaTimeZone,
  localDate,
  localTime,
  orderNumber,
  recurrenceRule,
} from "./common.js";

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

  it("validates cognitoSub format", () => {
    expect(
      cognitoSub.safeParse("d92a155c-70a1-70cf-8bd5-0dd5d4772093").success,
    ).toBe(true);
    expect(
      cognitoSub.safeParse("f9da35bc-a051-7055-42ec-9c75719b9a9f").success,
    ).toBe(true);
    expect(cognitoSub.safeParse("not-a-valid-sub").success).toBe(false);
  });
});
