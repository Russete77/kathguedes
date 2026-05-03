/**
 * Asaas API config.
 *
 * PLAN_PRICES, PLAN_DESCRIPTIONS e PLAN_HIERARCHY foram movidos
 * para a tabela `plans` (admin-editável via /admin/plans).
 *
 * Ver: src/lib/billing/plans.ts
 */
export const ASAAS_CONFIG = {
  apiKey: process.env.ASAAS_API_KEY ?? "",
  webhookToken: process.env.ASAAS_WEBHOOK_TOKEN ?? "",
  baseUrl:
    process.env.ASAAS_ENV === "production"
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3",
  env: process.env.ASAAS_ENV === "production" ? "production" : "sandbox",
} as const;
