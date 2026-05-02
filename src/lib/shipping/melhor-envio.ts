/**
 * Melhor Envio API Client — entregas nacionais.
 * Docs oficiais: https://docs.melhorenvio.com.br/reference/introducao-api-melhor-envio
 *
 * Fluxo completo para etiquetas:
 * 1. Cotação  → POST /api/v2/me/shipment/calculate
 * 2. Carrinho → POST /api/v2/me/cart
 * 3. Checkout → POST /api/v2/me/shipment/checkout
 * 4. Gerar    → POST /api/v2/me/shipment/generate
 * 5. Imprimir → POST /api/v2/me/shipment/print
 * 6. Rastreio → POST /api/v2/me/shipment/tracking
 *
 * Sandbox: https://sandbox.melhorenvio.com.br
 * Produção: https://melhorenvio.com.br
 *
 * Env vars:
 * - MELHOR_ENVIO_TOKEN
 * - MELHOR_ENVIO_ENV ("sandbox" | "production") — default "sandbox"
 */

import type { ShippingQuote, ShippingPackage } from "./types";
import { getOriginAddress, DEFAULT_PACKAGE } from "./types";

/* ─── Config ─── */

const IS_PRODUCTION = process.env.MELHOR_ENVIO_ENV === "production";

const API_BASE = IS_PRODUCTION
  ? "https://melhorenvio.com.br/api/v2/me"
  : "https://sandbox.melhorenvio.com.br/api/v2/me";

/** User-Agent obrigatório no formato "App (email)" — exigido pela API */
const USER_AGENT = "KathApp (contato@kathapp.com)";

function getToken(): string {
  const token = process.env.MELHOR_ENVIO_TOKEN;
  if (!token) throw new Error("[melhor-envio] MELHOR_ENVIO_TOKEN não configurado");
  return token;
}

/* ─── HTTP helper ─── */

async function api<T>(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  console.log(`[melhor-envio] ${method} ${url}`);

  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      "User-Agent": USER_AGENT,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  const text = await res.text();

  if (!res.ok) {
    console.error(`[melhor-envio] ${res.status} ${res.statusText}`, text);
    throw new Error(
      `Melhor Envio API ${res.status}: ${text.slice(0, 500)}`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`[melhor-envio] Resposta não é JSON: ${text.slice(0, 200)}`);
  }
}

/* ─── 1. Cotação de Frete ─── */

interface MelhorEnvioQuoteResult {
  id: number;
  name: string;
  price: string;
  custom_price: string;
  discount: string;
  currency: string;
  delivery_time: number;
  delivery_range: { min: number; max: number };
  custom_delivery_time: number;
  custom_delivery_range: { min: number; max: number };
  packages: Array<{
    price: string;
    discount: string;
    format: string;
    dimensions: { height: number; width: number; length: number };
    weight: string;
    insurance_value: string;
  }>;
  additional_services: {
    receipt: boolean;
    own_hand: boolean;
    collect: boolean;
  };
  company: {
    id: number;
    name: string;
    picture: string;
  };
  error?: string;
}

/**
 * Calcula fretes disponíveis entre dois CEPs.
 * POST /api/v2/me/shipment/calculate
 */
export async function getShippingQuotes(
  destinationZip: string,
  pkg: ShippingPackage = DEFAULT_PACKAGE,
): Promise<ShippingQuote[]> {
  const origin = getOriginAddress();
  const cleanOrigin = origin.zip.replace(/\D/g, "");
  const cleanDest = destinationZip.replace(/\D/g, "");

  const body = {
    from: {
      postal_code: cleanOrigin,
    },
    to: {
      postal_code: cleanDest,
    },
    products: [
      {
        id: "default",
        width: pkg.width_cm,
        height: pkg.height_cm,
        length: pkg.length_cm,
        weight: pkg.weight_kg,
        insurance_value: 0,
        quantity: 1,
      },
    ],
  };

  console.log("[melhor-envio] calculate body:", JSON.stringify(body));

  const results = await api<MelhorEnvioQuoteResult[]>(
    "/shipment/calculate",
    "POST",
    body,
  );

  return results
    .filter((r) => !r.error && parseFloat(r.price) > 0)
    .map((r) => ({
      provider: "melhor_envio" as const,
      service_id: r.id,
      service: `${r.company.name} — ${r.name}`,
      price_cents: Math.round(parseFloat(r.custom_price || r.price) * 100),
      estimated_days: r.delivery_time,
      estimated_delivery: r.delivery_range
        ? `${r.delivery_range.min}-${r.delivery_range.max} dias úteis`
        : `${r.delivery_time} dia(s) úteis`,
      logo_url: r.company.picture,
    }));
}

/* ─── 2. Inserir no Carrinho ─── */

interface CartAddParams {
  serviceId: number;
  from: {
    name: string;
    phone: string;
    email?: string;
    document?: string;
    address: string;
    number: string;
    district: string;
    city: string;
    state_abbr: string;
    postal_code: string;
    complement?: string;
    note?: string;
  };
  to: {
    name: string;
    phone: string;
    email?: string;
    document?: string;
    address: string;
    number: string;
    district: string;
    city: string;
    state_abbr: string;
    postal_code: string;
    complement?: string;
    note?: string;
  };
  products: Array<{
    name: string;
    quantity: number;
    unitary_value: number;
  }>;
  volumes: Array<{
    height: number;
    width: number;
    length: number;
    weight: number;
  }>;
  options?: {
    insurance_value?: number;
    receipt?: boolean;
    own_hand?: boolean;
    reverse?: boolean;
    non_commercial?: boolean;
    invoice?: { key: string };
  };
  tag?: string;
}

