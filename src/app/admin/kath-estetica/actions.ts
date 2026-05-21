"use server";

import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { notifyUser } from "@/lib/notifications";
import { adminBookingSchema, createEsteticaServiceSchema, walkinServiceSchema } from "@/lib/validations";
import type { PlanTier } from "@/lib/supabase/types";
import { getCashbackPct } from "@/lib/billing/plans";
import { creditWalletCents } from "@/lib/billing/wallet";
import { parsePlate } from "@/lib/estetica/plates";
import { getServicePricing, listVehicleTypes } from "@/lib/estetica/pricing";
import type {
  EsteticaVehicleType,
  ServicePricing,
} from "@/lib/estetica/pricing-types";
import { recordRevenueStream } from "@/lib/billing/revenue";
import { z } from "zod";
import type {
  EsteticaCustomerRow,
  EsteticaVehicleRow,
  EsteticaWalkinServiceRow,
} from "@/lib/estetica/walkin-types";

async function requireAdmin() {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Não autenticado");
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") throw new Error("Acesso negado");
  return userId;
}

// ══════════════════════════════════════════
// SERVICES
// ══════════════════════════════════════════

export async function getServices() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("estetica_services")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createService(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const includes = (formData.get("includes") as string)
    ?.split("\n")
    .map((s) => s.trim())
    .filter(Boolean) || [];

  const raw: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    if (key !== "includes") raw[key] = value === "" ? null : value;
  });
  raw.includes = includes;

  const data = createEsteticaServiceSchema.parse(raw);

  const { error } = await supabase.from("estetica_services").insert({
    title: data.title,
    description: data.description || null,
    image_url: data.image_url || null,
    category: data.category,
    duration_min: data.duration_min,
    price_cents: data.price_cents,
    cost_cents: data.cost_cents,
    compare_price: data.compare_price ?? null,
    includes: data.includes,
    eligible_for_loyalty: data.eligible_for_loyalty,
    requires_paid_plan: data.requires_paid_plan,
    is_active: data.is_active,
    sort_order: data.sort_order,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/kath-estetica/servicos");
}

export async function updateService(id: string, formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const includes = (formData.get("includes") as string)
    ?.split("\n")
    .map((s) => s.trim())
    .filter(Boolean) || [];

  const raw: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    if (key !== "includes") raw[key] = value === "" ? null : value;
  });
  raw.includes = includes;

  const data = createEsteticaServiceSchema.parse(raw);

  const { error } = await supabase
    .from("estetica_services")
    .update({
      title: data.title,
      description: data.description || null,
      image_url: data.image_url || null,
      category: data.category,
      duration_min: data.duration_min,
      price_cents: data.price_cents,
      cost_cents: data.cost_cents,
      compare_price: data.compare_price ?? null,
      includes: data.includes,
      eligible_for_loyalty: data.eligible_for_loyalty,
      requires_paid_plan: data.requires_paid_plan,
      is_active: data.is_active,
      sort_order: data.sort_order,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/kath-estetica/servicos");
}

export async function deleteService(id: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("estetica_services")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/kath-estetica/servicos");
}

// ══════════════════════════════════════════
// BOOKINGS
// ══════════════════════════════════════════

export async function getBookings() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("estetica_bookings")
    .select("*, estetica_services(title, cost_cents)")
    .order("scheduled_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Marca o restante (remaining_cents) de um booking como pago presencialmente.
 *
 * Fluxo da vitrificação: cliente paga sinal de 50% via Asaas (webhook seta
 * prepay_paid_at). Quando entrega presencialmente o restante (PIX/dinheiro/
 * cartão), o admin aciona essa action que:
 *   1. Marca paid_at = now() e zera remaining_cents.
 *   2. Cria um segundo revenue_stream com gross = restante e cost = custo
 *      total do serviço (o stream do sinal teve cost = 0 — agora alocamos).
 *   3. Notifica o cliente da quitação.
 *
 * Idempotente: rejeita se já foi quitado (paid_at preenchido) ou se
 * remaining_cents == 0.
 */
export async function markBookingRemainderPaid(
  bookingId: string,
  paymentMethod: "dinheiro" | "pix" | "cartao_debito" | "cartao_credito" | "transferencia" | "outro",
): Promise<{ ok: true; revenueStreamId: string }> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const { data: bookingRaw, error: lookupErr } = await supabase
    .from("estetica_bookings")
    .select(
      "id, user_id, total_cents, prepay_cents, prepay_paid_at, paid_at, remaining_cents, service_id, status, estetica_services(title, cost_cents)",
    )
    .eq("id", bookingId)
    .single();
  if (lookupErr || !bookingRaw) {
    throw new Error("Agendamento não encontrado");
  }

  const booking = bookingRaw as unknown as {
    id: string;
    user_id: string;
    total_cents: number;
    prepay_cents: number | null;
    prepay_paid_at: string | null;
    paid_at: string | null;
    remaining_cents: number | null;
    service_id: string;
    status: string;
    estetica_services: { title: string; cost_cents: number } | null;
  };

  if (booking.paid_at) {
    throw new Error("Este agendamento já foi quitado.");
  }
  if (booking.status === "canceled" || booking.status === "no_show") {
    throw new Error("Agendamento cancelado ou no-show — não dá para quitar.");
  }

  const remaining = booking.remaining_cents ?? 0;
  if (remaining <= 0) {
    throw new Error("Nada a quitar: restante já é zero.");
  }

  const nowIso = new Date().toISOString();

  const { error: updErr } = await supabase
    .from("estetica_bookings")
    .update({
      paid_at: nowIso,
      remaining_cents: 0,
      updated_at: nowIso,
    })
    .eq("id", bookingId);
  if (updErr) throw new Error(updErr.message);

  // Revenue stream do restante: aloca o cost_cents completo do serviço aqui
  // (o stream do sinal foi gravado com cost_cents = 0).
  const serviceCost = booking.estetica_services?.cost_cents ?? 0;
  const stream = await recordRevenueStream({
    type: "estetica",
    category: `remainder:${paymentMethod}`,
    user_id: booking.user_id,
    reference_type: "booking",
    reference_id: bookingId,
    asaas_payment_id: null,
    gross_cents: remaining,
    cost_cents: serviceCost,
    cashback_used_cents: 0,
    occurred_at: nowIso,
  });

  notifyUser(booking.user_id, {
    title: "Pagamento finalizado",
    body: `Quitação do serviço ${booking.estetica_services?.title ?? ""} confirmada. Obrigado!`,
    icon: "Check",
    url: "/kath-estetica/meus-agendamentos",
  }).catch(() => {});

  revalidatePath("/admin/kath-estetica/agendamentos");
  return { ok: true, revenueStreamId: stream.id };
}

export async function updateBookingStatus(
  id: string,
  status: "pending" | "confirmed" | "in_progress" | "done" | "canceled" | "no_show",
) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const { data: bookingRaw } = await supabase
    .from("estetica_bookings")
    .select("user_id, total_cents, estetica_services(title), profiles(plan_tier)")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("estetica_bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);

  // Cashback: na transição para 'done', creditar % do total pago em cash
  if (status === "done" && bookingRaw?.user_id) {
    try {
      const planTier = ((bookingRaw as unknown as { profiles: { plan_tier: PlanTier } | null })
        .profiles?.plan_tier) ?? "free";
      const cashbackPct = await getCashbackPct(planTier);
      const earned = Math.floor((bookingRaw.total_cents ?? 0) * cashbackPct / 100);
      if (earned > 0) {
        const { data: rs } = await supabase
          .from("revenue_streams")
          .select("id")
          .eq("type", "estetica")
          .eq("reference_id", id)
          .eq("status", "confirmed")
          .maybeSingle();
        if (rs?.id) {
          await creditWalletCents({
            userId: bookingRaw.user_id as string,
            amountCents: earned,
            sourceStreamId: rs.id,
          });
        }
      }
    } catch (e) {
      console.error("[updateBookingStatus] cashback credit failed", e);
    }
  }

  // Notificar user
  if (bookingRaw?.user_id) {
    const statusMsg: Record<string, string> = {
      confirmed: "Seu agendamento foi confirmado!",
      in_progress: "Seu serviço está em andamento",
      done: "Serviço concluído! Envie a foto pra contar na fidelidade",
      canceled: "Seu agendamento foi cancelado",
      no_show: "Registramos que você não compareceu",
    };
    if (statusMsg[status]) {
      notifyUser(bookingRaw.user_id as string, {
        title: statusMsg[status],
        body: "Confira em Meus Agendamentos",
        icon: "Sparkles",
        url: "/kath-estetica/meus-agendamentos",
      }).catch(() => {});
    }
  }

  revalidatePath("/admin/kath-estetica/agendamentos");
}

// ══════════════════════════════════════════
// LOYALTY PHOTOS
// ══════════════════════════════════════════

export async function getPendingLoyaltyPhotos() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("estetica_loyalty_photos")
    .select("*, profiles(full_name), estetica_bookings(vehicle_plate, vehicle_brand, vehicle_model)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function approveLoyaltyPhoto(id: string, approved: boolean) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const { data: photoRaw } = await supabase
    .from("estetica_loyalty_photos")
    .select("user_id, month")
    .eq("id", id)
    .single();

  if (!approved) {
    // Rejeição: apagar foto do bucket + linha + notificar usuário pra reenviar
    const { data: fullPhoto } = await supabase
      .from("estetica_loyalty_photos")
      .select("photo_url")
      .eq("id", id)
      .single();

    if (fullPhoto?.photo_url) {
      const m = (fullPhoto.photo_url as string).match(/estetica-loyalty\/(.+?)(\?|$)/);
      if (m?.[1]) {
        await supabase.storage.from("estetica-loyalty").remove([m[1]]);
      }
    }

    await supabase.from("estetica_loyalty_photos").delete().eq("id", id);

    if (photoRaw?.user_id) {
      notifyUser(photoRaw.user_id as string, {
        title: "Foto não aprovada",
        body: "Sua foto da fidelidade não foi aprovada. Envie outra com a moto bem visível.",
        icon: "X",
        url: "/kath-estetica/fidelidade",
      }).catch(() => {});
    }
  } else {
    await supabase
      .from("estetica_loyalty_photos")
      .update({ approved: true, approved_at: new Date().toISOString() })
      .eq("id", id);

    // Contar aprovações do mês pra decidir entre notif "foto X/3" ou "desbloqueado".
    if (photoRaw?.user_id && photoRaw?.month) {
      const { count } = await supabase
        .from("estetica_loyalty_photos")
        .select("*", { count: "exact", head: true })
        .eq("user_id", photoRaw.user_id as string)
        .eq("month", photoRaw.month as string)
        .eq("approved", true);

      const total = count ?? 0;

      if (total >= 3) {
        // Atingiu a marca (na 3ª foto aprovada, libera a 4ª lavagem grátis)
        notifyUser(photoRaw.user_id as string, {
          title: "🎉 4ª lavagem desbloqueada!",
          body: "Parabéns! Sua próxima lavagem deste mês é grátis.",
          icon: "Gift",
          url: "/kath-estetica/fidelidade",
        }).catch(() => {});
      } else {
        // Notif individual de progresso (1/3, 2/3)
        notifyUser(photoRaw.user_id as string, {
          title: "Foto aprovada!",
          body: `${total}/3 fotos aprovadas este mês. Faltam ${3 - total} para a próxima lavagem grátis.`,
          icon: "Check",
          url: "/kath-estetica/fidelidade",
        }).catch(() => {});
      }
    }
  }

  revalidatePath("/admin/kath-estetica/fidelidade");
}

// ══════════════════════════════════════════
// PORTFOLIO
// ══════════════════════════════════════════

export async function getPortfolio() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("estetica_portfolio")
    .select("*")
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createPortfolioItem(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("estetica_portfolio").insert({
    title: (formData.get("title") as string) || null,
    service_id: (formData.get("service_id") as string) || null,
    before_url: formData.get("before_url") as string,
    after_url: formData.get("after_url") as string,
    description: (formData.get("description") as string) || null,
    is_featured: formData.get("is_featured") === "on",
    sort_order: Number(formData.get("sort_order") || 0),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/kath-estetica/portfolio");
}

export async function deletePortfolioItem(id: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("estetica_portfolio")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/kath-estetica/portfolio");
}

// ══════════════════════════════════════════
// SCHEDULE / BLOCKED SLOTS
// ══════════════════════════════════════════

export async function getSchedule() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("estetica_schedule")
    .select("*")
    .order("day_of_week", { ascending: true });
  return data || [];
}

export async function updateScheduleDay(
  dayOfWeek: number,
  opensAt: string | null,
  closesAt: string | null,
  isClosed: boolean,
  slotMinutes: number,
) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("estetica_schedule")
    .update({
      opens_at: isClosed ? null : opensAt,
      closes_at: isClosed ? null : closesAt,
      is_closed: isClosed,
      slot_minutes: slotMinutes,
    })
    .eq("day_of_week", dayOfWeek);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/kath-estetica/horarios");
}

export async function blockSlot(startsAt: string, endsAt: string, reason: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("estetica_slots_blocked")
    .insert({ starts_at: startsAt, ends_at: endsAt, reason });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/kath-estetica/horarios");
}

export async function unblockSlot(id: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("estetica_slots_blocked")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/kath-estetica/horarios");
}

// ══════════════════════════════════════════
// WALK-IN (atendimento presencial de motos)
// ══════════════════════════════════════════
// As tabelas estetica_customers/vehicles/walkin_services foram introduzidas
// pela migration 19_estetica_walkin.sql. Como `database.types.ts` ainda não
// foi regerado, usamos casts pontuais para os tipos locais em walkin-types.

const MOTO_BUCKET = "moto-photos";
const PLATE_BUCKET = "plate-photos";

type WalkinResult = {
  ok: true;
  walkinId: string;
  vehicleId: string;
  customerId: string;
  isNewVehicle: boolean;
};

async function uploadWalkinPhoto(
  bucket: string,
  file: File,
  pathPrefix: string,
): Promise<string> {
  const supabase = createAdminSupabaseClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 10);
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
  const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(`Falha no upload (${bucket}): ${error.message}`);
  return path;
}

