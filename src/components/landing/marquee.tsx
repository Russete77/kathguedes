"use client";

interface MarqueeProps {
  items: string[];
  speed?: number;
  separator?: string;
  className?: string;
  itemClassName?: string;
}

export function Marquee({
  items,
  speed = 30,
  separator = "·",
  className = "",
  itemClassName = "",
}: MarqueeProps) {
  const content = items.join(` ${separator} `) + ` ${separator} `;

  return (
    <div className={`overflow-hidden whitespace-nowrap ${className}`}>
      <div
        className="inline-flex animate-marquee"
        style={{ animationDuration: `${speed}s` }}
      >
        <span className={`inline-block pr-4 ${itemClassName}`}>{content}</span>
        <span className={`inline-block pr-4 ${itemClassName}`}>{content}</span>
        <span className={`inline-block pr-4 ${itemClassName}`}>{content}</span>
      </div>
    </div>
  );
}
