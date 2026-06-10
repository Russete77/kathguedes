"use server";

import { z } from "zod";
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
  createPartnerStoreSchema,
  updateConsultationSchema,
  parseFormData,
} from "@/lib/validations";
import { generateCoachTipsFromYoutube } from "@/lib/coach-tips";
import { isExerciseCategory } from "@/constants/categories";
import { creditWalletCents } from "@/lib/billing/wallet";
import { getCashbackPct, getActivePlans } from "@/lib/billing/plans";
import { requireAdmin as requireAdminBase } from "@/lib/auth-helpers";
import type { PlanTier } from "@/lib/supabase/types";

// ── Auth helper ──
// Wrapper que delega ao helper centralizado e retorna userId.
// Mantém a assinatura `requireAdmin(): Promise<string>` que o resto do arquivo já usa.
async function requireAdmin(): Promise<string> {
  await requireAdminBase();
  const { userId } = await auth();
  if (!userId) throw new Error("Não autenticado");
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
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Move um treino pra cima ou pra baixo na ordem (sort_order).
 * Faz swap atômico com o vizinho — se já é o primeiro/último, vira no-op.
 */
export async function moveWorkout(id: string, direction: "up" | "down"): Promise<void> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  // Busca o treino atual
  const { data: current, error: e1 } = await supabase
    .from("workout_videos")
    .select("id, sort_order")
    .eq("id", id)
    .single();
  if (e1 || !current) throw new Error(e1?.message ?? "Treino não encontrado");

  // Busca o vizinho na direção desejada
  const cmp = direction === "up" ? "lt" : "gt";
  const order = direction === "up" ? "desc" : "asc";
  const { data: neighbor } = await supabase
    .from("workout_videos")
    .select("id, sort_order")
    .filter("sort_order", cmp, current.sort_order)
    .order("sort_order", { ascending: order === "asc" })
    .limit(1)
    .maybeSingle();

  if (!neighbor) return; // já é o primeiro/último — no-op

  // Swap: usa sort_order temporário negativo pra evitar colisão de UNIQUE
  // (sort_order não tem UNIQUE no schema mas mantém o padrão seguro)
  const tmp = -Math.abs(current.sort_order) - 1;
  await supabase.from("workout_videos").update({ sort_order: tmp }).eq("id", current.id);
  await supabase.from("workout_videos").update({ sort_order: current.sort_order }).eq("id", neighbor.id);
  await supabase.from("workout_videos").update({ sort_order: neighbor.sort_order }).eq("id", current.id);

  revalidatePath("/admin/treinos");
  revalidatePath("/fitness");
}

/**
 * Mantém a tabela `exercises` em sincronia com a biblioteca de vídeos.
 * A Biblioteca de Vídeos (workout_videos) é a FONTE ÚNICA do catálogo de
 * exercícios: cada vídeo publicado tem exatamente um exercício vinculado, com
 * o mesmo nome e categoria. Assim todo exercício escolhido num plano já traz o
 * vídeo de execução, sem cadastro duplicado.
 *
 * - Vídeo publicado  → cria/vincula/reativa o exercício e sincroniza nome+categoria
 * - Vídeo despublicado/apagado → desativa o exercício (some dos pickers)
 *
 * Idempotente e tolerante a colisão de nome (23505 ignorado).
 */
