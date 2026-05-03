import { describe, it, expect } from "vitest";
import { parseExternalReference } from "./external-reference";

describe("parseExternalReference", () => {
  it("estetica:<id>", () => {
    expect(parseExternalReference("estetica:abc-123")).toEqual({
      type: "estetica",
      reference_type: "booking",
      reference_id: "abc-123",
    });
  });

  it("estetica: com uuid", () => {
    expect(parseExternalReference("estetica:550e8400-e29b-41d4-a716-446655440000")).toEqual({
      type: "estetica",
      reference_type: "booking",
      reference_id: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("loja:<id>", () => {
    expect(parseExternalReference("loja:order-1")).toEqual({
      type: "loja",
      reference_type: "order",
      reference_id: "order-1",
    });
  });

  it("user_id puro → mensalidade", () => {
    expect(parseExternalReference("user_2N3xxxx")).toEqual({
      type: "mensalidade",
      reference_type: "subscription",
      reference_id: "user_2N3xxxx",
    });
  });

  it("undefined retorna null", () => {
    expect(parseExternalReference(undefined)).toBeNull();
  });

  it("null retorna null", () => {
    expect(parseExternalReference(null)).toBeNull();
  });

  it("string vazia retorna null", () => {
    expect(parseExternalReference("")).toBeNull();
  });

  it("estetica: sem id retorna estetica com reference_id vazio", () => {
    // edge case: prefixo presente mas sem id
    expect(parseExternalReference("estetica:")).toEqual({
      type: "estetica",
      reference_type: "booking",
      reference_id: "",
    });
  });
});
