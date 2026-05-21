import { describe, it, expect } from "vitest";
import {
  createWorkoutSchema,
  createCouponSchema,
  createAffiliateSchema,
  createProductSchema,
  updateConsultationSchema,
} from "./validations";

describe("createWorkoutSchema", () => {
  it("validates a correct workout", () => {
    const result = createWorkoutSchema.safeParse({
      title: "Treino Glúteo Intenso",
      youtube_id: "abc123",
      category: "gluteo",
      level: "intermediario",
      duration_minutes: 45,
      required_plan: "free",
      is_published: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createWorkoutSchema.safeParse({
      title: "",
      youtube_id: "abc123",
      category: "gluteo",
      level: "iniciante",
      duration_minutes: 30,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category", () => {
    const result = createWorkoutSchema.safeParse({
      title: "Test",
      youtube_id: "abc123",
      category: "invalid_category",
      level: "iniciante",
      duration_minutes: 30,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative duration", () => {
    const result = createWorkoutSchema.safeParse({
      title: "Test",
      youtube_id: "abc123",
      category: "hiit",
      level: "avancado",
      duration_minutes: -5,
    });
    expect(result.success).toBe(false);
  });

  it("defaults required_plan to free", () => {
    const result = createWorkoutSchema.parse({
      title: "Test",
      youtube_id: "abc123",
      category: "full",
      level: "iniciante",
      duration_minutes: 20,
    });
    expect(result.required_plan).toBe("free");
  });
});

describe("createCouponSchema", () => {
  it("validates a correct coupon", () => {
    const result = createCouponSchema.safeParse({
      title: "Desconto Whey",
      code: "whey20",
      discount_pct: 20,
      partner_name: "Growth",
      partner_url: "https://growth.com.br",
      module: "fitness",
      valid_until: "2026-12-31",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("WHEY20"); // uppercase transform
    }
  });

  it("rejects invalid URL", () => {
    const result = createCouponSchema.safeParse({
      title: "Test",
      code: "TEST",
      partner_name: "Test",
      partner_url: "not-a-url",
      module: "fitness",
      valid_until: "2026-12-31",
    });
    expect(result.success).toBe(false);
  });

  it("rejects discount > 100", () => {
    const result = createCouponSchema.safeParse({
      title: "Test",
      code: "TEST",
      discount_pct: 150,
      partner_name: "Test",
      partner_url: "https://test.com",
      module: "fitness",
      valid_until: "2026-12-31",
    });
    expect(result.success).toBe(false);
  });
});

describe("createAffiliateSchema", () => {
  it("validates a correct affiliate link", () => {
    const result = createAffiliateSchema.safeParse({
      title: "Whey Protein",
      image_url: "https://example.com/img.jpg",
      module: "fitness",
      category: "suplementos",
      platform: "amazon",
      affiliate_url: "https://amazon.com.br/dp/xxx",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid platform", () => {
    const result = createAffiliateSchema.safeParse({
      title: "Test",
      image_url: "https://example.com/img.jpg",
      module: "fitness",
      category: "test",
      platform: "aliexpress",
      affiliate_url: "https://test.com",
    });
    expect(result.success).toBe(false);
  });
});

describe("createProductSchema", () => {
  it("validates a correct product", () => {
    const result = createProductSchema.safeParse({
      title: "Camiseta KathApp",
      image_url: "https://example.com/img.jpg",
      price_cents: 4990,
      category: "camiseta",
    });
    expect(result.success).toBe(true);
  });

  it("rejects zero price", () => {
    const result = createProductSchema.safeParse({
      title: "Test",
      image_url: "https://example.com/img.jpg",
      price_cents: 0,
      category: "test",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateConsultationSchema", () => {
  it("validates partial update", () => {
    const result = updateConsultationSchema.safeParse({
      status: "delivered",
      notes_admin: "Plano entregue com sucesso",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = updateConsultationSchema.safeParse({
      status: "invalid_status",
    });
    expect(result.success).toBe(false);
  });
});
