import type { MetadataRoute } from "next";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

// Revalida a cada hora — sitemap reflete novos treinos publicados sem precisar deploy.
export const revalidate = 3600;

const BASE = "https://www.kathguedes.com.br";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── Paginas estaticas (priority alto) ──
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/planos`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${BASE}/fitness`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/loja`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${BASE}/calculadora`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/afiliados`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/cupons`, lastModified: now, changeFrequency: "weekly", priority: 0.75 },
    { url: `${BASE}/desafio`, lastModified: now, changeFrequency: "weekly", priority: 0.65 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/registro`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ];

  // ── Treinos publicados (com lastmod REAL do DB) ──
  let workoutPages: MetadataRoute.Sitemap = [];
  try {
    const supabase = createAdminSupabaseClient();
    const { data: workouts } = await supabase
      .from("workout_videos")
      .select("id, published_at, views_count")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(1000);

    if (workouts) {
      workoutPages = workouts.map((w) => ({
        url: `${BASE}/fitness/${w.id}`,
        lastModified: w.published_at ? new Date(w.published_at) : now,
        changeFrequency: "monthly" as const,
        // Priority maior para treinos com mais views (signal de qualidade).
        priority:
          (w.views_count ?? 0) > 100
            ? 0.7
            : (w.views_count ?? 0) > 20
              ? 0.6
              : 0.5,
      }));
    }
  } catch {
    // Se DB falhar, retorna so estaticas — sitemap sempre disponivel.
  }

  return [...staticPages, ...workoutPages];
}