async function syncExerciseForWorkout(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  workoutId: string,
): Promise<void> {
  const { data: workout } = await supabase
    .from("workout_videos")
    .select("id, title, category, is_published, level")
    .eq("id", workoutId)
    .single();
  if (!workout) return;
  const w = workout as {
    id: string;
    title: string;
    category: string;
    is_published: boolean;
    level: string;
  };

  // Catálogo é chaveado por VÍDEO (1 exercício por vídeo) — não por nome. Assim
  // o mesmo movimento em níveis diferentes (mesmo título) vira 2 exercícios,
  // diferenciados pelo `level`.
  const { data: linked } = await supabase
    .from("exercises" as never)
    .select("id" as never)
    .eq("workout_video_id" as never, w.id)
    .maybeSingle();
  const linkedId = (linked as { id?: string } | null)?.id ?? null;

  // Categoria de FORMATO (Full Body, HIIT, Cardio…) não vira exercício do
  // catálogo. Se já existir um vinculado (categoria mudou pra formato), desativa.
  if (!w.is_published || !isExerciseCategory(w.category)) {
    if (linkedId) {
      await supabase
        .from("exercises" as never)
        .update({ is_active: false } as never)
        .eq("id" as never, linkedId);
    }
    return;
  }

  // Publicado + já vinculado → sincroniza nome/categoria/nível e reativa.
  if (linkedId) {
    await supabase
      .from("exercises" as never)
      .update({
        name: w.title,
        primary_category: w.category,
        level: w.level,
        is_active: true,
      } as never)
      .eq("id" as never, linkedId);
    return;
  }

  // Cria do zero, vinculado ao vídeo. Nome pode repetir (níveis distintos) —
  // o catálogo diferencia pelo `level`.
  const { error: insErr } = await supabase
    .from("exercises" as never)
    .insert({
      name: w.title,
      primary_category: w.category,
      level: w.level,
      secondary_groups: [],
      equipment: [],
      default_sets: 3,
      default_reps: "10-12",
      default_rest: 60,
      workout_video_id: w.id,
      is_active: true,
      sort_order: 0,
    } as never);
  if (insErr) throw new Error(insErr.message);
}

export async function createWorkout(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const data = parseFormData(createWorkoutSchema, formData);

  const { data: inserted, error } = await supabase
    .from("workout_videos")
    .insert({
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
      thumbnail_url: data.thumbnail_url || null,
      block: data.block ?? null,
      week_in_block: data.week_in_block ?? null,
      split_slot: data.split_slot || null,
      track: data.track || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Biblioteca = fonte única do catálogo: cria o exercício vinculado.
  if (inserted?.id) {
    await syncExerciseForWorkout(supabase, inserted.id);
    revalidatePath("/admin/exercises");
  }

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
      is_free_preview: formData.get("is_free_preview") === "true",
      notes: (formData.get("notes") as string) || null,
      thumbnail_url: (formData.get("thumbnail_url") as string) || null,
      block: formData.get("block") ? Number(formData.get("block")) : null,
      week_in_block: formData.get("week_in_block")
        ? Number(formData.get("week_in_block"))
        : null,
      split_slot: (formData.get("split_slot") as string) || null,
      track: (formData.get("track") as string) || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  // Mantém o exercício vinculado em sincronia (nome/categoria/ativo).
  await syncExerciseForWorkout(supabase, id);
  revalidatePath("/admin/exercises");
  revalidatePath("/admin/treinos");
}

const bulkTagSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  track: z.string().trim().max(60).nullable().optional(),
  block: z.coerce.number().int().min(1).max(99).nullable().optional(),
  week_in_block: z.coerce.number().int().min(1).max(6).nullable().optional(),
  split_slot: z.string().trim().max(60).nullable().optional(),
});

/**
 * Aplica metadados de periodização (track/block/week_in_block/split_slot) a
 * vários vídeos de uma vez. Só os campos enviados são alterados ("" = limpar).
 * Não mexe na categoria/publicação — só na periodização usada pela consultoria/IA.
 */
export async function bulkTagWorkouts(input: {
  ids: string[];
  track?: string | null;
  block?: number | null;
  week_in_block?: number | null;
  split_slot?: string | null;
}): Promise<{ ok: true; updated: number }> {
  await requireAdmin();
  const data = bulkTagSchema.parse(input);
  const supabase = createAdminSupabaseClient();

  const patch: Record<string, unknown> = {};
  if (data.track !== undefined) patch.track = data.track || null;
  if (data.block !== undefined) patch.block = data.block ?? null;
  if (data.week_in_block !== undefined) patch.week_in_block = data.week_in_block ?? null;
  if (data.split_slot !== undefined) patch.split_slot = data.split_slot || null;

  if (Object.keys(patch).length === 0) {
    return { ok: true, updated: 0 };
  }

  const { error } = await supabase
    .from("workout_videos")
    .update(patch as never)
    .in("id", data.ids);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/treinos");
  revalidatePath("/admin/treinos/tag");
  return { ok: true, updated: data.ids.length };
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

  // Publicar cria/reativa o exercício; despublicar desativa.
  await syncExerciseForWorkout(supabase, id);
  revalidatePath("/admin/exercises");
  revalidatePath("/admin/treinos");
}

