"use server";

import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { notifyUser } from "@/lib/notifications";
import { createEsteticaServiceSchema } from "@/lib/validations";
import type { PlanTier } from "@/lib/supabase/types";
import { getCashbackPct } from "@/lib/billing/plans";
import { creditWalletCents } from "@/lib/billing/wallet";

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
    .select("*, estetica_services(title)")
    .order("scheduled_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data || [];
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
    // Apagar foto + bucket
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
  } else {
    await supabase
      .from("estetica_loyalty_photos")
      .update({ approved: true, approved_at: new Date().toISOString() })
      .eq("id", id);

    // Verificar se atingiu 4 → notificar
    if (photoRaw?.user_id && photoRaw?.month) {
      const { count } = await supabase
        .from("estetica_loyalty_photos")
        .select("*", { count: "exact", head: true })
        .eq("user_id", photoRaw.user_id as string)
        .eq("month", photoRaw.month as string)
        .eq("approved", true);

      if ((count ?? 0) === 4) {
        notifyUser(photoRaw.user_id as string, {
          title: "🎉 5ª lavagem desbloqueada!",
          body: "Parabéns! Sua próxima lavagem deste mês é grátis.",
          icon: "Gift",
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
