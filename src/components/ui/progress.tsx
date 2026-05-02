import { cn } from "@/lib/utils";

interface ProgressProps {
  label?: string;
  value: number;
  max?: number;
  displayValue?: string;
  className?: string;
}

export function Progress({
  label,
  value,
  max = 100,
  displayValue,
  className,
}: ProgressProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {(label || displayValue) && (
        <div className="flex justify-between text-[13px]">
          {label && <span className="text-gray-1 font-medium">{label}</span>}
          {displayValue && (
            <span className="font-mono text-pink text-[12px]">
              {displayValue}
            </span>
          )}
        </div>
      )}
      <div className="h-1.5 bg-bg-3 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-pink to-pink-light transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
