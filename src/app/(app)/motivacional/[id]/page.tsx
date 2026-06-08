import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { StoriesPlayer } from "./stories-player";

export const metadata: Metadata = {
  title: "Motivacional do dia",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

interface VideoRow {
  id: string;
  title: string;
  body: string | null;
  youtube_id: string;
  sort_order: number;
}

/**
 * Tela Stories (Instagram-style) de motivacionais.
 *
 * Push notification leva pra /motivacional/[id] (id do video do dia). A tela
 * mostra APENAS o video do dia (1 story). A rotacao (1 por dia, sempre
 * alternando) vem do cron, que escolhe o id pelo dia-do-ano. Sem carrossel.
 */
export default async function MotivacionalPage({ params }: Props) {
  const { id } = await params;
  const admin = createAdminSupabaseClient();

  // Abre SOMENTE o vídeo do dia (o id que o push enviou).
  const { data: target } = await admin
    .from("motivational_videos" as never)
    .select("id, title, body, youtube_id, sort_order")
    .eq("id" as never, id)
    .eq("is_active" as never, true)
    .maybeSingle();

  let video = target as unknown as VideoRow | null;

  // Fallback: se o vídeo foi inativado entre o push e o clique, mostra o vídeo
  // do dia pela MESMA rotação do cron (dia-do-ano % nº de ativos).
  if (!video) {
    const { data } = await admin
      .from("motivational_videos" as never)
      .select("id, title, body, youtube_id, sort_order")
      .eq("is_active" as never, true)
      .order("sort_order" as never, { ascending: true });
    const videos = (data ?? []) as unknown as VideoRow[];
    if (videos.length === 0) notFound();
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    video = videos[dayOfYear % videos.length];
  }

  if (!video) notFound();
  return <StoriesPlayer videos={[video]} startIndex={0} />;
}
