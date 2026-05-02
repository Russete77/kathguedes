"use server";

import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { notifyUser } from "@/lib/notifications";

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

  const { error } = await supabase.from("estetica_services").insert({
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || null,
    image_url: (formData.get("image_url") as string) || null,
    category: formData.get("category") as string,
    duration_min: Number(formData.get("duration_min")),
    price_cents: Math.round(Number(formData.get("price_reais")) * 100),
    compare_price:
      formData.get("compare_price_reais")
        ? Math.round(Number(formData.get("compare_price_reais")) * 100)
        : null,
    discount_start: Number(formData.get("discount_start") || 0),
    discount_pro: Number(formData.get("discount_pro") || 0),
    discount_vip: Number(formData.get("discount_vip") || 0),
    includes,
    eligible_for_loyalty: formData.get("eligible_for_loyalty") === "on",
    is_active: formData.get("is_active") === "on",
    sort_order: Number(formData.get("sort_order") || 0),
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

  const { error } = await supabase
    .from("estetica_services")
    .update({
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || null,
      image_url: (formData.get("image_url") as string) || null,
      category: formData.get("category") as string,
      duration_min: Number(formData.get("duration_min")),
      price_cents: Math.round(Number(formData.get("price_reais")) * 100),
      compare_price:
        formData.get("compare_price_reais")
          ? Math.round(Number(formData.get("compare_price_reais")) * 100)
          : null,
      discount_start: Number(formData.get("discount_start") || 0),
      discount_pro: Number(formData.get("discount_pro") || 0),
      discount_vip: Number(formData.get("discount_vip") || 0),
      includes,
      eligible_for_loyalty: formData.get("eligible_for_loyalty") === "on",
      is_active: formData.get("is_active") === "on",
      sort_order: Number(formData.get("sort_order") || 0),
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
    .select("user_id, estetica_services(title)")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("estetica_bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);

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