async function removeWalkinPhotos(items: Array<{ bucket: string; path: string }>): Promise<void> {
  const supabase = createAdminSupabaseClient();
  for (const { bucket, path } of items) {
    if (!path) continue;
    await supabase.storage.from(bucket).remove([path]).catch(() => {});
  }
}

/**
 * Carrega a matriz de preços (tipo de moto → preço) + regra de pagamento de um serviço.
 * Usado pelo client quando o admin troca o serviço selecionado no walk-in.
 */
export async function loadServicePricing(serviceId: string): Promise<ServicePricing> {
  await requireAdmin();
  return getServicePricing(serviceId);
}

export async function createWalkinService(formData: FormData): Promise<WalkinResult> {
  const adminId = await requireAdmin();
  const supabase = createAdminSupabaseClient();

  // ── 1. Normalizar placa antes da validação ──
  const rawPlate = formData.get("plate");
  const normalizedPlate = parsePlate(typeof rawPlate === "string" ? rawPlate : "");
  if (!normalizedPlate) {
    throw new Error("Placa inválida — use formato Mercosul (ABC1D23) ou antigo (ABC1234)");
  }

  // ── 2. Montar payload (excluindo arquivos) e validar com Zod ──
  const raw: Record<string, unknown> = { plate: normalizedPlate };
  formData.forEach((value, key) => {
    if (key === "plate") return;
    if (value instanceof File) return;
    raw[key] = value === "" ? null : value;
  });

  const data = walkinServiceSchema.parse(raw);

  // ── 3. Upload das fotos (se enviadas) ──
  const motoFile = formData.get("moto_photo");
  const plateFile = formData.get("plate_photo");
  const uploaded: Array<{ bucket: string; path: string }> = [];
  let motoPath: string | null = null;
  let platePath: string | null = null;

  try {
    if (motoFile instanceof File && motoFile.size > 0) {
      motoPath = await uploadWalkinPhoto(MOTO_BUCKET, motoFile, data.plate);
      uploaded.push({ bucket: MOTO_BUCKET, path: motoPath });
    }
    if (plateFile instanceof File && plateFile.size > 0) {
      platePath = await uploadWalkinPhoto(PLATE_BUCKET, plateFile, data.plate);
      uploaded.push({ bucket: PLATE_BUCKET, path: platePath });
    }

    // ── 4. Buscar veículo existente por placa (idempotência) ──
    const { data: existingVehicleRaw, error: vehicleLookupErr } = await supabase
      .from("estetica_vehicles" as never)
      .select("id, customer_id, brand, model, color, year")
      .eq("plate", data.plate)
      .maybeSingle();
    if (vehicleLookupErr) throw new Error(vehicleLookupErr.message);

    const existingVehicle = existingVehicleRaw as unknown as
      | Pick<EsteticaVehicleRow, "id" | "customer_id" | "brand" | "model" | "color" | "year">
      | null;

    let vehicleId: string;
    let customerId: string;
    const isNewVehicle = !existingVehicle;

    if (existingVehicle) {
      // ── 4a. Veículo existe: usa customer atrelado e só atualiza fotos novas ──
      vehicleId = existingVehicle.id;
      customerId = existingVehicle.customer_id;

      const vehicleUpdate: Record<string, unknown> = {};
      if (motoPath) vehicleUpdate.moto_photo_path = motoPath;
      if (platePath) vehicleUpdate.plate_photo_path = platePath;
      if (data.vehicle_brand && !existingVehicle.brand) vehicleUpdate.brand = data.vehicle_brand;
      if (data.vehicle_model && !existingVehicle.model) vehicleUpdate.model = data.vehicle_model;
      if (data.vehicle_color && !existingVehicle.color) vehicleUpdate.color = data.vehicle_color;
      if (data.vehicle_year && !existingVehicle.year) vehicleUpdate.year = data.vehicle_year;
      if (data.vehicle_type_id) vehicleUpdate.vehicle_type_id = data.vehicle_type_id;

      if (Object.keys(vehicleUpdate).length > 0) {
        const { error: updErr } = await supabase
          .from("estetica_vehicles" as never)
          .update(vehicleUpdate as never)
          .eq("id", vehicleId);
        if (updErr) throw new Error(updErr.message);
      }

      // Atualiza nome/telefone do cliente se vieram diferentes (sem sobrescrever vazios)
      const customerUpdate: Record<string, unknown> = {};
      if (data.customer_name) customerUpdate.full_name = data.customer_name;
      if (data.customer_phone) customerUpdate.phone = data.customer_phone;
      if (data.customer_cpf) customerUpdate.cpf = data.customer_cpf;
      if (data.customer_email) customerUpdate.email = data.customer_email;
      if (Object.keys(customerUpdate).length > 0) {
        const { error: custUpdErr } = await supabase
          .from("estetica_customers" as never)
          .update(customerUpdate as never)
          .eq("id", customerId);
        if (custUpdErr) throw new Error(custUpdErr.message);
      }
    } else {
      // ── 4b. Veículo novo: criar customer + vehicle ──
      const { data: newCustomerRaw, error: custErr } = await supabase
        .from("estetica_customers" as never)
        .insert({
          full_name: data.customer_name,
          phone: data.customer_phone,
          cpf: data.customer_cpf ?? null,
          email: data.customer_email ?? null,
          created_by: adminId,
        } as never)
        .select("id")
        .single();
      if (custErr || !newCustomerRaw) {
        throw new Error(custErr?.message || "Falha ao criar cliente");
      }
      customerId = (newCustomerRaw as unknown as Pick<EsteticaCustomerRow, "id">).id;

      const { data: newVehicleRaw, error: vehErr } = await supabase
        .from("estetica_vehicles" as never)
        .insert({
          customer_id: customerId,
          plate: data.plate,
          brand: data.vehicle_brand ?? null,
          model: data.vehicle_model ?? null,
          color: data.vehicle_color ?? null,
          year: data.vehicle_year ?? null,
          vehicle_type_id: data.vehicle_type_id ?? null,
          moto_photo_path: motoPath,
          plate_photo_path: platePath,
        } as never)
        .select("id")
        .single();
      if (vehErr || !newVehicleRaw) {
        throw new Error(vehErr?.message || "Falha ao criar veículo");
      }
      vehicleId = (newVehicleRaw as unknown as Pick<EsteticaVehicleRow, "id">).id;
    }

    // ── 5. Criar atendimento presencial ──
    const { data: walkinRaw, error: walkinErr } = await supabase
      .from("estetica_walkin_services" as never)
      .insert({
        vehicle_id: vehicleId,
        customer_id: customerId,
        service_id: data.service_id ?? null,
        vehicle_type_id: data.vehicle_type_id ?? null,
        admin_id: adminId,
        price_cents: data.price_cents,
        payment_method: data.payment_method,
        payment_status: data.payment_status,
        moto_photo_path: motoPath,
        plate_photo_path: platePath,
        notes: data.notes ?? null,
      } as never)
      .select("id")
      .single();
    if (walkinErr || !walkinRaw) {
      throw new Error(walkinErr?.message || "Falha ao registrar atendimento");
    }
    const walkinId = (walkinRaw as unknown as Pick<EsteticaWalkinServiceRow, "id">).id;

    revalidatePath("/admin/kath-estetica/atendimento");
    return { ok: true, walkinId, vehicleId, customerId, isNewVehicle };
  } catch (err) {
    // Cleanup das fotos para não acumular órfãos
    if (uploaded.length > 0) {
      await removeWalkinPhotos(uploaded);
    }
    throw err instanceof Error ? err : new Error("Falha no atendimento walk-in");
  }
}

