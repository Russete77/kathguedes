import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakBadgeProps {
  streak: number;
  className?: string;
}

export function StreakBadge({ streak, className }: StreakBadgeProps) {
  const isActive = streak > 0;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-full border",
        isActive
          ? "bg-pink-dim border-pink/25 text-pink"
          : "bg-bg-2 border-gray-4 text-gray-3",
        className
      )}
    >
      <Flame
        size={18}
        strokeWidth={isActive ? 2 : 1.6}
        className={cn(
          "transition-all",
          isActive && "drop-shadow-[0_0_6px_#FF0080]"
        )}
      />
      <span className="font-display text-[24px] leading-none">{streak}</span>
      <span className="font-mono text-[11px] tracking-[0.08em] uppercase">
        {streak === 1 ? "dia" : "dias"}
      </span>
    </div>
  );
}
