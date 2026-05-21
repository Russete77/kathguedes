"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, ExternalLink, Loader2, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VideoForm } from "./video-form";
import {
  deleteMotivationalVideo,
  toggleMotivationalVideoActive,
} from "./actions";

interface VideoRow {
  id: string;
  title: string;
  body: string | null;
  youtube_id: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export function VideoList({
  videos,
  todaysVideoId,
}: {
  videos: VideoRow[];
  todaysVideoId: string | null;
}) {
  const [editing, setEditing] = useState<VideoRow | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete(id: string, title: string) {
    if (!confirm(`Excluir "${title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteMotivationalVideo(id);
        toast.success("Vídeo excluído");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  function handleToggleActive(id: string, current: boolean) {
    startTransition(async () => {
      try {
        await toggleMotivationalVideoActive(id, !current);
        toast.success(current ? "Vídeo desativado" : "Vídeo ativado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-16 bg-bg-1 border border-gray-4 rounded-[22px]">
        <p className="text-gray-2">Nenhum vídeo cadastrado ainda.</p>
        <p className="text-gray-3 text-sm mt-1">
          Adicione o primeiro pelo botão acima para começar o push diário.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((v) => {
          const isToday = v.id === todaysVideoId;
          return (
            <div
              key={v.id}
              className={`bg-bg-1 border rounded-[18px] overflow-hidden flex flex-col ${
                isToday ? "border-pink shadow-pink" : "border-gray-4"
              } ${!v.is_active ? "opacity-60" : ""}`}
            >
              <a
                href={`https://www.youtube.com/watch?v=${v.youtube_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block aspect-video bg-bg-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`}
                  alt={v.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 flex gap-1">
                  {isToday && (
                    <Badge variant="pink" className="gap-1">
                      <Star size={10} /> Vídeo do dia
                    </Badge>
                  )}
                  {!v.is_active && <Badge variant="dark">Inativo</Badge>}
                </div>
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-mono rounded px-1.5 py-0.5">
                  #{v.sort_order}
                </div>
              </a>

              <div className="p-4 flex flex-col flex-1 gap-2">
                <div className="text-white font-semibold leading-tight line-clamp-2">
                  {v.title}
                </div>
                {v.body && (
                  <p className="text-[12px] text-gray-2 leading-snug line-clamp-2">
                    {v.body}
                  </p>
                )}

                <div className="flex items-center gap-1 pt-2 mt-auto border-t border-gray-4">
                  <button
                    onClick={() => handleToggleActive(v.id, v.is_active)}
                    disabled={pending}
                    className="text-[11px] uppercase tracking-wider font-semibold px-2 py-1.5 rounded-md hover:bg-bg-2 text-gray-2 hover:text-pink disabled:opacity-50"
                  >
                    {v.is_active ? "Desativar" : "Ativar"}
                  </button>
                  <a
                    href={`https://www.youtube.com/watch?v=${v.youtube_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Abrir no YouTube"
                    className="ml-auto p-2 rounded-md text-gray-2 hover:text-pink hover:bg-bg-2"
                  >
                    <ExternalLink size={14} />
                  </a>
                  <button
                    onClick={() => setEditing(v)}
                    aria-label="Editar"
                    className="p-2 rounded-md text-gray-2 hover:text-pink hover:bg-bg-2"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(v.id, v.title)}
                    disabled={pending}
                    aria-label="Excluir"
                    className="p-2 rounded-md text-gray-2 hover:text-danger hover:bg-bg-2 disabled:opacity-50"
                  >
                    {pending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <VideoForm initial={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
