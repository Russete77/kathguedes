/**
 * Entregas locais via 99 Entrega e Lalamove.
 *
 * 99 Entrega: https://dev.99app.com/docs/deliveries
 * Lalamove: https://developers.lalamove.com
 *
 * Ambos funcionam como Uber pra entregas:
 * - Cotação instantânea baseada em distância
 * - Entrega no mesmo dia (1-3h)
 * - Rastreamento em tempo real
 *
 * Env vars:
 * - ENTREGA99_API_KEY, ENTREGA99_API_SECRET
 * - LALAMOVE_API_KEY, LALAMOVE_API_SECRET
 * - LALAMOVE_ENV: "sandbox" ou "production"
 */

import type { ShippingQuote, ShippingAddress } from "./types";
import { getOriginAddress } from "./types";

// ── 99 Entrega ──

const ENTREGA99_BASE = "https://api.99app.com/v1";

async function entrega99Request<T>(endpoint: string, method = "GET", body?: object): Promise<T> {
  const apiKey = process.env.ENTREGA99_API_KEY;
  if (!apiKey) throw new Error("[shipping] Missing ENTREGA99_API_KEY");

  const res = await fetch(`${ENTREGA99_BASE}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`99 Entrega ${res.status}: ${JSON.stringify(err)}`);
  }

  return res.json();
}

export async function get99Quotes(destination: ShippingAddress): Promise<ShippingQuote[]> {
  if (!process.env.ENTREGA99_API_KEY) return [];

  try {
    const origin = getOriginAddress();
    const result = await entrega99Request<{
      estimates: Array<{
        vehicle_type: string;
        vehicle_name: string;
        price: number;
        eta_minutes: number;
      }>;
    }>("/deliveries/estimate", "POST", {
      pickup: {
        address: origin.address,
        city: origin.city,
        state: origin.state,
        zipcode: origin.zip,
      },
      dropoff: {
        address: destination.address,
        city: destination.city,
        state: destination.state,
        zipcode: destination.zip,
      },
    });

    return (result.estimates || []).map((e) => ({
      provider: "entrega99" as const,
      service: `99 ${e.vehicle_name}`,
      price_cents: Math.round(e.price * 100),
      estimated_days: 0,
      estimated_delivery: `~${e.eta_minutes} minutos`,
    }));
  } catch (err) {
    console.warn("[shipping] 99 Entrega quote failed:", err);
    return [];
  }
}

export async function create99Delivery(params: {
  orderId: string;
  destination: ShippingAddress;
  vehicleType: string;
  recipientName: string;
  recipientPhone: string;
}): Promise<{ delivery_id: string; tracking_url: string }> {
  const origin = getOriginAddress();

  const result = await entrega99Request<{
    id: string;
    tracking_url: string;
  }>("/deliveries", "POST", {
    vehicle_type: params.vehicleType,
    pickup: {
      address: origin.address,
      city: origin.city,
      state: origin.state,
      zipcode: origin.zip,
      contact_name: "KathApp",
      contact_phone: process.env.SHIPPING_CONTACT_PHONE || "",
    },
    dropoff: {
      address: params.destination.address,
      city: params.destination.city,
      state: params.destination.state,
      zipcode: params.destination.zip,
      contact_name: params.recipientName,
      contact_phone: params.recipientPhone,
    },
    external_id: params.orderId,
  });

  return {
    delivery_id: result.id,
    tracking_url: result.tracking_url,
  };
}

// ── Lalamove ──

const LALAMOVE_BASE =
  process.env.LALAMOVE_ENV === "production"
    ? "https://rest.lalamove.com"
    : "https://rest.sandbox.lalamove.com";

async function lalamoveRequest<T>(endpoint: string, method = "GET", body?: object): Promise<T> {
  const apiKey = process.env.LALAMOVE_API_KEY;
  const apiSecret = process.env.LALAMOVE_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error("[shipping] Missing LALAMOVE credentials");

  // Lalamove usa HMAC auth — simplificado aqui, implementar assinatura real
  const timestamp = Date.now().toString();

  const res = await fetch(`${LALAMOVE_BASE}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `hmac ${apiKey}:${timestamp}:signature`,
      "X-LLM-Country": "BR",
      "X-Request-ID": crypto.randomUUID(),
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Lalamove ${res.status}: ${JSON.stringify(err)}`);
  }

  return res.json();
}

export async function getLalamoveQuotes(destination: ShippingAddress): Promise<ShippingQuote[]> {
  if (!process.env.LALAMOVE_API_KEY) return [];

  try {
    const origin = getOriginAddress();

    const result = await lalamoveRequest<{
      data: {
        priceBreakdown: { total: string };
        serviceType: string;
      };
    }>("/v3/quotations", "POST", {
      data: {
        serviceType: "MOTORCYCLE",
        language: "pt_BR",
        stops: [
          {
            coordinates: { lat: "0", lng: "0" }, // Geocoding needed
            address: `${origin.address}, ${origin.city} - ${origin.state}`,
          },
          {
            coordinates: { lat: "0", lng: "0" },
            address: `${destination.address}, ${destination.city} - ${destination.state}`,
          },
        ],
      },
    });

    return [
      {
        provider: "lalamove" as const,
        service: "Lalamove Moto",
        price_cents: Math.round(parseFloat(result.data.priceBreakdown.total) * 100),
        estimated_days: 0,
        estimated_delivery: "~45 minutos",
      },
    ];
  } catch (err) {
    console.warn("[shipping] Lalamove quote failed:", err);
    return [];
  }
}

export async function createLalamoveOrder(params: {
  orderId: string;
  destination: ShippingAddress;
  recipientName: string;
  recipientPhone: string;
  quotationId: string;
}): Promise<{ order_id: string; tracking_url: string }> {
  // Origin não usado neste endpoint (Lalamove guarda no quotation_id).
  // Mantido por simetria com createEntrega99Order; remover quando refactorar.
  void getOriginAddress;

  const result = await lalamoveRequest<{
    data: { orderRef: string; shareLink: string };
  }>("/v3/orders", "POST", {
    data: {
      quotationId: params.quotationId,
      sender: {
        stopId: "stop1",
        name: "KathApp",
        phone: process.env.SHIPPING_CONTACT_PHONE || "",
      },
      recipients: [
        {
          stopId: "stop2",
          name: params.recipientName,
          phone: params.recipientPhone,
        },
      ],
      metadata: { orderId: params.orderId },
    },
  });

  return {
    order_id: result.data.orderRef,
    tracking_url: result.data.shareLink,
  };
}
