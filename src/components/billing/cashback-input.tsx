"use client";

import { useState, useEffect } from "react";
import { Wallet } from "lucide-react";
import { clampCashbackCents } from "@/lib/billing/cashback-utils";

type Props = {
  activeCents: number;
  grossCents: number;
  onChange: (cashbackCents: number) => void;
};

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

/**
 * Slider para o user aplicar cashback no checkout.
 * Limite: min(50% do gross, saldo ativo).
 */
export default function CashbackInput({ activeCents, grossCents, onChange }: Props) {
  const max = clampCashbackCents({ requested: activeCents, gross: grossCents, activeBalance: activeCents });
  const [used, setUsed] = useState(0);

  useEffect(() => {
    // Se gross mudou (ex: shipping recalculado), re-clamp
    const next = Math.min(used, max);
    if (next !== used) {
      setUsed(next);
      onChange(next);
    }
  }, [max, used, onChange]);

  if (activeCents <= 0 || max <= 0) return null;

  return (
    <div className="rounded-[14px] border border-gray-4 bg-bg-1 p-4 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-gray-2">
          <Wallet size={14} className="text-pink" />
          Cashback disponível
        </span>
        <span className="text-pink font-mono">{formatBRL(activeCents)}</span>
      </div>

      <label className="block">
        <span className="text-xs text-gray-3">
          Aplicar (até {formatBRL(max)})
        </span>
        <input
          type="range"
          min={0}
          max={max}
          step={100}
          value={used}
          onChange={(e) => {
            const v = Number(e.target.value);
            setUsed(v);
            onChange(v);
          }}
          className="w-full mt-1 accent-pink"
        />
        <div className="flex items-center justify-between text-xs text-gray-2 mt-1">
          <span>Você usa {formatBRL(used)}</span>
          <span>Paga {formatBRL(grossCents - used)}</span>
        </div>
      </label>
    </div>
  );
}
