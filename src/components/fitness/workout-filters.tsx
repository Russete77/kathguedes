"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const categories = [
  { value: "", label: "Todos" },
  { value: "gluteo", label: "Glúteos" },
  { value: "pernas", label: "Pernas" },
  { value: "superior", label: "Superior" },
  { value: "hiit", label: "HIIT" },
  { value: "full", label: "Completo" },
  { value: "viagem", label: "Viagem" },
];

const levels = [
  { value: "", label: "Todos" },
  { value: "iniciante", label: "Iniciante" },
  { value: "intermediario", label: "Intermediário" },
  { value: "avancado", label: "Avançado" },
];

export function WorkoutFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("cat") || "";
  const activeLevel = searchParams.get("lvl") || "";

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/fitness?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setFilter("cat", cat.value)}
            className={cn(
              "px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-150",
              activeCategory === cat.value
                ? "bg-pink text-white"
                : "bg-bg-1 text-gray-2 border border-gray-4 hover:border-pink/40 hover:text-white"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Levels */}
      <div className="flex flex-wrap gap-2">
        {levels.map((lvl) => (
          <button
            key={lvl.value}
            onClick={() => setFilter("lvl", lvl.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[11px] font-medium tracking-[0.06em] uppercase transition-all duration-150",
              activeLevel === lvl.value
                ? "bg-pink-dim text-pink border border-pink/25"
                : "bg-bg-2 text-gray-3 border border-gray-4 hover:text-gray-1"
            )}
          >
            {lvl.label}
          </button>
        ))}
      </div>
    </div>
  );
}