/**
 * Lookup rápido de veículo por placa (autocompletar UI quando o admin
 * digita/cola a placa). Retorna null se não existir.
 */
export async function lookupVehicleByPlate(plateInput: string): Promise<{
  plate: string;
  vehicle: Pick<EsteticaVehicleRow, "id" | "brand" | "model" | "color" | "year">;
  customer: Pick<EsteticaCustomerRow, "id" | "full_name" | "phone" | "cpf" | "email">;
} | null> {
  await requireAdmin();
  const plate = parsePlate(plateInput);
  if (!plate) return null;

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("estetica_vehicles" as never)
    .select("id, brand, model, color, year, estetica_customers!inner(id, full_name, phone, cpf, email)")
    .eq("plate", plate)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const typed = data as unknown as {
    id: string;
    brand: string | null;
    model: string | null;
    color: string | null;
    year: number | null;
    estetica_customers: Pick<EsteticaCustomerRow, "id" | "full_name" | "phone" | "cpf" | "email">;
  };

  return {
    plate,
    vehicle: {
      id: typed.id,
      brand: typed.brand,
      model: typed.model,
      color: typed.color,
      year: typed.year,
    },
    customer: typed.estetica_customers,
  };
}

/**
 * Lista os atendimentos walk-in mais recentes para a página de operação.
 */
