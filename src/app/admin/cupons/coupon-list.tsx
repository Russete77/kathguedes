"use client";

import { toggleCouponActive, deleteCoupon } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Coupon {
  id: string;
  title: string;
  code: string;
  discount_pct: number | null;
  partner_name: string;
  module: string;
  required_plan: string;
  uses_count: number;
  max_uses: number | null;
  valid_until: string;
  is_flash: boolean;
  is_active: boolean;
}

export function CouponList({ coupons }: { coupons: Coupon[] }) {
  if (!coupons.length) {
    return (
      <div className="text-center py-16">
        <Tag size={48} className="stroke-gray-3 mx-auto mb-4" />
        <p className="text-gray-2">Nenhum cupom criado ainda.</p>
      </div>
    );
  }

  const isExpired = (date: string) => new Date(date) < new Date();

  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-4 hover:bg-transparent">
            <TableHead className="text-gray-2">Cupom</TableHead>
            <TableHead className="text-gray-2">Código</TableHead>
            <TableHead className="text-gray-2">Parceiro</TableHead>
            <TableHead className="text-gray-2">Módulo</TableHead>
            <TableHead className="text-gray-2">Plano</TableHead>
            <TableHead className="text-gray-2 text-right">Usos</TableHead>
            <TableHead className="text-gray-2">Status</TableHead>
            <TableHead className="text-gray-2 text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {coupons.map((c) => {
            const expired = isExpired(c.valid_until);
            return (
              <TableRow key={c.id} className="border-gray-4">
                <TableCell className="text-white text-sm font-medium">
                  {c.title}
                  {c.discount_pct && (
                    <span className="text-pink ml-2">-{c.discount_pct}%</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm text-pink bg-pink-dim px-2 py-1 rounded-[8px] border border-pink/20">
                    {c.code}
                  </span>
                </TableCell>
                <TableCell className="text-gray-2 text-sm">
                  {c.partner_name}
                </TableCell>
                <TableCell>
                  <Badge variant="white">{c.module.toUpperCase()}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={c.required_plan === "free" ? "dark" : "pink"}>
                    {c.required_plan.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-gray-2">
                  {c.uses_count}
                  {c.max_uses && `/${c.max_uses}`}
                </TableCell>
                <TableCell>
                  {expired ? (
                    <Badge variant="dark">Expirado</Badge>
                  ) : c.is_active ? (
                    <Badge variant="green">Ativo</Badge>
                  ) : (
                    <Badge variant="dark">Inativo</Badge>
                  )}
                  {c.is_flash && <Badge variant="yellow" className="ml-1">Flash</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="icon"
                      size="icon"
                      className="w-8 h-8"
                      onClick={() => toggleCouponActive(c.id, !c.is_active)}
                      title={c.is_active ? "Desativar" : "Ativar"}
                    >
                      {c.is_active ? (
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
                        if (confirm("Excluir este cupom?")) deleteCoupon(c.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
