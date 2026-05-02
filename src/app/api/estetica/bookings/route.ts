import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import {
  type EsteticaService,
  finalPriceCents,
  planDiscount,
} from "@/lib/estetica/types";

/**
 * POST /api/estetica/bookings
 * Cria agendamento de estética.
 * Recalcula preço server-side — nunca confia no cliente.
 * Valida disponibilidade do slot antes de inserir.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { allowed } = await checkRateLimitAsync(`estetica-booking:${userId}`, {
    maxRequests: 5,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde 1 minuto." },
      { status: 429 },
    );
  }

  let body: {
    service_id: string;
    scheduled_at: string;
    vehicle_brand: string;
    vehicle_model: string;
    vehicle_plate: string;
    vehicle_color: string | null;
    customer_name: string;
    customer_phone: string;
    use_loyalty: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (
    !body.service_id ||
    !body.scheduled_at ||
    !body.vehicle_brand ||
    !body.vehicle_model ||
    !body.vehicle_plate ||
    !body.customer_name ||
    !body.customer_phone
  ) {
    return NextResponse.json(
      { error: "Campos obrigatórios faltando" },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();

  // 1. Buscar serviço (servidor confia só nos valores do DB)
  const { data: serviceRaw } = await supabase
    .from("estetica_services")
    .select("*")
    .eq("id", body.service_id)
    .eq("is_active", true)
    .single();

  if (!serviceRaw) {
    return NextResponse.json(
      { error: "Serviço não encontrado" },
      { status: 404 },
    );
  }
  const service = serviceRaw as unknown as EsteticaService;

  // 2. Buscar plan_tier do usuário
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId)
    .single();
  const planTier = (profile?.plan_tier as string) || "free";

  // 3. Validar slot disponível (reutiliza RPC get_available_slots pra consistência)
  const dateStr = body.scheduled_at.slice(0, 10);
  const { data: availableSlots } = await supabase.rpc("get_available_slots", {
    p_date: dateStr,
    p_duration_min: service.duration_min,
  });
  const slotsArr = (availableSlots || []) as string[];
  const requestedMs = new Date(body.scheduled_at).getTime();
  const slotAvailable = slotsArr.some(
    (s) => new Date(s).getTime() === requestedMs,
  );
  if (!slotAvailable) {
    return NextResponse.json(
      { error: "Horário não está mais disponível" },
      { status: 409 },
    );
  }

  // 4. Validar fidelidade (se solicitada)
  let loyaltyFree = false;
  if (body.use_loyalty && service.eligible_for_loyalty) {
    const { data: eligible } = await supabase.rpc("check_loyalty_eligibility", {
      p_user_id: userId,
    });
    if (eligible === true) {
      loyaltyFree = true;
    } else {
      return NextResponse.json(
        { error: "Benefício fidelidade não disponível" },
        { status: 400 },
      );
    }
  }

  // 5. Recalcular preço
  const basePrice = service.price_cents;
  const finalCents = finalPriceCents(service, planTier);
  const planDiscountCents = basePrice - finalCents;
  const totalCents = loyaltyFree ? 0 : finalCents;

  // 6. Inserir booking
  const { data: booking, error } = await supabase
    .from("estetica_bookings")
    .insert({
      user_id: userId,
      service_id: service.id,
      scheduled_at: body.scheduled_at,
      duration_min: service.duration_min,
      vehicle_brand: body.vehicle_brand,
      vehicle_model: body.vehicle_model,
      vehicle_plate: body.vehicle_plate,
      vehicle_color: body.vehicle_color,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      status: loyaltyFree ? "confirmed" : "pending",
      price_cents: basePrice,
      plan_discount_cents: planDiscountCents,
      loyalty_free: loyaltyFree,
      total_cents: totalCents,
      paid_at: loyaltyFree ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    bookingId: booking?.id,
    loyaltyUsed: loyaltyFree,
  });
}
