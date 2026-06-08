import { cn } from "@/lib/utils";

type Props = { className?: string; children: React.ReactNode };

export function Display({ className, children }: Props) {
  return (
    <h1
      className={cn(
        "font-display text-[80px] lg:text-[140px] leading-none text-white",
        className
      )}
    >
      {children}
    </h1>
  );
}

export function H1({ className, children }: Props) {
  return (
    <h1
      className={cn(
        "font-display text-5xl lg:text-7xl leading-none text-white",
        className
      )}
    >
      {children}
    </h1>
  );
}

export function H2({ className, children }: Props) {
  return (
    <h2
      className={cn(
        "font-display text-4xl lg:text-5xl leading-tight text-white",
        className
      )}
    >
      {children}
    </h2>
  );
}

export function H3({ className, children }: Props) {
  return (
    <h3
      className={cn("font-body text-2xl font-bold text-white", className)}
    >
      {children}
    </h3>
  );
}

export function Label({ className, children }: Props) {
  return (
    <span
      className={cn(
        "font-mono text-[11px] text-pink tracking-[0.12em] uppercase",
        className
      )}
    >
      {children}
    </span>
  );
}
