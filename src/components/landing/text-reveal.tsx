"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface TextRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** "slide" = translate Y 110% clip reveal, "rotate" = 3D perspective rotate */
  variant?: "slide" | "rotate" | "fade-y";
}

export function TextReveal({
  children,
  className = "",
  delay = 0,
  variant = "slide",
}: TextRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.animationDelay = `${delay}ms`;
          el.classList.add("tr-visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -30px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  const variantClass =
    variant === "slide"
      ? "tr-slide"
      : variant === "rotate"
        ? "tr-rotate"
        : "tr-fade-y";

  return (
    <div ref={ref} className={`tr-hidden ${variantClass} ${className}`}>
      {children}
    </div>
  );
}

/** Split text into individual lines/words for stagger animation */
export function SplitTextReveal({
  text,
  className = "",
  wordClassName = "",
  baseDelay = 0,
  stagger = 60,
  variant = "slide",
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  baseDelay?: number;
  stagger?: number;
  variant?: TextRevealProps["variant"];
}) {
  return (
    <span className={`inline-flex flex-wrap gap-x-[0.25em] ${className}`}>
      {text.split(" ").map((word, i) => (
        <span key={i} className="overflow-hidden inline-block">
          <TextReveal delay={baseDelay + i * stagger} variant={variant}>
            <span className={`inline-block ${wordClassName}`}>{word}</span>
          </TextReveal>
        </span>
      ))}
    </span>
  );
}
