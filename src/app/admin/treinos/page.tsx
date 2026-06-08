import Link from "next/link";
import { Upload, Tag } from "lucide-react";
import { getWorkouts } from "../actions";
import { WorkoutList } from "./workout-list";
import { WorkoutForm } from "./workout-form";
import type { ComponentProps } from "react";

type WorkoutListItem = ComponentProps<typeof WorkoutList>["workouts"][number];

export const metadata = { title: "Biblioteca de Vídeos" };

export default async function AdminTreinosPage() {
  // Cast porque database.types.ts esta desatualizado vs migration 41
  // (is_free_preview). Resto do tipo bate ok.
  const workouts = (await getWorkouts()) as unknown as WorkoutListItem[];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-white">BIBLIOTECA DE VÍDEOS</h1>
          <p className="text-gray-2 text-sm mt-1">
            Publique vídeos de treino do YouTube em 30 segundos. Esta é a biblioteca que o
            aluno assiste e que pode ser puxada na montagem de consultorias.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/admin/treinos/bulk-import"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-1 border border-gray-4 text-pink hover:border-pink/50 text-sm font-semibold whitespace-nowrap"
          >
            <Upload size={14} />
            Importar em massa
          </Link>
          <Link
            href="/admin/treinos/tag"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-1 border border-gray-4 text-pink hover:border-pink/50 text-sm font-semibold whitespace-nowrap"
          >
            <Tag size={14} />
            Periodização
          </Link>
          <WorkoutForm />
        </div>
      </div>

      <WorkoutList workouts={workouts} />
    </div>
  );
}