/**
 * Tenta excluir o treino. Se houver workout_logs vinculados (FK 23503), cai em
 * soft-delete: marca is_published=false (some do app do user) e preserva o
 * historico de quem ja completou.
 *
 * Retorna `affectedLogs` quando cai em soft-delete, para a UI poder oferecer
 * a opção de forçar (deleteWorkoutForce).
 */
export async function deleteWorkout(
  id: string,
): Promise<{ ok: true; mode: "hard" | "soft"; affectedLogs?: number }> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  // Limpa likes primeiro (FK on delete cascade — defensivo se schema mudou)
  await supabase.from("workout_likes" as never).delete().eq("workout_id" as never, id);

  // Vídeo saindo do ar = exercício sem vídeo. Desativa o exercício vinculado
  // (some dos pickers) antes de apagar/despublicar o vídeo.
  await supabase
    .from("exercises" as never)
    .update({ is_active: false } as never)
    .eq("workout_video_id" as never, id);
  revalidatePath("/admin/exercises");

  const { error } = await supabase.from("workout_videos").delete().eq("id", id);

  if (!error) {
    revalidatePath("/admin/treinos");
    return { ok: true, mode: "hard" };
  }

  // 23503 = foreign_key_violation (workout_logs.workout_id sem on delete).
  // Despublica em vez de apagar — preserva os logs de quem ja treinou.
  if (error.code === "23503") {
    // Conta quantos logs estão segurando a exclusão (info pra UI)
    const { count: logsCount } = await supabase
      .from("workout_logs")
      .select("id", { count: "exact", head: true })
      .eq("workout_id", id);
    const { error: unpubErr } = await supabase
      .from("workout_videos")
      .update({ is_published: false, published_at: null })
      .eq("id", id);
    if (unpubErr) throw new Error(unpubErr.message);
    revalidatePath("/admin/treinos");
    return { ok: true, mode: "soft", affectedLogs: logsCount ?? 0 };
  }

  throw new Error(error.message);
}

/**
 * Hard delete: apaga workout_logs + workout_likes + workout_videos.
 * IRREVERSÍVEL — usar só quando o admin confirma explicitamente que quer
 * apagar mesmo com histórico de treino dos usuários.
 *
 * Retorna o número de logs/likes apagados pra confirmação na UI.
 */
export async function deleteWorkoutForce(
  id: string,
): Promise<{ ok: true; deletedLogs: number; deletedLikes: number }> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  // 1) Apaga likes (defensivo — FK ja tem cascade)
  const { count: likesCount } = await supabase
    .from("workout_likes" as never)
    .select("workout_id", { count: "exact", head: true })
    .eq("workout_id" as never, id);
  await supabase
    .from("workout_likes" as never)
    .delete()
    .eq("workout_id" as never, id);

  // 2) Apaga logs (sem cascade no schema — temos que limpar manualmente)
  const { count: logsCount } = await supabase
    .from("workout_logs")
    .select("id", { count: "exact", head: true })
    .eq("workout_id", id);
  const { error: logsErr } = await supabase
    .from("workout_logs")
    .delete()
    .eq("workout_id", id);
  if (logsErr) throw new Error(`Falha ao apagar logs: ${logsErr.message}`);

  // 3) Desativa + desvincula o exercício do catálogo (vídeo apagado = sem vídeo).
  await supabase
    .from("exercises" as never)
    .update({ workout_video_id: null, is_active: false } as never)
    .eq("workout_video_id" as never, id);
  revalidatePath("/admin/exercises");

  // 4) Finalmente apaga o vídeo
  const { error } = await supabase.from("workout_videos").delete().eq("id", id);
  if (error) {
    throw new Error(`Falha ao apagar workout_video: ${error.message}`);
  }

  revalidatePath("/admin/treinos");
  return {
    ok: true,
    deletedLogs: logsCount ?? 0,
    deletedLikes: likesCount ?? 0,
  };
}

