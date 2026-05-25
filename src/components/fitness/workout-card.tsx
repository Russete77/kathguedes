import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { BarChart2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkoutCardProps {
  id: string;
  title: string;
  youtube_id: string;
  category: string;
  level: string;
  duration_minutes: number;
  required_plan: string;
  views_count: number;
  /**
   * Quando true, o card vira CTA pra /planos (com badge de cadeado e dimming).
   * O user ve que o conteudo existe e o que precisa pra desbloquear.
   */
  isLocked?: boolean;
}

const categoryLabels: Record<string, string> = {
  gluteo: "GLÚTEOS",
  pernas: "PERNAS",
  quadriceps: "QUADRÍCEPS",
  costas: "COSTAS",
  ombro: "OMBRO",
  peito: "PEITO",
  biceps: "BÍCEPS",
  triceps: "TRÍCEPS",
  abdomen: "ABDÔMEN",
  superior: "SUPERIOR",
  inferior: "INFERIOR",
  hiit: "HIIT",
  cardio: "CARDIO",
  funcional: "FUNCIONAL",
  full: "COMPLETO",
  alongamento: "ALONGAMENTO",
  aquecimento: "AQUECIMENTO",
  viagem: "VIAGEM",
  competicao: "COMPETIÇÃO",
};

const levelLabels: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export function WorkoutCard({
  id,
  title,
  youtube_id,
  category,
  level,
  duration_minutes,
  required_plan,
  views_count,
  isLocked = false,
}: WorkoutCardProps) {
  // Locked → vai pra /planos com CTA, em vez de /fitness/[id] (que ja gateia
  // com notFound() pra evitar IDOR via URL direta).
  const href = isLocked ? "/planos" : `/fitness/${id}`;
  return (
    <Link
      href={href}
      aria-label={
        isLocked
          ? `${title} — desbloqueie com o plano ${required_plan.toUpperCase()}`
          : title
      }
      className={cn(
        "bg-bg-1 border border-gray-4 rounded-[22px] overflow-hidden",
        "transition-all duration-200 group",
        isLocked
          ? "hover:border-yellow/40"
          : "hover:border-pink/40 hover:-translate-y-0.5",
      )}
    >
      {/* Thumb */}
      <div className="h-[180px] bg-bg-2 relative overflow-hidden">
        <Image
          src={`https://img.youtube.com/vi/${youtube_id}/hqdefault.jpg`}
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className={cn(
            "object-cover transition-opacity duration-200",
            isLocked
              ? "opacity-30 group-hover:opacity-40"
              : "opacity-80 group-hover:opacity-100",
          )}
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-base/80 to-transparent" />
        <div className="absolute bottom-3 left-3">
          <Badge variant="pink">{categoryLabels[category] || category}</Badge>
        </div>
        {required_plan !== "free" && (
          <div className="absolute top-3 right-3">
            <Badge variant="solid">{required_plan.toUpperCase()}</Badge>
          </div>
        )}
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-bg-1/90 border border-yellow/40 rounded-full p-3.5 shadow-pink">
              <Lock size={22} className="stroke-yellow" />
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        <h3
          className={cn(
            "font-display text-[24px] leading-none mb-2 transition-colors",
            isLocked
              ? "text-gray-1 group-hover:text-yellow"
              : "text-white group-hover:text-pink",
          )}
        >
          {title.toUpperCase()}
        </h3>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[12px] text-gray-3">
            <strong className="text-pink">{duration_minutes}</strong> min ·{" "}
            {levelLabels[level] || level}
          </span>
          {isLocked ? (
            <span className="font-mono text-[10px] text-yellow tracking-wider uppercase">
              Ver planos
            </span>
          ) : (
            <span className="font-mono text-[11px] text-gray-3 flex items-center gap-1">
              <BarChart2 size={12} className="stroke-gray-3" />
              {views_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
