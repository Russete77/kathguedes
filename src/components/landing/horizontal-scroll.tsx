"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface HorizontalScrollProps {
  children: ReactNode;
  className?: string;
}

/**
 * Horizontal scroll section — scroll-driven.
 * As user scrolls vertically, content moves horizontally.
 */
export function HorizontalScroll({ children, className = "" }: HorizontalScrollProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    const onScroll = () => {
      const rect = section.getBoundingClientRect();
      const sectionTop = rect.top;
      const sectionHeight = rect.height - window.innerHeight;

      if (sectionTop < 0 && sectionTop > -sectionHeight) {
        const progress = Math.abs(sectionTop) / sectionHeight;
        const maxTranslate = track.scrollWidth - window.innerWidth;
        track.style.transform = `translate3d(${-progress * maxTranslate}px, 0, 0)`;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={sectionRef} className={`relative ${className}`} style={{ height: "300vh" }}>
      <div className="sticky top-0 h-screen overflow-hidden flex items-center">
        <div
          ref={trackRef}
          className="flex gap-6 px-6 lg:px-12"
          style={{ willChange: "transform" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