/**
 * Transcreve a legenda do vídeo no YouTube e resume nas "dicas do profissional"
 * (coach_tips). Usa OpenAI. Se o vídeo não tiver legenda, lança erro pedindo
 * preenchimento manual (saveWorkoutTips).
 */
export async function transcribeWorkoutTips(
  workoutId: string,
): Promise<{ ok: true; tips: string }> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const { data: workout, error: wErr } = await supabase
    .from("workout_videos")
    .select("id, title, youtube_id")
    .eq("id", workoutId)
    .single();
  if (wErr || !workout) throw new Error(wErr?.message ?? "Vídeo não encontrado");
  const w = workout as { id: string; title: string; youtube_id: string };
  if (!w.youtube_id) throw new Error("Vídeo sem youtube_id.");

  const { tips, source } = await generateCoachTipsFromYoutube(w.youtube_id, w.title);

  const { error: upErr } = await supabase
    .from("workout_videos")
    .update({
      coach_tips: tips,
      coach_tips_source: source,
      coach_tips_updated_at: new Date().toISOString(),
    } as never)
    .eq("id", workoutId);
  if (upErr) throw new Error(upErr.message);

  revalidatePath("/admin/treinos");
  revalidatePath(`/fitness/${workoutId}`);
  return { ok: true, tips };
}

/**
 * Salva/edita as dicas do profissional manualmente (rede de segurança quando
 * o vídeo não tem legenda ou a Kath quer ajustar o texto).
 */
