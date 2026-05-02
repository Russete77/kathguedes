/**
 * Asaas API Configuration.
 * Docs: https://docs.asaas.com
 */

const ASAAS_ENV = process.env.ASAAS_ENV || "sandbox";

export const ASAAS_CONFIG = {
  baseUrl:
    ASAAS_ENV === "production"
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3",
  get apiKey(): string {
    const key = process.env.ASAAS_API_KEY;
    if (!key) throw new Error("[asaas] Missing ASAAS_API_KEY");
    return key;
  },
  get webhookToken(): string {
    const token = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!token) throw new Error("[asaas] Missing ASAAS_WEBHOOK_TOKEN");
    return token;
  },
} as const;

export const PLAN_PRICES = {
  start: 19,
  pro: 39,
  vip: 99,
} as const;

export const PLAN_DESCRIPTIONS = {
  start: "KathApp START — Biblioteca completa + cupons",
  pro: "KathApp PRO — Tudo do START + cupons early access + descontos",
  vip: "KathApp VIP — Consultoria mensal + chat direto + lives exclusivas",
} as const;
