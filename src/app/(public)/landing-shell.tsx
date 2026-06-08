"use client";

import { type ReactNode } from "react";
import { Preloader } from "@/components/landing/preloader";
import { MouseGlow } from "@/components/landing/mouse-glow";
import { ScrollProgress } from "@/components/landing/scroll-progress";

interface LandingShellProps {
  children: ReactNode;
}

export function LandingShell({ children }: LandingShellProps) {
  return (
    <>
      <Preloader />
      <ScrollProgress />
      <MouseGlow />
      <div className="min-h-screen bg-bg-base noise-overlay relative">
        {children}
      </div>
    </>
  );
}
