"use client";

import { useEffect, useState } from "react";
import { CalendarDays, List } from "lucide-react";
import { BookingsKanban } from "./bookings-kanban";
import { BookingsCalendar } from "./bookings-calendar";
import type { BookingRow } from "./page";

type Mode = "list" | "calendar";
const STORAGE_KEY = "kath-bookings-view-mode";

export function BookingsViewSwitcher({ bookings }: { bookings: BookingRow[] }) {
  const [mode, setMode] = useState<Mode>("list");
  const [hydrated, setHydrated] = useState(false);

  // Carrega preferência salva (SSR-safe)
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved === "list" || saved === "calendar") setMode(saved);
    setHydrated(true);
  }, []);

  function changeMode(next: Mode) {
    setMode(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div
        role="tablist"
        aria-label="Modo de visualização"
        className="inline-flex bg-bg-1 border border-gray-4 rounded-full p-0.5 self-start"
      >
        <ToggleButton
          active={mode === "list"}
          onClick={() => changeMode("list")}
          icon={<List size={14} />}
          label="Lista"
        />
        <ToggleButton
          active={mode === "calendar"}
          onClick={() => changeMode("calendar")}
          icon={<CalendarDays size={14} />}
          label="Calendário"
        />
      </div>

      {/* Aguarda hydration para evitar flash do modo errado */}
      {hydrated ? (
        mode === "list" ? (
          <BookingsKanban bookings={bookings} />
        ) : (
          <BookingsCalendar bookings={bookings} />
        )
      ) : (
        <BookingsKanban bookings={bookings} />
      )}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
        active
          ? "bg-pink text-white shadow-pink"
          : "text-gray-2 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
