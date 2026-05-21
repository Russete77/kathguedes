/**
 * Normalização e validação de placas de veículo brasileiras.
 *
 * Formatos aceitos:
 *   - Mercosul: 3 letras + 1 número + 1 letra + 2 números → "ABC1D23"
 *   - Antigo:   3 letras + 4 números                     → "ABC1234"
 *
 * Após normalização ambos viram 7 caracteres uppercase sem traço/espaço,
 * o que casa com o regex armazenado em `estetica_vehicles.plate` (CHECK).
 */

const PLATE_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

/**
 * Normaliza uma string para uso como placa.
 * Remove tudo que não é [A-Z0-9], faz uppercase e retorna os caracteres no padrão.
 * NÃO valida — só normaliza. Use `isValidPlate` em seguida.
 */
export function normalizePlate(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);
}

/**
 * Retorna true se a placa (já normalizada) está em formato Mercosul ou antigo.
 * Não chama normalize por dentro — caller deve normalizar antes.
 */
export function isValidPlate(plate: string): boolean {
  return PLATE_REGEX.test(plate);
}

/**
 * Pipeline: normaliza e valida. Retorna a placa normalizada se válida, null se não.
 */
export function parsePlate(input: string | null | undefined): string | null {
  const normalized = normalizePlate(input);
  return isValidPlate(normalized) ? normalized : null;
}

/**
 * Formata para exibição com traço (ABC-1D23). Mantém DB sem traço.
 */
export function formatPlate(plate: string): string {
  const n = normalizePlate(plate);
  if (n.length !== 7) return plate;
  return `${n.slice(0, 3)}-${n.slice(3)}`;
}
