import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getWorkouts } from "../../actions";
import { TagTool, type TagVideo } from "./tag-tool";

export const metadata = { title: "Periodização dos vídeos" };
export const dynamic = "force-dynamic";

export default async function TagWorkoutsPage() {
  const rows = (await getWorkouts()) as unknown as TagVideo[];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        href="/admin/treinos"
        className="inline-flex items-center gap-2 text-gray-2 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft size={16} />
        Voltar para treinos
      </Link>

      <div>
        <h1 className="font-display text-4xl text-white">PERIODIZAÇÃO DOS VÍDEOS</h1>
        <p className="text-gray-2 text-sm mt-1">
          Marque bloco, semana, slot do split e trilha em vários vídeos de uma vez.
          É o que a consultoria/IA usa para montar os blocos de 6 semanas.
        </p>
      </div>

      <TagTool videos={rows ?? []} />
    </div>
  );
}