export async function listRecentWalkins(limit: number = 30): Promise<Array<{
  id: string;
  plate: string;
  customer_name: string;
  service_title: string | null;
  price_cents: number;
  payment_method: string;
  payment_status: string;
  status: string;
  created_at: string;
}>> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("estetica_walkin_services" as never)
    .select(
      "id, price_cents, payment_method, payment_status, status, created_at, estetica_vehicles!inner(plate), estetica_customers!inner(full_name), estetica_services(title)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  if (!data) return [];

  const rows = data as unknown as Array<{
    id: string;
    price_cents: number;
    payment_method: string;
    payment_status: string;
    status: string;
    created_at: string;
    estetica_vehicles: { plate: string };
    estetica_customers: { full_name: string };
    estetica_services: { title: string } | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    plate: r.estetica_vehicles.plate,
    customer_name: r.estetica_customers.full_name,
    service_title: r.estetica_services?.title ?? null,
    price_cents: r.price_cents,
    payment_method: r.payment_method,
    payment_status: r.payment_status,
    status: r.status,
    created_at: r.created_at,
  }));
}

// ══════════════════════════════════════════
// PRICING MATRIX (matriz + regras de pagamento)
// ══════════════════════════════════════════

const pricingSchema = z.object({
  service_id: z.string().uuid(),
  prices: z
    .array(
      z.object({
        vehicle_type_id: z.string().uuid(),
        price_cents: z.coerce.number().int().min(0).max(10_000_000),
      }),
    )
    .max(50),
  payment_rule: z
    .object({
      allow_onsite_cash: z.coerce.boolean().default(true),
      allow_onsite_pix: z.coerce.boolean().default(true),
      allow_onsite_card: z.coerce.boolean().default(true),
      allow_app_prepay: z.coerce.boolean().default(true),
      require_app_prepay: z.coerce.boolean().default(false),
      prepay_pct: z.coerce.number().int().min(0).max(100).default(0),
      notes: z.string().max(500).nullable().optional(),
    })
    .nullable(),
});

