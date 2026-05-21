"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  duration?: number;
  once?: boolean;
}

export function ScrollReveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
  duration = 700,
  once = true,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transitionDelay = `${delay}ms`;
          el.classList.add("sr-visible");
          if (once) observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, once]);

  const translateMap = {
    up: "translateY(30px)",
    down: "translateY(-30px)",
    left: "translateX(30px)",
    right: "translateX(-30px)",
    none: "none",
  };

  return (
    <div
      ref={ref}
      className={`sr-hidden ${className}`}
      style={{
        opacity: 0,
        transform: translateMap[direction],
        transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

/* Stagger helper — wraps children with incremental delay */
export function StaggerReveal({
  children,
  className = "",
  baseDelay = 0,
  stagger = 80,
  direction = "up" as ScrollRevealProps["direction"],
}: {
  children: ReactNode[];
  className?: string;
  baseDelay?: number;
  stagger?: number;
  direction?: ScrollRevealProps["direction"];
}) {
  return (
    <>
      {children.map((child, i) => (
        <ScrollReveal
          key={i}
          delay={baseDelay + i * stagger}
          direction={direction}
          className={className}
        >
          {child}
        </ScrollReveal>
      ))}
    </>
  );
}
