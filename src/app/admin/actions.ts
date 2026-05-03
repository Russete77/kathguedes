"use server";

import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { notifyUser, notifyByPlan } from "@/lib/notifications";
import { extractYoutubeId } from "@/lib/youtube/embed";
import {
  createWorkoutSchema,
  createCouponSchema,
  createAffiliateSchema,
  createProductSchema,
  updateConsultationSchema,
  parseFormData,
} from "@/lib/validations";
import { creditWalletCents } from "@/lib/billing/wallet";
import { getCashbackPct } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/supabase/types";

// ── Auth helper ──

async function requireAdmin() {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Não autenticado");
  // Verificar admin via publicMetadata nos sessionClaims
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") throw new Error("Acesso negado: apenas admin");
  return userId;
}

// ══════════════════════════════════════════
// TREINOS
// ══════════════════════════════════════════

export async function getWorkouts() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("workout_videos")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function createWorkout(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const data = parseFormData(createWorkoutSchema, formData);

  const { error } = await supabase.from("workout_videos").insert({
    title: data.title,
    description: data.description || null,
    youtube_id: extractYoutubeId(data.youtube_id),
    category: data.category,
    level: data.level,
    duration_minutes: data.duration_minutes,
    required_plan: data.required_plan,
    is_published: data.is_published,
    published_at: data.is_published ? new Date().toISOString() : null,
    is_short: data.is_short || false,
    notes: data.notes || null,
  });

  if (error) throw new Error(error.message);

  if (data.is_published) {
    notifyByPlan(data.required_plan as PlanTier, {
      title: "Novo treino disponível!",
      body: `Kath publicou: ${data.title}`,
      icon: "PlayCircle",
      url: "/fitness",
    }).catch(() => {});
  }

  revalidatePath("/admin/treinos");
}