export type ServicePricingInput = z.infer<typeof pricingSchema>;

/**
 * Carrega tudo que a página /admin/kath-estetica/precos precisa:
 * serviços ativos, tipos de moto ativos e (por serviço) matriz + rule.
 */
export async function getPricingMatrixData(): Promise<{
  services: Array<{
    id: string;
    title: string;
    category: string;
    duration_min: number;
    slug: string | null;
    is_active: boolean;
    requires_booking: boolean;
  }>;
  vehicleTypes: EsteticaVehicleType[];
  pricingByService: Record<string, ServicePricing>;
}> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  // SELECT *: traz requires_booking se a migration 22 já rodou; default true.
  const { data: servicesRaw, error: servicesErr } = await supabase
    .from("estetica_services")
    .select("*")
    .order("sort_order", { ascending: true });
  if (servicesErr) throw new Error(servicesErr.message);

  const services = ((servicesRaw ?? []) as unknown as Array<{
    id: string;
    title: string;
    category: string;
    duration_min: number;
    slug: string | null;
    is_active: boolean;
    requires_booking?: boolean | null;
  }>).map((s) => ({
    id: s.id,
    title: s.title,
    category: s.category,
    duration_min: s.duration_min,
    slug: s.slug,
    is_active: s.is_active,
    // Default true: serviços sem a coluna (migration 22 não rodou) aceitam agendamento.
    requires_booking: s.requires_booking !== false,
  }));

  const vehicleTypes = await listVehicleTypes();

  // Carrega pricing em paralelo. Lista pequena (<10 serviços), N+1 aceitável.
  const pairs = await Promise.all(
    services.map(async (s) => [s.id, await getServicePricing(s.id)] as const),
  );
  const pricingByService: Record<string, ServicePricing> = {};
  for (const [id, pricing] of pairs) pricingByService[id] = pricing;

  return { services, vehicleTypes, pricingByService };
}

