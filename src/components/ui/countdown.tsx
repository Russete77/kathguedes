"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CountdownProps {
  expiresAt: Date;
  className?: string;
}

export function Countdown({ expiresAt, className }: CountdownProps) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) {
        setTime("Expirado");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTime(
        [h, m, s].map((n) => String(n).padStart(2, "0")).join(":")
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <span className={cn("font-mono font-medium", className)}>{time}</span>
  );
}
