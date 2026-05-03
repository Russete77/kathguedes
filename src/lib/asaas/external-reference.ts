export type ParsedExternalReference =
  | { type: "estetica";    reference_type: "booking";       reference_id: string }
  | { type: "loja";        reference_type: "order";         reference_id: string }
  | { type: "mensalidade"; reference_type: "subscription";  reference_id: string };

/**
 * Routing do externalReference do Asaas para o tipo de revenue_stream.
 *
 * Patterns:
 * - "estetica:<bookingId>" → type=estetica
 * - "loja:<orderId>"       → type=loja
 * - "<clerk_user_id>"      → type=mensalidade (subscription do user)
 * - falsy                  → null (caller decide)
 */
export function parseExternalReference(
  raw: string | null | undefined,
): ParsedExternalReference | null {
  if (!raw) return null;
  if (raw.startsWith("estetica:")) {
    return { type: "estetica", reference_type: "booking", reference_id: raw.slice("estetica:".length) };
  }
  if (raw.startsWith("loja:")) {
    return { type: "loja", reference_type: "order", reference_id: raw.slice("loja:".length) };
  }
  return { type: "mensalidade", reference_type: "subscription", reference_id: raw };
}