interface CartAddResponse {
  id: string;
  protocol: string;
  service_id: number;
  agency_id: number | null;
  quote: number;
  price: number;
  discount: number;
  delivery_min: number;
  delivery_max: number;
  status: string;
}

/**
 * Adiciona envio ao carrinho do Melhor Envio.
 * POST /api/v2/me/cart
 */
export async function addToCart(params: CartAddParams): Promise<CartAddResponse> {
  const body = {
    service: params.serviceId,
    from: {
      name: params.from.name,
      phone: params.from.phone,
      email: params.from.email || "",
      document: params.from.document || "",
      address: params.from.address,
      complement: params.from.complement || "",
      number: params.from.number || "S/N",
      district: params.from.district || "",
      city: params.from.city,
      country_id: "BR",
      postal_code: params.from.postal_code.replace(/\D/g, ""),
      state_abbr: params.from.state_abbr,
      note: params.from.note || "",
    },
    to: {
      name: params.to.name,
      phone: params.to.phone,
      email: params.to.email || "",
      document: params.to.document || "",
      address: params.to.address,
      complement: params.to.complement || "",
      number: params.to.number || "S/N",
      district: params.to.district || "",
      city: params.to.city,
      country_id: "BR",
      postal_code: params.to.postal_code.replace(/\D/g, ""),
      state_abbr: params.to.state_abbr,
      note: params.to.note || "",
    },
    products: params.products,
    volumes: params.volumes,
    options: {
      insurance_value: params.options?.insurance_value ?? 0,
      receipt: params.options?.receipt ?? false,
      own_hand: params.options?.own_hand ?? false,
      reverse: params.options?.reverse ?? false,
      non_commercial: params.options?.non_commercial ?? true,
    },
    ...(params.tag && { tag: params.tag }),
  };

  console.log("[melhor-envio] addToCart body:", JSON.stringify(body));

  return api<CartAddResponse>("/cart", "POST", body);
}

/* ─── 3. Checkout (Compra de Frete) ─── */

/**
 * Compra os fretes do carrinho.
 * POST /api/v2/me/shipment/checkout
 */
export async function checkoutShipment(
  orderIds: string[],
): Promise<{
  purchase: { id: string; protocol: string; status: string };
}> {
  return api("/shipment/checkout", "POST", { orders: orderIds });
}

/* ─── 4. Gerar Etiqueta ─── */

/**
 * Gera etiquetas para envios já pagos.
 * POST /api/v2/me/shipment/generate
 */
export async function generateShipment(
  orderIds: string[],
): Promise<Record<string, { status: boolean; message: string }>> {
  return api("/shipment/generate", "POST", { orders: orderIds });
}

/* ─── 5. Imprimir Etiqueta (obter URL) ─── */

/**
 * Obtém URL para impressão da etiqueta.
 * POST /api/v2/me/shipment/print
 */
export async function printLabel(
  orderIds: string[],
): Promise<{ url: string }> {
  return api("/shipment/print", "POST", {
    mode: "private",
    orders: orderIds,
  });
}

/* ─── 6. Rastreio ─── */

interface TrackingResult {
  [orderId: string]: {
    id: string;
    protocol: string;
    status: string;
    tracking: string;
    melhorenvio_tracking?: Array<{
      description: string;
      created_at: string;
    }>;
  };
}

/**
 * Consulta status/rastreamento de envios.
 * POST /api/v2/me/shipment/tracking
 */
export async function getTracking(
  orderIds: string[],
): Promise<TrackingResult> {
  return api("/shipment/tracking", "POST", { orders: orderIds });
}

/* ─── Fluxo completo: gerar etiqueta de ponta a ponta ─── */

/**
 * Fluxo completo para gerar etiqueta:
 * 1. Adiciona ao carrinho
 * 2. Faz checkout (compra o frete)
 * 3. Gera a etiqueta
 * 4. Obtém URL de impressão
 * 5. Obtém código de rastreio
 */
export async function generateFullLabel(params: CartAddParams): Promise<{
  cart_id: string;
  tracking_code: string;
  label_url: string;
}> {
  // 1. Adicionar ao carrinho
  console.log("[melhor-envio] Step 1: Adding to cart...");
  const cartItem = await addToCart(params);
  const cartId = cartItem.id;
  console.log("[melhor-envio] Cart ID:", cartId);

  // 2. Checkout (comprar frete)
  console.log("[melhor-envio] Step 2: Checkout...");
  await checkoutShipment([cartId]);

  // 3. Gerar etiqueta
  console.log("[melhor-envio] Step 3: Generating label...");
  const genResult = await generateShipment([cartId]);
  console.log("[melhor-envio] Generate result:", JSON.stringify(genResult));

  // 4. Obter URL de impressão
  console.log("[melhor-envio] Step 4: Getting print URL...");
  const printResult = await printLabel([cartId]);
  const labelUrl = printResult.url || "";
  console.log("[melhor-envio] Label URL:", labelUrl);

  // 5. Obter tracking
  console.log("[melhor-envio] Step 5: Getting tracking...");
  const trackingResult = await getTracking([cartId]);
  const trackingData = trackingResult[cartId];
  const trackingCode = trackingData?.tracking || "";
  console.log("[melhor-envio] Tracking code:", trackingCode);

  return {
    cart_id: cartId,
    tracking_code: trackingCode,
    label_url: labelUrl,
  };
}