export async function updateWorkout(id: string, formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase
    .from("workout_videos")
    .update({
      title: formData.get("title") as string,
      youtube_id: extractYoutubeId(formData.get("youtube_id") as string),
      category: formData.get("category") as string,
      level: formData.get("level") as string,
      duration_minutes: Number(formData.get("duration_minutes")),
      required_plan: formData.get("required_plan") as string,
      description: (formData.get("description") as string) || null,
      is_short: formData.get("is_short") === "true",
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/treinos");
}

export async function toggleWorkoutPublished(id: string, published: boolean) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase
    .from("workout_videos")
    .update({
      is_published: published,
      published_at: published ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/treinos");
}

export async function deleteWorkout(id: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase.from("workout_videos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/treinos");
}

// ══════════════════════════════════════════
// CUPONS
// ══════════════════════════════════════════

export async function getCoupons() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .order("valid_until", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function createCoupon(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const data = parseFormData(createCouponSchema, formData);

  const { error } = await supabase.from("coupons").insert({
    title: data.title,
    code: data.code,
    discount_pct: data.discount_pct || null,
    partner_name: data.partner_name,
    partner_url: data.partner_url,
    module: data.module,
    required_plan: data.required_plan,
    max_uses: data.max_uses || null,
    valid_until: data.valid_until,
    is_flash: data.is_flash,
    is_active: true,
  });

  if (error) throw new Error(error.message);

  notifyByPlan(data.required_plan as "free" | "start" | "pro" | "vip", {
    title: "Novo cupom disponível!",
    body: `${data.code} — ${data.discount_pct || 0}% OFF · Só para assinantes`,
    icon: "Tag",
    url: "/cupons",
  }).catch(() => {});

  revalidatePath("/admin/cupons");
}

export async function updateCoupon(id: string, formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const data = parseFormData(createCouponSchema, formData);

  const { error } = await supabase
    .from("coupons")
    .update({
      title: data.title,
      code: data.code,
      discount_pct: data.discount_pct || null,
      partner_name: data.partner_name,
      partner_url: data.partner_url,
      module: data.module,
      required_plan: data.required_plan,
      max_uses: data.max_uses || null,
      valid_until: data.valid_until,
      is_flash: data.is_flash,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/cupons");
}

export async function deleteCoupon(id: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase
    .from("coupons")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/cupons");
}

export async function toggleCouponActive(id: string, active: boolean) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase
    .from("coupons")
    .update({ is_active: active })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/cupons");
}

// ══════════════════════════════════════════
// AFILIADOS
// ══════════════════════════════════════════

export async function getAffiliateLinks() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("affiliate_links")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function createAffiliateLink(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const data = parseFormData(createAffiliateSchema, formData);

  const { error } = await supabase.from("affiliate_links").insert({
    title: data.title,
    description: data.description || null,
    image_url: data.image_url,
    module: data.module,
    category: data.category,
    platform: data.platform,
    affiliate_url: data.affiliate_url,
    required_plan: data.required_plan,
    is_active: true,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/afiliados");
}

export async function updateAffiliateLink(id: string, formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const data = parseFormData(createAffiliateSchema, formData);

  const { error } = await supabase
    .from("affiliate_links")
    .update({
      title: data.title,
      description: data.description || null,
      image_url: data.image_url,
      module: data.module,
      category: data.category,
      platform: data.platform,
      affiliate_url: data.affiliate_url,
      required_plan: data.required_plan,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/afiliados");
}

export async function deleteAffiliateLink(id: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase
    .from("affiliate_links")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/afiliados");
}

export async function toggleAffiliateActive(id: string, active: boolean) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase
    .from("affiliate_links")
    .update({ is_active: active })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/afiliados");
}

// ══════════════════════════════════════════
// DASHBOARD METRICS
// ══════════════════════════════════════════

export async function getDashboardMetrics() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    // Subscribers
    totalProfiles, freeCount, startCount, proCount, vipCount,
    // Subscription status
    activeSubCount, pastDueCount, canceledCount,
    // Growth: signups this week vs last week
    signupsThisWeek, signupsLastWeek,
    // Revenue: orders
    revenueTotal, revenueThisMonth, ordersPending, ordersPaid, ordersShipped, ordersDelivered, ordersCanceled,
    // Consultations
    consultPending, consultInProgress, consultDelivered,
    // Chat VIP
    unreadMessages,
    // Content
    totalWorkouts, totalWorkoutsPublished,
    totalCouponsActive, totalCouponsExpired,
    // Rankings
    topWorkouts, topCoupons, topAffiliates,
    // Stock alerts
    lowStockProducts,
    // Recent signups (for list)
    recentSignups,
  ] = await Promise.all([
    // ── Subscribers ──
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("plan_tier", "free"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("plan_tier", "start"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("plan_tier", "pro"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("plan_tier", "vip"),
    // ── Subscription status ──
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("subscription_status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("subscription_status", "past_due"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("subscription_status", "canceled"),
    // ── Growth ──
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", twoWeeksAgo).lt("created_at", weekAgo),
    // ── Revenue ──
    supabase.from("orders").select("total_cents").in("status", ["paid", "shipped", "delivered"]),
    supabase.from("orders").select("total_cents").in("status", ["paid", "shipped", "delivered"]).gte("created_at", monthAgo),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "shipped"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "delivered"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "canceled"),
    // ── Consultations ──
    supabase.from("consultations").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("consultations").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
    supabase.from("consultations").select("id", { count: "exact", head: true }).eq("status", "delivered"),
    // ── Chat VIP ──
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("is_from_kath", false).eq("is_read", false),
    // ── Content counts ──
    supabase.from("workout_videos").select("id", { count: "exact", head: true }),
    supabase.from("workout_videos").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("coupons").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("coupons").select("id", { count: "exact", head: true }).lt("valid_until", now.toISOString()).eq("is_active", true),
    // ── Rankings ──
    supabase.from("workout_videos").select("id, title, views_count").eq("is_published", true).order("views_count", { ascending: false }).limit(5),
    supabase.from("coupons").select("id, code, uses_count").eq("is_active", true).order("uses_count", { ascending: false }).limit(5),
    supabase.from("affiliate_links").select("id, title, clicks_count").eq("is_active", true).order("clicks_count", { ascending: false }).limit(5),
    // ── Stock alerts ──
    supabase.from("products").select("id, title, stock").eq("is_active", true).lte("stock", 5).order("stock", { ascending: true }).limit(5),
    // ── Recent signups ──
    supabase.from("profiles").select("id, full_name, plan_tier, created_at").order("created_at", { ascending: false }).limit(5),
  ]);

  // Calculate revenue sums
  const revenueTotalCents = (revenueTotal.data || []).reduce((sum, o) => sum + (o.total_cents || 0), 0);
  const revenueMonthCents = (revenueThisMonth.data || []).reduce((sum, o) => sum + (o.total_cents || 0), 0);

  const signupsThisWeekCount = signupsThisWeek.count || 0;
  const signupsLastWeekCount = signupsLastWeek.count || 0;
  const growthPct = signupsLastWeekCount > 0
    ? Math.round(((signupsThisWeekCount - signupsLastWeekCount) / signupsLastWeekCount) * 100)
    : signupsThisWeekCount > 0 ? 100 : 0;

  return {
    // Subscribers
    totalSubscribers: totalProfiles.count || 0,
    planCounts: {
      free: freeCount.count || 0,
      start: startCount.count || 0,
      pro: proCount.count || 0,
      vip: vipCount.count || 0,
    },
    subscriptionStatus: {
      active: activeSubCount.count || 0,
      pastDue: pastDueCount.count || 0,
      canceled: canceledCount.count || 0,
    },
    // Growth
    signupsThisWeek: signupsThisWeekCount,
    signupsLastWeek: signupsLastWeekCount,
    growthPct,
    // Revenue
    revenueTotalCents,
    revenueMonthCents,
    orders: {
      pending: ordersPending.count || 0,
      paid: ordersPaid.count || 0,
      shipped: ordersShipped.count || 0,
      delivered: ordersDelivered.count || 0,
      canceled: ordersCanceled.count || 0,
    },
    // Consultations
    consultations: {
      pending: consultPending.count || 0,
      inProgress: consultInProgress.count || 0,
      delivered: consultDelivered.count || 0,
    },
    // Chat
    unreadMessages: unreadMessages.count || 0,
    // Content
    totalWorkouts: totalWorkouts.count || 0,
    publishedWorkouts: totalWorkoutsPublished.count || 0,
    activeCoupons: totalCouponsActive.count || 0,
    expiredCoupons: totalCouponsExpired.count || 0,
    // Rankings
    topWorkouts: topWorkouts.data || [],
    topCoupons: topCoupons.data || [],
    topAffiliates: topAffiliates.data || [],
    // Alerts
    lowStockProducts: (lowStockProducts.data || []) as { id: string; title: string; stock: number }[],
    // Recent
    recentSignups: (recentSignups.data || []) as { id: string; full_name: string; plan_tier: string; created_at: string }[],
  };
}

// ══════════════════════════════════════════
// CONSULTORIAS
// ══════════════════════════════════════════

export async function getConsultations(status?: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  let query = supabase
    .from("consultations")
    .select("*, profiles!inner(full_name)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function updateConsultationPlan(
  id: string,
  payload: unknown
) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const data = updateConsultationSchema.parse(payload);

  const { error } = await supabase
    .from("consultations")
    .update(data as unknown as any)
    .eq("id", id);

  if (error) throw new Error(error.message);

  // Notificar assinante quando consultoria é entregue
  if (data.status === "delivered") {
    const { data: consultation } = await supabase
      .from("consultations")
      .select("user_id")
      .eq("id", id)
      .single();

    if (consultation?.user_id) {
      notifyUser(consultation.user_id, {
        title: "Seu plano está pronto!",
        body: "A Kath montou seu plano de treino e dieta personalizado. Confira agora!",
        icon: "Settings2",
        url: "/consultoria",
      }).catch(() => {});
    }
  }

  revalidatePath("/admin/consultorias");
}

export async function updateConsultationStatus(id: string, status: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase
    .from("consultations")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/consultorias");
}

export async function getProfilesList() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, plan_tier")
    .order("full_name", { ascending: true });
  return data || [];
}

export async function createConsultation(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const userId = formData.get("user_id") as string;
  const packageType = formData.get("package_type") as string;
  const daysValid = Number(formData.get("days_valid")) || 30;

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + daysValid);

  const { error } = await supabase.from("consultations").insert({
    user_id: userId,
    package_type: packageType,
    status: "pending",
    valid_until: validUntil.toISOString(),
  });

  if (error) throw new Error(error.message);

  // Notificar assinante
  notifyUser(userId, {
    title: "Consultoria adquirida!",
    body: "Preencha sua anamnese para a Kath montar seu plano personalizado.",
    icon: "Settings2",
    url: "/consultoria/anamnese",
  }).catch(() => {});

  revalidatePath("/admin/consultorias");
}

// ══════════════════════════════════════════
// LOJA — PRODUTOS
// ══════════════════════════════════════════

export async function getProducts() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const data = parseFormData(createProductSchema, formData);

  const { error } = await supabase.from("products").insert({
    title: data.title,
    description: data.description || null,
    image_url: data.image_url,
    price_cents: Math.round(data.price * 100),
    compare_price: data.compare_price ? Math.round(data.compare_price * 100) : null,
    category: data.category,
    module: data.module,
    stock: data.stock,
    weight_kg: data.weight_kg,
    height_cm: data.height_cm,
    width_cm: data.width_cm,
    length_cm: data.length_cm,
    discount_start: data.discount_start,
    discount_pro: data.discount_pro,
    discount_vip: data.discount_vip,
    is_active: true,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/loja");
}

export async function updateProduct(id: string, formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const data = parseFormData(createProductSchema, formData);

  const { error } = await supabase
    .from("products")
    .update({
      title: data.title,
      description: data.description || null,
      image_url: data.image_url,
      price_cents: Math.round(data.price * 100),
      compare_price: data.compare_price ? Math.round(data.compare_price * 100) : null,
      category: data.category,
      module: data.module,
      stock: data.stock,
      weight_kg: data.weight_kg,
      height_cm: data.height_cm,
      width_cm: data.width_cm,
      length_cm: data.length_cm,
      discount_start: data.discount_start,
      discount_pro: data.discount_pro,
      discount_vip: data.discount_vip,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/loja");
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/loja");
}

export async function toggleProductActive(id: string, active: boolean) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active: active })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/loja");
}

// ══════════════════════════════════════════
// LOJA — PEDIDOS
// ══════════════════════════════════════════

export async function getOrders() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function updateOrderStatus(id: string, status: string, trackingCode?: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (trackingCode) update.tracking_code = trackingCode;

  const { error } = await supabase.from("orders").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  // Buscar order completa pra usar em cashback + notify
  const { data: order } = await supabase
    .from("orders")
    .select("user_id, total_cents, profiles(plan_tier)")
    .eq("id", id)
    .single();

  // Cashback: na transição para 'delivered', creditar % do total pago em cash
  if (status === "delivered" && order?.user_id) {
    try {
      const planTier = ((order as unknown as { profiles: { plan_tier: PlanTier } | null })
        .profiles?.plan_tier) ?? "free";
      const cashbackPct = await getCashbackPct(planTier);
      const earned = Math.floor((order.total_cents ?? 0) * cashbackPct / 100);
      if (earned > 0) {
        const { data: rs } = await supabase
          .from("revenue_streams")
          .select("id")
          .eq("type", "loja")
          .eq("reference_id", id)
          .eq("status", "confirmed")
          .maybeSingle();
        if (rs?.id) {
          await creditWalletCents({
            userId: order.user_id,
            amountCents: earned,
            sourceStreamId: rs.id,
          });
        }
      }
    } catch (e) {
      console.error("[updateOrderStatus] cashback credit failed", e);
    }
  }

  if (order?.user_id) {
    const messages: Record<string, { title: string; body: string }> = {
      shipped: {
        title: "Pedido enviado!",
        body: trackingCode
          ? `Seu pedido está a caminho. Rastreio: ${trackingCode}`
          : "Seu pedido está a caminho!",
      },
      delivered: {
        title: "Pedido entregue!",
        body: "Seu pedido foi entregue. Aproveite!",
      },
      canceled: {
        title: "Pedido cancelado",
        body: "Seu pedido foi cancelado. Entre em contato se precisar.",
      },
    };

    const msg = messages[status];
    if (msg) {
      notifyUser(order.user_id, {
        ...msg,
        icon: "Package",
        url: "/perfil",
      }).catch(() => {});
    }
  }

  revalidatePath("/admin/loja");
}

// ══════════════════════════════════════════
// TEMPLATES DE TREINO / DIETA
// ══════════════════════════════════════════

export async function getTemplates(type?: "workout" | "diet") {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("plan_templates")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (type) query = query.eq("type", type);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function createTemplate(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const description = formData.get("description") as string || null;
  const data = JSON.parse(formData.get("data") as string);

  if (!name || !type || !data) throw new Error("Dados obrigatórios faltando");

  const { error } = await supabase.from("plan_templates").insert({
    name, type, description, data,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/templates");
}

export async function updateTemplate(id: string, formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const name = formData.get("name") as string;
  const description = formData.get("description") as string || null;
  const data = JSON.parse(formData.get("data") as string);

  const { error } = await supabase
    .from("plan_templates")
    .update({ name, description, data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/templates");
}

export async function deleteTemplate(id: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("plan_templates")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/templates");
}

export async function seedDefaultTemplates() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  // Check if templates already exist
  const { count } = await supabase
    .from("plan_templates")
    .select("*", { count: "exact", head: true });
  if (count && count > 0) return { seeded: 0 };

  const defaults = [
    {
      name: "Glúteo + Pernas (4 dias)",
      type: "workout",
      description: "Treino focado em glúteo e pernas, 4x por semana",
      data: {
        weeks: [{
          days: [
            { name: "Glúteo A", exercises: [
              { name: "Agachamento Búlgaro", sets: 4, reps: "8-10", rest: "120s" },
              { name: "Leg Press", sets: 4, reps: "10-12", rest: "90s" },
              { name: "Cadeira Extensora", sets: 3, reps: "12-15", rest: "60s" },
              { name: "Extensão de Glúteo", sets: 4, reps: "12", rest: "60s" },
            ]},
            { name: "Costas + Posterior", exercises: [
              { name: "Puxada na Máquina", sets: 4, reps: "8-10", rest: "120s" },
              { name: "Rosca Direta", sets: 3, reps: "10-12", rest: "90s" },
              { name: "Leg Curl", sets: 4, reps: "10-12", rest: "90s" },
              { name: "Flexão de Isquiotibiais", sets: 3, reps: "12", rest: "60s" },
            ]},
            { name: "Glúteo B", exercises: [
              { name: "Hip Thrust", sets: 4, reps: "12-15", rest: "90s" },
              { name: "Hack Machine", sets: 4, reps: "10-12", rest: "90s" },
              { name: "Stiff Leg Deadlift", sets: 3, reps: "10-12", rest: "90s" },
              { name: "Abdução na Máquina", sets: 3, reps: "15", rest: "60s" },
            ]},
            { name: "Pernas Isoladas", exercises: [
              { name: "Leg Press Oblíquo", sets: 3, reps: "10-12", rest: "90s" },
              { name: "Cadeira Adutora", sets: 3, reps: "15", rest: "60s" },
              { name: "Cadeira Abdutora", sets: 3, reps: "15", rest: "60s" },
              { name: "Panturrilha na Máquina", sets: 4, reps: "15-20", rest: "60s" },
            ]},
          ],
        }],
      },
    },
    {
      name: "Upper/Lower Split (4 dias)",
      type: "workout",
      description: "Divisão Upper/Lower clássica, 4x por semana",
      data: {
        weeks: [{
          days: [
            { name: "Upper A", exercises: [
              { name: "Supino Inclinado", sets: 4, reps: "8-10", rest: "120s" },
              { name: "Puxada Supinada", sets: 4, reps: "8-10", rest: "120s" },
              { name: "Desenvolvimento Ombro", sets: 3, reps: "10-12", rest: "90s" },
              { name: "Rosca Inversa", sets: 3, reps: "12", rest: "60s" },
            ]},
            { name: "Lower A", exercises: [
              { name: "Agachamento Livre", sets: 4, reps: "8-10", rest: "120s" },
              { name: "Leg Press", sets: 4, reps: "10-12", rest: "90s" },
              { name: "Cadeira Extensora", sets: 3, reps: "12-15", rest: "60s" },
              { name: "Leg Curl Sentado", sets: 3, reps: "12", rest: "60s" },
            ]},
            { name: "Upper B", exercises: [
              { name: "Supino Reto", sets: 4, reps: "8-10", rest: "120s" },
              { name: "Barra Fixa", sets: 3, reps: "6-10", rest: "120s" },
              { name: "Voador Peitoral", sets: 3, reps: "12", rest: "90s" },
              { name: "Rosca Direta", sets: 3, reps: "10-12", rest: "60s" },
            ]},
            { name: "Lower B", exercises: [
              { name: "Leg Press", sets: 4, reps: "10-12", rest: "90s" },
              { name: "Agachamento Búlgaro", sets: 3, reps: "10-12", rest: "90s" },
              { name: "Stiff Deadlift", sets: 3, reps: "10-12", rest: "90s" },
              { name: "Panturrilha Máquina", sets: 3, reps: "15-20", rest: "60s" },
            ]},
          ],
        }],
      },
    },
    {
      name: "Full Body (3 dias)",
      type: "workout",
      description: "Treino Full Body para 3x por semana",
      data: {
        weeks: [{
          days: [
            { name: "Full Body A", exercises: [
              { name: "Agachamento", sets: 4, reps: "8-10", rest: "120s" },
              { name: "Supino", sets: 4, reps: "8-10", rest: "120s" },
              { name: "Rosca Direta", sets: 3, reps: "10-12", rest: "90s" },
              { name: "Leg Curl", sets: 3, reps: "12", rest: "60s" },
            ]},
            { name: "Full Body B", exercises: [
              { name: "Leg Press", sets: 4, reps: "10-12", rest: "90s" },
              { name: "Puxada Supinada", sets: 4, reps: "8-10", rest: "120s" },
              { name: "Desenvolvimento", sets: 3, reps: "10-12", rest: "90s" },
              { name: "Panturrilha", sets: 3, reps: "15-20", rest: "60s" },
            ]},
            { name: "Full Body C", exercises: [
              { name: "Hack Machine", sets: 4, reps: "10-12", rest: "90s" },
              { name: "Barra Fixa", sets: 3, reps: "6-10", rest: "120s" },
              { name: "Voador", sets: 3, reps: "12", rest: "90s" },
              { name: "Rosca Inversa", sets: 3, reps: "12", rest: "60s" },
            ]},
          ],
        }],
      },
    },
    {
      name: "Push/Pull/Legs (6 dias)",
      type: "workout",
      description: "PPL clássico 6x por semana",
      data: {
        weeks: [{
          days: [
            { name: "Push A", exercises: [
              { name: "Supino Inclinado", sets: 4, reps: "8-10", rest: "120s" },
              { name: "Desenvolvimento Ombro", sets: 3, reps: "10-12", rest: "90s" },
              { name: "Crucifixo", sets: 3, reps: "12", rest: "90s" },
              { name: "Rosca Triceps", sets: 3, reps: "12-15", rest: "60s" },
            ]},
            { name: "Pull A", exercises: [
              { name: "Barra Fixa", sets: 4, reps: "6-10", rest: "120s" },
              { name: "Rosca Direta", sets: 3, reps: "10-12", rest: "90s" },
              { name: "Puxada Inversa", sets: 3, reps: "12", rest: "90s" },
              { name: "Encolhimento", sets: 3, reps: "12-15", rest: "60s" },
            ]},
            { name: "Legs A", exercises: [
              { name: "Agachamento", sets: 4, reps: "8-10", rest: "120s" },
              { name: "Leg Press", sets: 4, reps: "10-12", rest: "90s" },
              { name: "Leg Curl", sets: 3, reps: "12", rest: "90s" },
              { name: "Panturrilha", sets: 3, reps: "15-20", rest: "60s" },
            ]},
            { name: "Push B", exercises: [
              { name: "Supino Reto", sets: 4, reps: "8-10", rest: "120s" },
              { name: "Paralela", sets: 3, reps: "10-12", rest: "90s" },
              { name: "Elevação Lateral", sets: 3, reps: "12-15", rest: "90s" },
              { name: "Rosca Francesa", sets: 3, reps: "12-15", rest: "60s" },
            ]},
            { name: "Pull B", exercises: [
              { name: "Puxada na Máquina", sets: 4, reps: "8-10", rest: "120s" },
              { name: "Rosca Scott", sets: 3, reps: "10-12", rest: "90s" },
              { name: "Remada", sets: 3, reps: "10-12", rest: "90s" },
              { name: "Voador Posterior", sets: 3, reps: "12-15", rest: "60s" },
            ]},
            { name: "Legs B", exercises: [
              { name: "Hack Machine", sets: 4, reps: "10-12", rest: "90s" },
              { name: "Leg Curl Deitado", sets: 4, reps: "10-12", rest: "90s" },
              { name: "Cadeira Extensora", sets: 3, reps: "12-15", rest: "60s" },
              { name: "Cadeira Abdutora", sets: 3, reps: "15", rest: "60s" },
            ]},
          ],
        }],
      },
    },
    {
      name: "HIIT + Funcional (3 dias)",
      type: "workout",
      description: "Treino HIIT e funcional para 3x por semana",
      data: {
        weeks: [{
          days: [
            { name: "HIIT Cardio", exercises: [
              { name: "Burpee", sets: 10, reps: "30s", rest: "30s" },
              { name: "Polichinelo", sets: 10, reps: "30s", rest: "30s" },
              { name: "Mountain Climbers", sets: 10, reps: "30s", rest: "30s" },
              { name: "Jump Squat", sets: 10, reps: "30s", rest: "30s" },
            ]},
            { name: "Funcional + Force", exercises: [
              { name: "Agachamento", sets: 4, reps: "10", rest: "90s" },
              { name: "Flexão", sets: 4, reps: "15", rest: "90s" },
              { name: "Kettlebell Swing", sets: 3, reps: "20", rest: "90s" },
              { name: "Barra Fixa", sets: 3, reps: "max", rest: "90s" },
            ]},
            { name: "Circuito Misto", exercises: [
              { name: "Corrida no Local", sets: 3, reps: "45s", rest: "15s" },
              { name: "Rosca Terra", sets: 3, reps: "10", rest: "60s" },
              { name: "Box Jump", sets: 3, reps: "8", rest: "90s" },
              { name: "Abdominal", sets: 3, reps: "20", rest: "60s" },
            ]},
          ],
        }],
      },
    },
    {
      name: "Cutting (4 refeições)",
      type: "diet",
      description: "Dieta de cutting com 4 refeições diárias",
      data: {
        meals: [
          { mealName: "Café da Manhã", time: "07:00", foods: [
            { name: "Ovo (2 unidades)", quantity: "100g" },
            { name: "Pão integral", quantity: "50g" },
            { name: "Café preto", quantity: "200ml" },
          ]},
          { mealName: "Almoço", time: "12:00", foods: [
            { name: "Peito de frango grelhado", quantity: "150g" },
            { name: "Arroz integral", quantity: "100g" },
            { name: "Brócolis cozido", quantity: "150g" },
          ]},
          { mealName: "Lanche", time: "16:00", foods: [
            { name: "Iogurte grego", quantity: "150g" },
            { name: "Berries congelados", quantity: "100g" },
          ]},
          { mealName: "Jantar", time: "19:30", foods: [
            { name: "Peixe branco grelhado", quantity: "120g" },
            { name: "Batata doce cozida", quantity: "100g" },
            { name: "Salada verde", quantity: "200g" },
          ]},
        ],
      },
    },
    {
      name: "Bulking (6 refeições)",
      type: "diet",
      description: "Dieta de bulking com 6 refeições diárias",
      data: {
        meals: [
          { mealName: "Café da Manhã", time: "07:00", foods: [
            { name: "Ovo (3 unidades)", quantity: "150g" },
            { name: "Pão integral", quantity: "80g" },
            { name: "Mel", quantity: "15g" },
          ]},
          { mealName: "Lanche 1", time: "09:30", foods: [
            { name: "Aveia em flocos", quantity: "50g" },
            { name: "Banana", quantity: "100g" },
            { name: "Pasta de amendoim", quantity: "15g" },
          ]},
          { mealName: "Almoço", time: "12:00", foods: [
            { name: "Carne vermelha magra", quantity: "180g" },
            { name: "Arroz branco", quantity: "150g" },
            { name: "Batata cozida", quantity: "150g" },
          ]},
          { mealName: "Lanche 2", time: "15:00", foods: [
            { name: "Whey protein", quantity: "30g" },
            { name: "Frutas secas", quantity: "30g" },
            { name: "Leite integral", quantity: "200ml" },
          ]},
          { mealName: "Jantar", time: "18:30", foods: [
            { name: "Peito de frango", quantity: "160g" },
            { name: "Batata doce", quantity: "150g" },
            { name: "Azeite", quantity: "10ml" },
          ]},
          { mealName: "Antes de Dormir", time: "21:00", foods: [
            { name: "Caseína", quantity: "30g" },
            { name: "Melancia", quantity: "200g" },
          ]},
        ],
      },
    },
    {
      name: "Manutenção (5 refeições)",
      type: "diet",
      description: "Dieta de manutenção equilibrada com 5 refeições",
      data: {
        meals: [
          { mealName: "Café da Manhã", time: "07:00", foods: [
            { name: "Ovo (2 unidades)", quantity: "100g" },
            { name: "Aveia", quantity: "40g" },
            { name: "Morango", quantity: "100g" },
          ]},
          { mealName: "Lanche da Manhã", time: "10:00", foods: [
            { name: "Banana", quantity: "100g" },
            { name: "Amêndoas", quantity: "20g" },
          ]},
          { mealName: "Almoço", time: "13:00", foods: [
            { name: "Peito de frango grelhado", quantity: "150g" },
            { name: "Arroz integral", quantity: "120g" },
            { name: "Brócolis", quantity: "150g" },
          ]},
          { mealName: "Lanche da Tarde", time: "16:00", foods: [
            { name: "Iogurte natural", quantity: "150g" },
            { name: "Granola integral", quantity: "30g" },
          ]},
          { mealName: "Jantar", time: "19:00", foods: [
            { name: "Peixe grelhado", quantity: "130g" },
            { name: "Batata cozida", quantity: "120g" },
            { name: "Salada", quantity: "200g" },
          ]},
        ],
      },
    },
    {
      name: "Low Carb (4 refeições)",
      type: "diet",
      description: "Dieta low carb com 4 refeições",
      data: {
        meals: [
          { mealName: "Café da Manhã", time: "07:00", foods: [
            { name: "Ovo (3 unidades)", quantity: "150g" },
            { name: "Bacon magro", quantity: "40g" },
            { name: "Café com manteiga", quantity: "250ml" },
          ]},
          { mealName: "Almoço", time: "12:30", foods: [
            { name: "Carne vermelha magra", quantity: "180g" },
            { name: "Salada com azeite", quantity: "300g" },
            { name: "Queijo meia cura", quantity: "30g" },
          ]},
          { mealName: "Lanche", time: "16:00", foods: [
            { name: "Abacate", quantity: "100g" },
            { name: "Castanhas do Brasil", quantity: "30g" },
          ]},
          { mealName: "Jantar", time: "19:30", foods: [
            { name: "Peixe gordo (salmão)", quantity: "150g" },
            { name: "Brócolis com manteiga", quantity: "200g" },
            { name: "Azeitonas", quantity: "50g" },
          ]},
        ],
      },
    },
  ];

  const { error } = await supabase.from("plan_templates").insert(defaults);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/templates");
  return { seeded: defaults.length };
}
