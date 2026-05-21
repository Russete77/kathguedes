import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { BarChart2 } from "lucide-react";
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
}

const categoryLabels: Record<string, string> = {
  gluteo: "GLÚTEOS",
  pernas: "PERNAS",
  superior: "SUPERIOR",
  hiit: "HIIT",
  full: "COMPLETO",
  viagem: "VIAGEM",
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
}: WorkoutCardProps) {
  return (
    <Link
      href={`/fitness/${id}`}
      className={cn(
        "bg-bg-1 border border-gray-4 rounded-[22px] overflow-hidden",
        "transition-all duration-200 hover:border-pink/40 hover:-translate-y-0.5 group"
      )}
    >
      {/* Thumb */}
      <div className="h-[180px] bg-bg-2 relative overflow-hidden">
        <Image
          src={`https://img.youtube.com/vi/${youtube_id}/hqdefault.jpg`}
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-200"
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
      </div>

      {/* Body */}
      <div className="p-5">
        <h3 className="font-display text-[24px] leading-none text-white mb-2 group-hover:text-pink transition-colors">
          {title.toUpperCase()}
        </h3>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[12px] text-gray-3">
            <strong className="text-pink">{duration_minutes}</strong> min ·{" "}
            {levelLabels[level] || level}
          </span>
          <span className="font-mono text-[11px] text-gray-3 flex items-center gap-1">
            <BarChart2 size={12} className="stroke-gray-3" />
            {views_count}
          </span>
        </div>
      </div>
    </Link>
  );
}