export async function saveWorkoutTips(
  workoutId: string,
  tips: string,
): Promise<{ ok: true }> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const clean = tips.trim();
  const { error } = await supabase
    .from("workout_videos")
    .update({
      coach_tips: clean || null,
      coach_tips_source: clean ? "manual" : null,
      coach_tips_updated_at: clean ? new Date().toISOString() : null,
    } as never)
    .eq("id", workoutId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/treinos");
  revalidatePath(`/fitness/${workoutId}`);
  return { ok: true };
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

  notifyByPlan(data.required_plan as PlanTier, {
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

export type PlanCount = {
  slug: PlanTier;
  name: string;
  level: number;
  count: number;
  is_paid: boolean;
};

export async function getDashboardMetrics() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Planos ativos (lookup dinâmico — fonte de verdade: tabela `plans`)
  const activePlans = await getActivePlans();

  const planCountQueries = activePlans.map(p =>
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("plan_tier", p.slug)
      .then(res => ({ slug: p.slug, name: p.name, level: p.level, is_paid: p.price_cents > 0, count: res.count || 0 })),
  );

  const [
    // Subscribers totais
    totalProfiles,
    // Plan counts (dinâmico)
    planCountResults,
    // Subscription status
    activeSubCount, pastDueCount, canceledCount,
    // Growth
    signupsThisWeek, signupsLastWeek,
    // Revenue
    revenueTotal, revenueThisMonth,
    ordersPending, ordersPaid, ordersShipped, ordersDelivered, ordersCanceled,
    // Consultations
    consultPending, consultInProgress, consultDelivered,
    // Chat VIP
    unreadMessages,
    // Content
    totalWorkouts, totalWorkoutsPublished,
    totalCouponsActive, totalCouponsExpired,
    // Rankings
    topWorkouts, topCoupons, topAffiliates,
    // Alerts
    lowStockProducts,
    // Recent
    recentSignups,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    Promise.all(planCountQueries),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("subscription_status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("subscription_status", "past_due"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("subscription_status", "canceled"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", twoWeeksAgo).lt("created_at", weekAgo),
    supabase.from("orders").select("total_cents").in("status", ["paid", "shipped", "delivered"]),
    supabase.from("orders").select("total_cents").in("status", ["paid", "shipped", "delivered"]).gte("created_at", monthAgo),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "shipped"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "delivered"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "canceled"),
    supabase.from("consultations").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("consultations").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
    supabase.from("consultations").select("id", { count: "exact", head: true }).eq("status", "delivered"),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("sender_role", "user").eq("is_read", false),
    supabase.from("workout_videos").select("id", { count: "exact", head: true }),
    supabase.from("workout_videos").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("coupons").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("coupons").select("id", { count: "exact", head: true }).lt("valid_until", now.toISOString()).eq("is_active", true),
    supabase.from("workout_videos").select("id, title, views_count").eq("is_published", true).order("views_count", { ascending: false }).limit(5),
    supabase.from("coupons").select("id, code, uses_count").eq("is_active", true).order("uses_count", { ascending: false }).limit(5),
    supabase.from("affiliate_links").select("id, title, clicks_count").eq("is_active", true).order("clicks_count", { ascending: false }).limit(5),
    supabase.from("products").select("id, title, stock").eq("is_active", true).lte("stock", 5).order("stock", { ascending: true }).limit(5),
    supabase.from("profiles").select("id, full_name, plan_tier, created_at").order("created_at", { ascending: false }).limit(5),
  ]);

  const planCounts: PlanCount[] = planCountResults;
  const paidUsersTotal = planCounts.filter(p => p.is_paid).reduce((sum, p) => sum + p.count, 0);

  const revenueTotalCents = (revenueTotal.data || []).reduce((sum, o) => sum + (o.total_cents || 0), 0);
  const revenueMonthCents = (revenueThisMonth.data || []).reduce((sum, o) => sum + (o.total_cents || 0), 0);

  const signupsThisWeekCount = signupsThisWeek.count || 0;
  const signupsLastWeekCount = signupsLastWeek.count || 0;
  const growthPct = signupsLastWeekCount > 0
    ? Math.round(((signupsThisWeekCount - signupsLastWeekCount) / signupsLastWeekCount) * 100)
    : signupsThisWeekCount > 0 ? 100 : 0;

  return {
    totalSubscribers: totalProfiles.count || 0,
    planCounts,
    paidUsersTotal,
    subscriptionStatus: {
      active: activeSubCount.count || 0,
      pastDue: pastDueCount.count || 0,
      canceled: canceledCount.count || 0,
    },
    signupsThisWeek: signupsThisWeekCount,
    signupsLastWeek: signupsLastWeekCount,
    growthPct,
    revenueTotalCents,
    revenueMonthCents,
    orders: {
      pending: ordersPending.count || 0,
      paid: ordersPaid.count || 0,
      shipped: ordersShipped.count || 0,
      delivered: ordersDelivered.count || 0,
      canceled: ordersCanceled.count || 0,
    },
    consultations: {
      pending: consultPending.count || 0,
      inProgress: consultInProgress.count || 0,
      delivered: consultDelivered.count || 0,
    },
    unreadMessages: unreadMessages.count || 0,
    totalWorkouts: totalWorkouts.count || 0,
    publishedWorkouts: totalWorkoutsPublished.count || 0,
    activeCoupons: totalCouponsActive.count || 0,
    expiredCoupons: totalCouponsExpired.count || 0,
    topWorkouts: topWorkouts.data || [],
    topCoupons: topCoupons.data || [],
    topAffiliates: topAffiliates.data || [],
    lowStockProducts: (lowStockProducts.data || []) as { id: string; title: string; stock: number }[],
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
    .update(data as Record<string, unknown>)
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
    price_cents: data.price_cents,
    cost_cents: data.cost_cents,
    compare_price: data.compare_price ?? null,
    category: data.category,
    module: data.module,
    stock: data.stock,
    weight_kg: data.weight_kg,
    height_cm: data.height_cm,
    width_cm: data.width_cm,
    length_cm: data.length_cm,
    partner_store_id: data.partner_store_id ?? null,
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
      price_cents: data.price_cents,
      cost_cents: data.cost_cents,
      compare_price: data.compare_price ?? null,
      category: data.category,
      module: data.module,
      stock: data.stock,
      weight_kg: data.weight_kg,
      height_cm: data.height_cm,
      width_cm: data.width_cm,
      length_cm: data.length_cm,
      partner_store_id: data.partner_store_id ?? null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/loja");
}

// ══════════════════════════════════════════
// LOJA — LOJAS PARCEIRAS
// ══════════════════════════════════════════

export async function getPartnerStores() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("partner_stores" as never)
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data as Array<{
    id: string;
    name: string;
    whatsapp_number: string;
    logo_url: string | null;
    is_active: boolean;
    created_at: string;
  }>;
}

