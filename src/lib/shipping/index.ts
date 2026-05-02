/**
 * Shipping module — API unificada de frete.
 *
 * Combina:
 * - Melhor Envio (nacional: Correios, Jadlog, Total Express)
 * - 99 Entrega (local: moto, carro)
 * - Lalamove (local: moto, carro, van)
 *
 * O frontend chama getShippingOptions() e recebe todas as opções ordenadas por preço.
 */

export * from "./types";
export { getShippingQuotes as getMelhorEnvioQuotes } from "./melhor-envio";
export { generateFullLabel } from "./melhor-envio";
export { get99Quotes, getLalamoveQuotes } from "./local-delivery";

import type { ShippingQuote, ShippingPackage } from "./types";
import { getShippingQuotes as getMelhorEnvioQuotes } from "./melhor-envio";
import { get99Quotes, getLalamoveQuotes } from "./local-delivery";
import { DEFAULT_PACKAGE } from "./types";

/**
 * Busca cotações de TODOS os provedores disponíveis em paralelo.
 * Retorna ordenado por preço (mais barato primeiro).
 * Nunca falha completamente — se um provedor der erro, retorna os outros.
 */
export async function getShippingOptions(
  destinationZip: string,
  pkg: ShippingPackage = DEFAULT_PACKAGE,
): Promise<ShippingQuote[]> {
  const destination = { zip: destinationZip, city: "", state: "", address: "" };

  const results = await Promise.allSettled([
    getMelhorEnvioQuotes(destinationZip, pkg),
    get99Quotes(destination),
    getLalamoveQuotes(destination),
  ]);

  const quotes: ShippingQuote[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      quotes.push(...result.value);
    } else {
      console.warn("[shipping] Provider failed:", result.reason);
    }
  }

  // Ordenar por preço (mais barato primeiro)
  return quotes.sort((a, b) => a.price_cents - b.price_cents);
}
