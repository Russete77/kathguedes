import { getMotivationalVideos } from "./actions";
import { VideoForm } from "./video-form";
import { VideoList } from "./video-list";

export const metadata = { title: "Admin · Vídeos motivacionais" };

export default async function AdminMotivacionaisPage() {
  const videos = await getMotivationalVideos();
  const activeCount = videos.filter((v) => v.is_active).length;

  // Vídeo do dia (mesma fórmula do cron) — só para destacar na lista
  const active = videos.filter((v) => v.is_active);
  let todaysVideoId: string | null = null;
  if (active.length > 0) {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    todaysVideoId = active[dayOfYear % active.length].id;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-white leading-tight">
            VÍDEOS MOTIVACIONAIS
          </h1>
          <p className="text-gray-2 text-xs sm:text-sm mt-1">
            Biblioteca usada no push diário. {activeCount} ativo
            {activeCount === 1 ? "" : "s"} de {videos.length}.
          </p>
        </div>
        <div className="self-start sm:self-auto">
          <VideoForm />
        </div>
      </div>

      <VideoList videos={videos} todaysVideoId={todaysVideoId} />
    </div>
  );
}
