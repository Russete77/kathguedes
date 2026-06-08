"use client";

import { Countdown } from "@/components/ui/countdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

interface CouponCardProps {
  id: string;
  title: string;
  code: string;
  discount_pct: number | null;
  partner_name: string;
  partner_url: string;
  valid_until: string;
  is_flash: boolean;
  module: string;
}

export function CouponCard({
  id,
  title,
  code,
  discount_pct,
  partner_name,
  partner_url,
  valid_until,
  is_flash,
  module,
}: CouponCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    fetch("/api/coupon/use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ couponId: id }),
    }).catch(() => {});

    toast.success("Código copiado!", {
      description: `${code} — cole no site do parceiro`,
      style: { borderLeft: "3px solid #00FF88" },
    });
  }

  function handleVisit() {
    window.open(partner_url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className={cn(
        "bg-bg-1 rounded-[22px] p-5 relative overflow-hidden",
        "before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5",
        "before:bg-gradient-to-r before:from-pink before:to-pink-light before:to-60%",
        is_flash
          ? "border border-dashed border-yellow/40"
          : "border border-dashed border-pink/40"
      )}
    >
      {is_flash && (
        <Badge variant="yellow" className="absolute top-3 right-3">
          FLASH
        </Badge>
      )}

      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <div className="font-mono text-[11px] text-gray-3 uppercase tracking-[0.1em] mb-1">
            {partner_name}
          </div>
          <div
            className={cn(
              "font-display text-[36px] leading-none mb-1",
              is_flash ? "text-yellow" : "text-white"
            )}
          >
            {discount_pct ? `${discount_pct}% OFF` : "DESCONTO"}
          </div>
          <div className="text-[13px] text-gray-2 mb-3">{title}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-3">
            <Clock size={12} className="stroke-gray-3" />
            Expira em{" "}
            <Countdown
              expiresAt={new Date(valid_until)}
              className={is_flash ? "text-danger" : "text-yellow"}
            />
          </div>
          <Badge variant="white" className="mt-2">
            {module.toUpperCase()}
          </Badge>
        </div>

        <div className="text-center shrink-0">
          <div
            className={cn(
              "font-mono text-[16px] font-medium px-4 py-2 rounded-[8px] border",
              "bg-bg-3 tracking-[0.08em]",
              is_flash
                ? "text-yellow border-yellow/25"
                : "text-pink border-pink/25"
            )}
          >
            {code}
          </div>
          <Button
            size="sm"
            className="mt-3 w-full"
            onClick={handleCopy}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copiado!" : "Copiar"}
          </Button>
          <button
            onClick={handleVisit}
            className="mt-2 text-[11px] text-gray-3 hover:text-pink underline-offset-2 hover:underline transition-colors"
          >
            Ir para a loja
          </button>
        </div>
      </div>
    </div>
  );
}
