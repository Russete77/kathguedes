/**
 * Tipos compartilhados do sistema de frete.
 * Suporta: Melhor Envio (nacional), 99 Entrega (local), Lalamove (local).
 */

export interface ShippingQuote {
  provider: "melhor_envio" | "entrega99" | "lalamove";
  service_id?: number; // ID do serviço no Melhor Envio (necessário para inserir no carrinho)
  service: string; // ex: "Correios — SEDEX", "99 Moto"
  price_cents: number;
  estimated_days: number;
  estimated_delivery: string; // "3-5 dias úteis"
  logo_url?: string;
}

export interface ShippingAddress {
  zip: string;
  city: string;
  state: string;
  address: string;
  number?: string;
  complement?: string;
  district?: string;
}

export interface ShippingPackage {
  weight_kg: number;
  height_cm: number;
  width_cm: number;
  length_cm: number;
}

export interface ShippingLabel {
  provider: string;
  label_url: string;
  tracking_code: string;
  order_id: string;
}

/** Dados de entrega armazenados no pedido */
export interface ShippingInfo {
  name: string;
  phone: string;
  address: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  zip: string;
}

// Endereço de origem (remetente) — configurar no .env
export function getOriginAddress(): ShippingAddress {
  return {
    zip: process.env.SHIPPING_ORIGIN_ZIP || "01001000",
    city: process.env.SHIPPING_ORIGIN_CITY || "São Paulo",
    state: process.env.SHIPPING_ORIGIN_STATE || "SP",
    address: process.env.SHIPPING_ORIGIN_ADDRESS || "",
  };
}

// Pacote padrão para cotação (caixa pequena ~0.5kg)
export const DEFAULT_PACKAGE: ShippingPackage = {
  weight_kg: 0.5,
  height_cm: 10,
  width_cm: 20,
  length_cm: 30,
};