/**
 * Persiste a matriz de preços de UM serviço + sua regra de pagamento.
 * Estratégia transacional simples (sem RPC): aplica em ordem upsert prices
 * → delete missing → upsert rule. Se falha no meio, o caller chama de novo.
 */
export async function saveServicePricing(input: ServicePricingInput) {
  await requireAdmin();
  const data = pricingSchema.parse(input);
  const supabase = createAdminSupabaseClient();

  // 1. Upsert dos preços enviados (cada linha service × vehicle_type)
  if (data.prices.length > 0) {
    const rows = data.prices.map((p) => ({
      service_id: data.service_id,
      vehicle_type_id: p.vehicle_type_id,
      price_cents: p.price_cents,
      is_active: true,
    }));
    const { error: upErr } = await supabase
      .from("estetica_service_prices" as never)
      .upsert(rows as never, { onConflict: "service_id,vehicle_type_id" });
    if (upErr) throw new Error(`prices upsert: ${upErr.message}`);
  }

  // 2. Apaga prices de tipos que NÃO foram enviados (admin removeu da matriz)
  const keepIds = data.prices.map((p) => p.vehicle_type_id);
  const delQuery = supabase
    .from("estetica_service_prices" as never)
    .delete()
    .eq("service_id" as never, data.service_id);
  const { error: delErr } =
    keepIds.length > 0
      ? await delQuery.not("vehicle_type_id", "in", `(${keepIds.join(",")})`)
      : await delQuery;
  if (delErr) throw new Error(`prices delete: ${delErr.message}`);

  // 3. Upsert da regra de pagamento (nullable — se null, remove)
  if (data.payment_rule) {
    const { error: ruleErr } = await supabase
      .from("estetica_payment_rules" as never)
      .upsert(
        {
          service_id: data.service_id,
          ...data.payment_rule,
        } as never,
        { onConflict: "service_id" },
      );
    if (ruleErr) throw new Error(`rule upsert: ${ruleErr.message}`);
  } else {
    const { error: ruleDelErr } = await supabase
      .from("estetica_payment_rules" as never)
      .delete()
      .eq("service_id" as never, data.service_id);
    if (ruleDelErr) throw new Error(`rule delete: ${ruleDelErr.message}`);
  }

  revalidatePath("/admin/kath-estetica/precos");
  return { ok: true };
}