export async function createPartnerStore(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const data = parseFormData(createPartnerStoreSchema, formData);
  const { error } = await supabase.from("partner_stores" as never).insert({
    name: data.name,
    whatsapp_number: data.whatsapp_number,
    logo_url: data.logo_url ?? null,
  } as never);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/loja/parceiros");
  revalidatePath("/admin/loja");
}

export async function updatePartnerStore(id: string, formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const data = parseFormData(createPartnerStoreSchema, formData);
  const { error } = await supabase
    .from("partner_stores" as never)
    .update({
      name: data.name,
      whatsapp_number: data.whatsapp_number,
      logo_url: data.logo_url ?? null,
    } as never)
    .eq("id" as never, id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/loja/parceiros");
  revalidatePath("/admin/loja");
}

export async function deletePartnerStore(id: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  // Desvincula produtos antes de deletar
  await supabase
    .from("products")
    .update({ partner_store_id: null } as never)
    .eq("partner_store_id" as never, id);
  const { error } = await supabase
    .from("partner_stores" as never)
    .delete()
    .eq("id" as never, id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/loja/parceiros");
  revalidatePath("/admin/loja");
}

export async function togglePartnerStoreActive(id: string, active: boolean) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("partner_stores" as never)
    .update({ is_active: active } as never)
    .eq("id" as never, id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/loja/parceiros");
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
        .profiles?.plan_tier) ?? "start";
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

/**
 * Salva o plano que a Kath acabou de montar (treino ou dieta) como um
 * plan_template reutilizável — sem precisar ir até /admin/templates.
 */
export async function saveCurrentAsTemplate(
  name: string,
  type: "workout" | "diet",
  data: unknown,
): Promise<{ ok: true }> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const clean = name.trim();
  if (!clean) throw new Error("Dê um nome ao template");
  if (!data) throw new Error("Plano vazio");
  const { error } = await supabase
    .from("plan_templates")
    .insert({ name: clean, type, data } as never);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/templates");
  return { ok: true };
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
              { name: "Abdução na Máquina", sets: 3, reps: "15", rest: "60s" },
            ]},
            { name: "Pernas Isoladas", exercises: [
              { name: "Leg Press Oblíquo", sets: 3, reps: "10-12", rest: "90s" },
              { name: "Stiff Leg Deadlift", sets: 3, reps: "10-12", rest: "90s" },
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

// ══════════════════════════════════════════
// EXERCISES (catalogo — migration 34)
// ══════════════════════════════════════════

const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(120),
  primary_category: z.enum([
    "gluteo", "quadriceps", "posterior", "panturrilha", "costas", "ombro", "biceps", "triceps",
    "peito", "abdomen", "superior", "inferior", "hiit", "cardio", "funcional",
    "full", "alongamento", "aquecimento", "viagem", "competicao",
  ]),
  secondary_groups: z.array(z.string().trim().max(40)).max(8).default([]),
  equipment: z.array(z.string().trim().max(40)).max(8).default([]),
  default_sets: z.coerce.number().int().min(1).max(20).default(3),
  default_reps: z.string().trim().min(1).max(20).default("10-12"),
  default_rest: z.coerce.number().int().min(0).max(600).default(60),
  notes: z.string().trim().max(2000).nullable().optional(),
  workout_video_id: z.string().uuid().nullable().optional(),
  is_active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
});

