"use client";

import { useEffect, useRef } from "react";

export function MouseGlow() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let x = 0, y = 0;
    let currentX = 0, currentY = 0;

    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
    };

    const lerp = () => {
      currentX += (x - currentX) * 0.08;
      currentY += (y - currentY) * 0.08;
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${currentX - 200}px, ${currentY - 200}px, 0)`;
      }
      requestAnimationFrame(lerp);
    };

    window.addEventListener("mousemove", onMove);
    const raf = requestAnimationFrame(lerp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={glowRef}
      className="fixed top-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none z-[1] opacity-20 hidden lg:block"
      style={{
        background: "radial-gradient(circle, rgba(255,0,128,0.25) 0%, transparent 70%)",
        filter: "blur(60px)",
        willChange: "transform",
      }}
    />
  );
}
