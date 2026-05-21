"use client";

import { toggleAffiliateActive, deleteAffiliateLink } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, ToggleLeft, ToggleRight, ShoppingBag, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AffiliateLink {
  id: string;
  title: string;
  image_url: string;
  module: string;
  category: string;
  platform: string;
  affiliate_url: string;
  required_plan: string;
  clicks_count: number;
  is_active: boolean;
}

const platformLabels: Record<string, string> = {
  amazon: "Amazon",
  mercadolivre: "ML",
  shopee: "Shopee",
  direto: "Direto",
};

export function AffiliateList({ links }: { links: AffiliateLink[] }) {
  if (!links.length) {
    return (
      <div className="text-center py-16">
        <ShoppingBag size={48} className="stroke-gray-3 mx-auto mb-4" />
        <p className="text-gray-2">Nenhum produto afiliado cadastrado.</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-4 hover:bg-transparent">
            <TableHead className="text-gray-2">Produto</TableHead>
            <TableHead className="text-gray-2">Módulo</TableHead>
            <TableHead className="text-gray-2">Plataforma</TableHead>
            <TableHead className="text-gray-2">Plano</TableHead>
            <TableHead className="text-gray-2 text-right">Cliques</TableHead>
            <TableHead className="text-gray-2 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((l) => (
            <TableRow key={l.id} className="border-gray-4">
              <TableCell>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-[8px] bg-bg-2 bg-cover bg-center shrink-0 border border-gray-4"
                    style={{ backgroundImage: `url(${l.image_url})` }}
                  />
                  <div>
                    <div className="font-semibold text-white text-sm">
                      {l.title}
                    </div>
                    <div className="text-[11px] text-gray-3">{l.category}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={l.module === "fitness" ? "pink" : "white"}>
                  {l.module.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell className="text-gray-2 text-sm">
                {platformLabels[l.platform] || l.platform}
              </TableCell>
              <TableCell>
                <Badge variant={l.required_plan === "free" ? "dark" : "pink"}>
                  {l.required_plan.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-sm text-pink">
                {l.clicks_count}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <a
                    href={l.affiliate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-bg-2 border border-gray-4 hover:border-pink text-gray-2 hover:text-pink transition-all"
                  >
                    <ExternalLink size={14} />
                  </a>
                  <Button
                    variant="icon"
                    size="icon"
                    className="w-8 h-8"
                    onClick={() => toggleAffiliateActive(l.id, !l.is_active)}
                    title={l.is_active ? "Desativar" : "Ativar"}
                  >
                    {l.is_active ? (
                      <ToggleRight size={16} className="text-success" />
                    ) : (
                      <ToggleLeft size={16} />
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-8 h-8 px-0 rounded-full"
                    onClick={() => {
                      if (confirm("Excluir este produto afiliado?")) deleteAffiliateLink(l.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