// ══════════════════════════════════════════
// ADMIN CRIA BOOKING (cliente sem conta no app)
// ══════════════════════════════════════════

/**
 * Cria um booking pelo admin para um cliente que não tem conta Clerk.
 * Casos: cliente ligou, pediu pelo WhatsApp, ou apareceu na loja sem o app.
 *
 * Diferenças de POST /api/estetica/bookings (cliente):
 *  - user_id = null (não tem profile)
 *  - created_by_admin = adminId (audit)
 *  - status = "confirmed" (admin já validou que vai atender)
 *  - prepay_cents = 0; remaining_cents = total_cents (pagamento presencial,
 *    admin quita depois via markBookingRemainderPaid)
 *  - Sem cashback / loyalty / desconto de plano (cliente não tem plan_tier)
 *  - Preço SEMPRE da matriz por tipo de moto
 *
 * Idempotência: não há key explícita. Admin que clicar 2× cria 2 bookings —
 * comportamento consciente (admin sabe; idempotency-key viria do form).
 */
export async function createBookingAsAdmin(
  formData: FormData,
): Promise<{ ok: true; bookingId: string }> {
  const adminId = await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const raw: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    if (value instanceof File) return;
    raw[key] = value === "" ? null : value;
  });
  const data = adminBookingSchema.parse(raw);

  // Serviço precisa existir, estar ativo e aceitar agendamento.
  // SELECT *: tolera ausência de `requires_booking` (migration 22) em dev
  // que ainda não rodou — usa "true" como default seguro.
  const { data: serviceRaw, error: svcErr } = await supabase
    .from("estetica_services")
    .select("*")
    .eq("id", data.service_id)
    .maybeSingle();
  if (svcErr) {
    throw new Error(`Falha ao buscar serviço: ${svcErr.message}`);
  }
  if (!serviceRaw) {
    throw new Error(`Serviço ${data.service_id} não encontrado`);
  }
  const service = serviceRaw as unknown as {
    id: string;
    title: string;
    duration_min: number;
    price_cents: number;
    requires_booking?: boolean | null;
    is_active: boolean;
  };
  if (!service.is_active) throw new Error("Serviço inativo");
  if (service.requires_booking === false) {
    throw new Error("Este serviço é walk-in only. Use a página de Atendimento.");
  }

  // Resolver preço da matriz (obrigatório — não fazemos fallback para
  // price_cents do service porque admin precisa cadastrar o tipo na matriz)
  const pricing = await getServicePricing(service.id);
  const option = pricing.options.find((o) => o.vehicle_type.id === data.vehicle_type_id);
  if (!option) {
    throw new Error(
      "Este tipo de moto não tem preço cadastrado para o serviço. Configure em Preços.",
    );
  }
  const priceCents = option.price_cents;

  // Cast `as never` necessário até que `database.types.ts` seja regerado:
  // user_id virou nullable e created_by_admin foi adicionado na migration 24.
  const { data: bookingRaw, error: insErr } = await supabase
    .from("estetica_bookings")
    .insert({
      user_id: null,
      service_id: service.id,
      vehicle_type_id: data.vehicle_type_id,
      scheduled_at: data.scheduled_at,
      duration_min: service.duration_min,
      vehicle_brand: data.vehicle_brand,
      vehicle_model: data.vehicle_model,
      vehicle_plate: data.vehicle_plate,
      vehicle_color: data.vehicle_color ?? null,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      status: "confirmed",
      price_cents: priceCents,
      plan_discount_cents: 0,
      loyalty_free: false,
      cashback_used_cents: 0,
      total_cents: priceCents,
      prepay_cents: 0,
      remaining_cents: priceCents,
      paid_at: null,
      notes: data.notes ?? null,
      created_by_admin: adminId,
    } as never)
    .select("id")
    .single();
  if (insErr || !bookingRaw) {
    // Detalhes para diagnosticar: se mencionar "user_id" ou "created_by_admin",
    // a migration 24 não foi rodada ainda.
    console.error("[createBookingAsAdmin] insert failed", insErr);
    throw new Error(
      insErr?.message
        ? `Falha ao criar agendamento: ${insErr.message}`
        : "Falha ao criar agendamento",
    );
  }

  revalidatePath("/admin/kath-estetica/agendamentos");
  return { ok: true, bookingId: (bookingRaw as { id: string }).id };
}