function parseExerciseFormData(formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  // Arrays vêm como string separada por vírgula (UI)
  const secondary_groups = raw.secondary_groups
    ? raw.secondary_groups.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const equipment = raw.equipment
    ? raw.equipment.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  if (!("is_active" in raw)) raw.is_active = "false";
  // "__none__" é o sentinel do select "— sem vídeo —"; vira null (senão quebra no uuid()).
  const videoId = raw.workout_video_id && raw.workout_video_id !== "__none__"
    ? raw.workout_video_id
    : null;
  return exerciseSchema.parse({
    ...raw,
    secondary_groups,
    equipment,
    workout_video_id: videoId,
    notes: raw.notes || null,
  });
}

export async function createExercise(formData: FormData) {
  await requireAdmin();
  const data = parseExerciseFormData(formData);
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("exercises").insert(data);
  if (error) {
    if (error.code === "23505") {
      throw new Error("Já existe exercício com esse nome");
    }
    throw new Error(error.message);
  }
  revalidatePath("/admin/exercises");
}

export async function updateExercise(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseExerciseFormData(formData);
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("exercises").update(data).eq("id", id);
  if (error) {
    if (error.code === "23505") {
      throw new Error("Já existe exercício com esse nome");
    }
    throw new Error(error.message);
  }
  revalidatePath("/admin/exercises");
}

export async function deleteExercise(id: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  // Soft delete via is_active=false (preserva exercise_id em JSONBs antigos)
  const { error } = await supabase
    .from("exercises")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/exercises");
}

/**
 * Promove um workout_video a entrada no catálogo `exercises`.
 *
 * Caminho típico: admin cadastra o vídeo em /admin/treinos, depois clica em
 * "Promover" e o exercise é criado já vinculado (workout_video_id = id). Daí
 * a Kath pode escolhê-lo direto no plan-editor sem cadastrar duas vezes.
 *
 * Idempotente: se já existir exercise vinculado ao mesmo workout_video_id,
 * retorna alreadyExists sem criar duplicata. Se existir exercise com o MESMO
 * NOME mas sem o vínculo, vincula (UPDATE workout_video_id).
 *
 * Defaults conservadores (3x10-12, 60s) — admin refina em /admin/exercises.
 */
export async function promoteWorkoutToExercise(
  workoutId: string,
): Promise<
  | { ok: true; mode: "created" | "linked" | "alreadyExists"; exerciseId: string }
> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  // 1) Carrega o workout
  const { data: workout, error: wErr } = await supabase
    .from("workout_videos")
    .select("id, title, category, level")
    .eq("id", workoutId)
    .single();
  if (wErr || !workout) throw new Error(wErr?.message ?? "Treino nao encontrado");
  const w = workout as { id: string; title: string; category: string; level: string };

  // 2) Ja existe exercise vinculado a esse video? (chave = vídeo, não nome)
  const { data: linked } = await supabase
    .from("exercises" as never)
    .select("id" as never)
    .eq("workout_video_id" as never, workoutId)
    .maybeSingle();
  if (linked && (linked as { id?: string }).id) {
    return { ok: true, mode: "alreadyExists", exerciseId: (linked as { id: string }).id };
  }

  // 3) Cria do zero, vinculado ao vídeo. Nome pode repetir (níveis distintos).
  const { data: created, error: cErr } = await supabase
    .from("exercises" as never)
    .insert({
      name: w.title,
      primary_category: w.category,
      level: w.level,
      secondary_groups: [],
      equipment: [],
      default_sets: 3,
      default_reps: "10-12",
      default_rest: 60,
      workout_video_id: w.id,
      is_active: true,
      sort_order: 0,
    } as never)
    .select("id" as never)
    .single();
  if (cErr || !created) {
    throw new Error(cErr?.message ?? "Falha ao criar exercicio");
  }

  revalidatePath("/admin/exercises");
  revalidatePath("/admin/treinos");
  return { ok: true, mode: "created", exerciseId: (created as { id: string }).id };
}

export async function toggleExerciseActive(id: string, active: boolean) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("exercises")
    .update({ is_active: active })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/exercises");
}
