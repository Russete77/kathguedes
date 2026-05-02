import { describe, it, expect } from "vitest";
import { verifyWebhookToken, planTierFromValue } from "./webhook";

describe("verifyWebhookToken", () => {
  it("throws when ASAAS_WEBHOOK_TOKEN env var is missing", () => {
    // Config now throws if ASAAS_WEBHOOK_TOKEN is not set (SD-01 fix)
    expect(() => verifyWebhookToken("any-token")).toThrow("ASAAS_WEBHOOK_TOKEN");
  });

  it("throws on null header token when env var is missing", () => {
    expect(() => verifyWebhookToken(null)).toThrow("ASAAS_WEBHOOK_TOKEN");
  });
});

describe("planTierFromValue", () => {
  it("returns vip for >= 99", () => {
    expect(planTierFromValue(99)).toBe("vip");
    expect(planTierFromValue(150)).toBe("vip");
  });

  it("returns pro for >= 39", () => {
    expect(planTierFromValue(39)).toBe("pro");
    expect(planTierFromValue(98)).toBe("pro");
  });

  it("returns start for >= 19", () => {
    expect(planTierFromValue(19)).toBe("start");
    expect(planTierFromValue(38)).toBe("start");
  });

  it("returns free for < 19", () => {
    expect(planTierFromValue(0)).toBe("free");
    expect(planTierFromValue(18)).toBe("free");
  });
});
