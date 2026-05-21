/**
 * Helpers PUROS para cashback (sem I/O).
 * Centraliza regras de uso de cashback no checkout.
 */

export type ClampInput = {
  requested: number;
  gross: number;
  activeBalance: number;
};

/**
 * Aplica regras de uso de cashback:
 * - maximo 50% do gross
 * - maximo saldo ativo do user
 * - minimo 0
 * - valores nao-finitos (NaN/Infinity) viram 0
 */
export function clampCashbackCents(input: ClampInput): number {
  if (!Number.isFinite(input.requested) || input.requested <= 0) return 0;
  if (!Number.isFinite(input.gross) || input.gross <= 0) return 0;
  if (!Number.isFinite(input.activeBalance) || input.activeBalance <= 0) return 0;
  const halfGross = Math.floor(input.gross * 0.5);
  return Math.min(input.requested, halfGross, input.activeBalance);
}

export function computeAmountPaidCash(input: { gross: number; cashbackUsed: number }): number {
  return Math.max(0, input.gross - input.cashbackUsed);
}
