"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

/**
 * Calendar shadcn-style adaptado ao tema dark/neon do KathApp.
 * Wrapper sobre react-day-picker v10 com locale pt-BR.
 *
 * O tipo das props é inferido direto do DayPicker — em v10 ele é uma
 * union discriminada por `mode` (single/multiple/range/default), e
 * fixar manualmente uma versão omitiria as variantes válidas.
 */
export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        // DayPicker v10 (default navLayout): <Nav> renderiza como FILHO de .months
        // e IRMAO de .month — NAO dentro de .month. Por isso `relative` precisa
        // estar em .months pra ancorar as setinhas. Com `relative` em .month as
        // setinhas escapam pelo proximo ancestor positionado (modal/body) e
        // aparecem no topo da pagina.
        months: "relative flex flex-col sm:flex-row gap-4",
        month: "space-y-3",
        month_caption: "flex justify-center pt-1 items-center",
        caption_label: "text-sm font-semibold text-white",
        // Nav sobrepoe a caption: linha do topo do mes, prev/next nos cantos,
        // pointer-events-none deixa o meio passar pra label centralizada.
        nav: "absolute top-0 inset-x-1 flex items-center justify-between pointer-events-none z-10",
        button_previous: cn(
          "inline-flex items-center justify-center rounded-md p-1.5",
          "text-gray-2 hover:text-pink hover:bg-bg-2 transition-colors",
          "pointer-events-auto",
        ),
        button_next: cn(
          "inline-flex items-center justify-center rounded-md p-1.5",
          "text-gray-2 hover:text-pink hover:bg-bg-2 transition-colors",
          "pointer-events-auto",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-gray-3 rounded-md w-9 font-mono text-[10px] uppercase tracking-wider",
        week: "flex w-full mt-1",
        day: cn(
          "h-9 w-9 text-center text-sm p-0 relative",
          "rounded-md transition-colors",
        ),
        day_button: cn(
          "h-9 w-9 inline-flex items-center justify-center rounded-md",
          "text-white hover:bg-pink/20 hover:text-pink transition-colors",
          "aria-selected:bg-pink aria-selected:text-white",
          "data-[disabled]:text-gray-3 data-[disabled]:opacity-30 data-[disabled]:hover:bg-transparent",
        ),
        selected: "bg-pink text-white rounded-md shadow-pink",
        today: "ring-1 ring-pink/40 rounded-md",
        outside: "text-gray-3 opacity-50",
        disabled: "text-gray-3 opacity-30 pointer-events-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) => {
          if (orientation === "left") return <ChevronLeft size={16} {...rest} />;
          return <ChevronRight size={16} {...rest} />;
        },
      }}
      {...props}
    />
  );
}
