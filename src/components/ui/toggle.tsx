"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ToggleProps {
  defaultChecked?: boolean;
  label: string;
  onChange?: (checked: boolean) => void;
}

export function Toggle({
  defaultChecked = false,
  label,
  onChange,
}: ToggleProps) {
  const [on, setOn] = useState(defaultChecked);

  const handleToggle = () => {
    const next = !on;
    setOn(next);
    onChange?.(next);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        role="switch"
        aria-checked={on}
        onClick={handleToggle}
        className={cn(
          "w-12 h-[26px] rounded-full relative transition-colors duration-200",
          on ? "bg-pink" : "bg-gray-4"
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full transition-transform duration-200",
            on && "translate-x-[22px]"
          )}
        />
      </button>
      <span className="text-[14px] text-gray-1">{label}</span>
    </div>
  );
}
