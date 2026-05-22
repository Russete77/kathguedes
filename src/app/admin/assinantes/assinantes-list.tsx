"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Users, Search } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Profile {
  id: string;
  full_name: string;
  plan_tier: string;
  subscription_status: string;
  subscription_ends_at: string | null;
  workout_streak: number;
  phone: string | null;
  created_at: string;
}

const planBadge: Record<string, "dark" | "white" | "pink" | "yellow"> = {
  free: "dark",
  start: "white",
  pro: "pink",
  vip: "yellow",
};

const statusBadge: Record<string, "green" | "yellow" | "dark"> = {
  active: "green",
  past_due: "yellow",
  canceled: "dark",
};

export function AssinantesList({ profiles }: { profiles: Profile[] }) {
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");

  const filtered = profiles.filter((p) => {
    const matchSearch =
      !search ||
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.id.includes(search);
    const matchPlan = filterPlan === "all" || p.plan_tier === filterPlan;
    return matchSearch && matchPlan;
  });

  // Contadores
  const counts = { free: 0, start: 0, pro: 0, vip: 0, total: profiles.length };
  profiles.forEach((p) => {
    const tier = p.plan_tier as keyof typeof counts;
    if (tier in counts) (counts as Record<string, number>)[tier]++;
  });

  if (!profiles.length) {
    return (
      <div className="text-center py-16">
        <Users size={48} className="stroke-gray-3 mx-auto mb-4" />
        <p className="text-gray-2">Nenhum assinante ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-white" },
          { label: "Free", value: counts.free, color: "text-gray-2" },
          { label: "Start", value: counts.start, color: "text-info" },
          { label: "Pro", value: counts.pro, color: "text-pink" },
          { label: "VIP", value: counts.vip, color: "text-yellow" },
        ].map((s) => (
          <div key={s.label} className="bg-bg-1 border border-gray-4 rounded-[14px] p-3 text-center">
            <div className={`font-display text-[28px] leading-none ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-gray-3 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 stroke-gray-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou ID..."
            className="w-full bg-bg-1 border border-gray-4 rounded-[8px] text-white text-[14px] pl-10 pr-4 py-2.5 outline-none focus:border-pink placeholder:text-gray-3"
          />
        </div>
        <div className="flex gap-1.5">
          {["all", "free", "acesso", "plano1", "plano2", "plano3", "atleta"].map((plan) => (
            <button
              key={plan}
              onClick={() => setFilterPlan(plan)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.06em] transition-all border ${
                filterPlan === plan
                  ? "bg-pink text-white border-pink"
                  : "bg-bg-1 text-gray-3 border-gray-4 hover:text-white"
              }`}
            >
              {plan === "all" ? "Todos" : plan}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-4 hover:bg-transparent">
              <TableHead className="text-gray-2">Nome</TableHead>
              <TableHead className="text-gray-2">Plano</TableHead>
              <TableHead className="text-gray-2">Status</TableHead>
              <TableHead className="text-gray-2">Streak</TableHead>
              <TableHead className="text-gray-2">Telefone</TableHead>
              <TableHead className="text-gray-2">Vencimento</TableHead>
              <TableHead className="text-gray-2">Cadastro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id} className="border-gray-4">
                <TableCell>
                  <div className="text-white text-sm font-medium">{p.full_name || "—"}</div>
                  <div className="font-mono text-[10px] text-gray-3">{p.id.slice(0, 20)}...</div>
                </TableCell>
                <TableCell>
                  <Badge variant={planBadge[p.plan_tier] || "dark"}>
                    {p.plan_tier.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadge[p.subscription_status] || "dark"}>
                    {p.subscription_status === "active" ? "Ativo" : p.subscription_status === "past_due" ? "Atrasado" : "Cancelado"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm text-pink">{p.workout_streak}</span>
                </TableCell>
                <TableCell className="font-mono text-[12px] text-gray-2">
                  {p.phone || "—"}
                </TableCell>
                <TableCell className="font-mono text-[12px] text-gray-2">
                  {p.subscription_ends_at
                    ? new Date(p.subscription_ends_at).toLocaleDateString("pt-BR")
                    : "—"}
                </TableCell>
                <TableCell className="font-mono text-[12px] text-gray-3">
                  {new Date(p.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-center">
        <span className="font-mono text-[11px] text-gray-3">
          Mostrando {filtered.length} de {profiles.length} assinantes
        </span>
      </div>
    </div>
  );
}
