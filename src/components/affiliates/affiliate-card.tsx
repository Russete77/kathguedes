"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface AffiliateCardProps {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  category: string;
  platform: string;
  affiliate_url: string;
  required_plan: string;
  clicks_count: number;
}

const platformLabels: Record<string, string> = {
  amazon: "Amazon BR",
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
  direto: "Parceiro",
};

export function AffiliateCard({
  id,
  title,
  description,
  image_url,
  category,
  platform,
  affiliate_url,
  clicks_count,
}: AffiliateCardProps) {
  async function handleClick() {
    fetch("/api/affiliate/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId: id }),
    }).catch(() => {});

    window.open(affiliate_url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[22px] overflow-hidden transition-all duration-200 hover:border-pink/40 hover:-translate-y-0.5 group">
      <div className="h-[200px] bg-bg-2 relative overflow-hidden">
        <Image
          src={image_url}
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-3 left-3">
          <Badge variant="pink">{category.toUpperCase()}</Badge>
        </div>
      </div>

      <div className="p-5">
        <div className="font-mono text-[11px] text-gray-3 uppercase tracking-[0.1em] mb-1">
          {platformLabels[platform] || platform}
        </div>
        <h3 className="font-bold text-[16px] text-white mb-1 line-clamp-2">
          {title}
        </h3>
        {description && (
          <p className="text-[13px] text-gray-2 leading-relaxed mb-3 line-clamp-2">
            {description}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-gray-3">
            {clicks_count} cliques
          </span>
          <Button size="sm" onClick={handleClick}>
            <ExternalLink size={14} />
            Ver Produto
          </Button>
        </div>
      </div>
    </div>
  );
}
