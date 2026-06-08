"use client";

import { useEffect, useState } from "react";

export function Preloader() {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const start = performance.now();
    const duration = 700;
    const step = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(elapsed / duration, 1);
      // ease-in-out quart
      const eased = p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2;
      setProgress(Math.floor(eased * 100));
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        setTimeout(() => setDone(true), 120);
        setTimeout(() => setHidden(true), 500);
      }
    };
    requestAnimationFrame(step);
  }, []);

  if (hidden) return null;

  return (
    <div
      className={`preloader-failsafe fixed inset-0 z-[999] flex flex-col items-center justify-center transition-all duration-700 ${
        done ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
      }`}
      style={{
        background: "radial-gradient(circle at 50% 50%, #1a0010 0%, #080808 100%)",
      }}
    >
      {/* Noise */}
      <div className="absolute inset-0 noise-overlay pointer-events-none" />

      {/* Neon glow */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, rgba(255,0,128,0.5) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* Logo text with 3D rotate-in */}
      <div className="relative z-10">
        <h1
          className="font-display text-[60px] sm:text-[90px] text-white leading-none tracking-tight"
          style={{
            animation: "title-rotate-in 1s cubic-bezier(0.165, 0.84, 0.44, 1) forwards",
          }}
        >
          KATH<span className="text-gradient-pink">APP</span>
        </h1>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 mt-10 w-48">
        <div className="h-[2px] bg-gray-4 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-pink to-pink-light rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="font-mono text-[10px] text-gray-3 tracking-[0.3em] mt-3 text-center">
          {progress}%
        </p>
      </div>
    </div>
  );
}
