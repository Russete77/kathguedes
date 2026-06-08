export type ParsedExternalReference =
  | { type: "loja"; reference_type: "order"; reference_id: string }
  | {
      type: "mensalidade";
      reference_type: "subscription";
      reference_id: string; // Clerk user id
      plan?: string; // tier slug (novo modelo)
      cycle?: string; // 'semestral' | 'anual'
    };

/**
 * Routing do externalReference do Asaas para o tipo de revenue_stream.
 *
 * Patterns:
 * - "loja:<orderId>"                  → type=loja
 * - "<userId>:<plan>:<cycle>"         → type=mensalidade (modelo semestral/anual)
 * - "<userId>"                        → type=mensalidade legado (sem plan/cycle)
 * - falsy                             → null (caller decide)
 *
 * Clerk user ids ("user_2ab…") não contêm ":", então split(":") é seguro.
 */
export function parseExternalReference(
  raw: string | null | undefined,
): ParsedExternalReference | null {
  if (!raw) return null;
  if (raw.startsWith("loja:")) {
    return { type: "loja", reference_type: "order", reference_id: raw.slice("loja:".length) };
  }
  const parts = raw.split(":");
  if (parts.length === 3) {
    const [userId, plan, cycle] = parts;
    return {
      type: "mensalidade",
      reference_type: "subscription",
      reference_id: userId,
      plan,
      cycle,
    };
  }
  // Legado: referência crua = userId.
  return { type: "mensalidade", reference_type: "subscription", reference_id: raw };
}

/** Monta a referência de mensalidade do novo modelo. */
export function buildMensalidadeReference(
  userId: string,
  plan: string,
  cycle: string,
): string {
  return `${userId}:${plan}:${cycle}`;
}
