import { describe, it, expect } from "vitest";
import { hasPlanAccess, isTopPlan, planLevel, TOP_PLAN } from "./access";

describe("planLevel", () => {
  it("maps each slug to its level", () => {
    expect(planLevel("free")).toBe(0);
    expect(planLevel("acesso")).toBe(1);
    expect(planLevel("plano1")).toBe(2);
    expect(planLevel("plano2")).toBe(3);
    expect(planLevel("plano3")).toBe(4);
    expect(planLevel("atleta")).toBe(5);
  });

  it("treats null/undefined/unknown (incl. legacy slugs) as level 0", () => {
    expect(planLevel(null)).toBe(0);
    expect(planLevel(undefined)).toBe(0);
    expect(planLevel("vip")).toBe(0); // slug legado morto
    expect(planLevel("pro")).toBe(0);
    expect(planLevel("start")).toBe(0);
  });
});

describe("hasPlanAccess", () => {
  it("grants access at or above the required level", () => {
    expect(hasPlanAccess("plano3", "plano3")).toBe(true);
    expect(hasPlanAccess("atleta", "plano3")).toBe(true);
  });

  it("denies access below the required level", () => {
    expect(hasPlanAccess("plano2", "plano3")).toBe(false);
    expect(hasPlanAccess("free", "plano2")).toBe(false);
    expect(hasPlanAccess(null, "acesso")).toBe(false);
  });

  it("chat gate (plano3) excludes lower paid tiers but includes atleta", () => {
    expect(hasPlanAccess("acesso", "plano3")).toBe(false);
    expect(hasPlanAccess("plano1", "plano3")).toBe(false);
    expect(hasPlanAccess("plano2", "plano3")).toBe(false);
    expect(hasPlanAccess("plano3", "plano3")).toBe(true);
    expect(hasPlanAccess("atleta", "plano3")).toBe(true);
  });

  it("consultoria gate (plano2) entitlement", () => {
    expect(hasPlanAccess("plano1", "plano2")).toBe(false);
    expect(hasPlanAccess("plano2", "plano2")).toBe(true);
    expect(hasPlanAccess("atleta", "plano2")).toBe(true);
  });
});

describe("isTopPlan", () => {
  it("is true only for the top tier", () => {
    expect(isTopPlan("atleta")).toBe(true);
    expect(isTopPlan(TOP_PLAN)).toBe(true);
    expect(isTopPlan("plano3")).toBe(false);
    expect(isTopPlan("free")).toBe(false);
    expect(isTopPlan(null)).toBe(false);
  });
});
