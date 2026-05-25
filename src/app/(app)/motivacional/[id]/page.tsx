import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { MotivacionalPlayer } from "./motivacional-player";

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
  is_active: boolean;
}

export default async function MotivacionalPage({ params }: Props) {
  const { id } = await params;
  // Admin client porque o user chega aqui via push notification — pode estar
  // logado mas com sessao expirada/sem claim certo, e o conteudo nao depende
  // de dado do user. Mantemos `is_active=true` no filtro pra nao exibir video
  // inativado depois de notificado.
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("motivational_videos" as never)
    .select("id, title, body, youtube_id, is_active")
    .eq("id" as never, id)
    .eq("is_active" as never, true)
    .single();

  const video = data as unknown as VideoRow | null;
  if (!video) notFound();

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-pink text-sm font-semibold hover:text-pink-light"
        >
          <ArrowLeft size={16} />
          Voltar
        </Link>
        <span className="font-mono text-[10px] text-gray-3 tracking-[0.12em] uppercase">
          Motivacional
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
        <MotivacionalPlayer
          youtubeId={video.youtube_id}
          title={video.title}
          body={video.body}
        />
      </div>
    </div>
  );
}
