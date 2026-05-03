import { describe, it, expect } from "vitest";
import { clampCashbackCents, computeAmountPaidCash } from "./cashback-utils";

describe("clampCashbackCents", () => {
  it("limita ao saldo ativo", () => {
    expect(clampCashbackCents({ requested: 5000, gross: 10000, activeBalance: 3000 })).toBe(3000);
  });

  it("limita a 50% do gross", () => {
    expect(clampCashbackCents({ requested: 8000, gross: 10000, activeBalance: 9000 })).toBe(5000);
  });

  it("retorna 0 se requested <= 0", () => {
    expect(clampCashbackCents({ requested: 0, gross: 10000, activeBalance: 5000 })).toBe(0);
    expect(clampCashbackCents({ requested: -100, gross: 10000, activeBalance: 5000 })).toBe(0);
  });

  it("respeita o menor entre os limites", () => {
    expect(clampCashbackCents({ requested: 1000, gross: 10000, activeBalance: 500 })).toBe(500);
  });

  it("retorna 0 se gross <= 0", () => {
    expect(clampCashbackCents({ requested: 1000, gross: 0, activeBalance: 5000 })).toBe(0);
    expect(clampCashbackCents({ requested: 1000, gross: -1, activeBalance: 5000 })).toBe(0);
  });

  it("trata NaN como 0", () => {
    expect(clampCashbackCents({ requested: NaN, gross: 10000, activeBalance: 5000 })).toBe(0);
  });
});

describe("computeAmountPaidCash", () => {
  it("subtrai cashback do gross", () => {
    expect(computeAmountPaidCash({ gross: 10000, cashbackUsed: 3000 })).toBe(7000);
  });

  it("nunca abaixo de 0", () => {
    expect(computeAmountPaidCash({ gross: 1000, cashbackUsed: 5000 })).toBe(0);
  });

  it("zero cashback retorna gross", () => {
    expect(computeAmountPaidCash({ gross: 5000, cashbackUsed: 0 })).toBe(5000);
  });
});
