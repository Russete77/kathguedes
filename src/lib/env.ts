/**
 * Runtime environment validation.
 * Falha rapido na ausencia de var critica em vez de null silencioso.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error("[env] Missing required environment variable: " + name);
  }
  return value;
}

function optional(name: string, fallback: string = ""): string {
  return process.env[name] || fallback;
}

/**
 * Required em PROD, opcional em dev/preview.
 * Para vars com fallback funcional em dev (ex: REDIS in-memory)
 * mas que precisam estar setadas em prod para correcao.
 */
function requiredInProduction(name: string): string {
  const value = process.env[name];
  const isProd =
    process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";
  if (!value && isProd) {
    throw new Error(
      "[env] Missing required environment variable in production: " +
        name +
        ". Set this in your Vercel project settings or production .env."
    );
  }
  return value || "";
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",

  get SUPABASE_SERVICE_ROLE_KEY() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get ASAAS_API_KEY() {
    return required("ASAAS_API_KEY");
  },
  get ASAAS_WEBHOOK_TOKEN() {
    return required("ASAAS_WEBHOOK_TOKEN");
  },
  get VAPID_PRIVATE_KEY() {
    return required("VAPID_PRIVATE_KEY");
  },

  /**
   * REDIS_URL eh REQUIRED em prod. O fallback in-memory do rate-limit
   * nao funciona em multi-instancia (Vercel serverless), entao o limite
   * efetivo vira N x limite onde N eh o numero de instancias.
   */
  get REDIS_URL() {
    return requiredInProduction("REDIS_URL");
  },

  /**
   * SENTRY_DSN eh REQUIRED em prod para capturar erros.
   * Em dev, opcional (nao queremos disparar erros para nosso projeto Sentry).
   */
  get SENTRY_DSN() {
    return requiredInProduction("SENTRY_DSN");
  },

  ASAAS_ENV: optional("ASAAS_ENV", "sandbox"),
  VAPID_EMAIL: optional("VAPID_EMAIL", "mailto:contato@kathapp.com"),
} as const;
