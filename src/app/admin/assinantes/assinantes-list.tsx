"use client";

import { useState, useTransition, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Users, Search, Save, Loader2, Power, PowerOff } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { setAssinantePlan, setSubscriptionStatus } from "./actions";
import type { PlanTier } from "@/lib/supabase/types";

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

const TIER_OPTIONS: { value: PlanTier; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "acesso", label: "Acesso · R$19,90" },
  { value: "plano1", label: "Plano 1 · R$39,90" },
  { value: "plano2", label: "Plano 2 · R$74,90" },
  { value: "plano3", label: "Plano 3 · R$99,90" },
  { value: "atleta", label: "Atleta · R$309,90" },
];

const planBadgeVariant: Record<string, "dark" | "white" | "pink" | "yellow" | "green"> = {
  free: "dark",
  acesso: "white",
  plano1: "white",
  plano2: "pink",
  plano3: "pink",
  atleta: "yellow",
};

const statusBadgeVariant: Record<string, "green" | "yellow" | "dark"> = {
  active: "green",
  past_due: "yellow",
  canceled: "dark",
};

const statusLabel: Record<string, string> = {
  active: "Ativo",
  past_due: "Atrasado",
  canceled: "Cancelado",
};

const FILTER_TIERS: ("all" | PlanTier)[] = [
  "all", "free", "acesso", "plano1", "plano2", "plano3", "atleta",
];

export function AssinantesList({ profiles }: { profiles: Profile[] }) {
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<"all" | PlanTier>("all");
  const [selectedTier, setSelectedTier] = useState<Record<string, PlanTier>>({});
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingKind, setPendingKind] = useState<"tier" | "status" | null>(null);

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      const matchSearch =
        !search ||
        p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase());
      const matchPlan = filterPlan === "all" || p.plan_tier === filterPlan;
      return matchSearch && matchPlan;
    });
  }, [profiles, search, filterPlan]);

  // Contadores por tier ativo (todos os 6 slugs)
  const counts = useMemo(() => {
    const base: Record<string, number> = {
      total: profiles.length,
      free: 0, acesso: 0, plano1: 0, plano2: 0, plano3: 0, atleta: 0,
    };
    for (const p of profiles) {
      if (p.plan_tier in base) base[p.plan_tier]++;
    }
    return base;
  }, [profiles]);

  function applyTier(user: Profile) {
    const tier = selectedTier[user.id] ?? (user.plan_tier as PlanTier);
    if (tier === user.plan_tier) {
      toast.message("Esse já é o plano atual");
      return;
    }
    const label = user.full_name || user.id.slice(0, 10);
    if (!confirm(`Mudar ${label} de "${user.plan_tier}" para "${tier}"?`)) return;

    setPendingId(user.id);
    setPendingKind("tier");
    startTransition(async () => {
      try {
        const res = await setAssinantePlan({ user_id: user.id, tier });
        toast.success(`Plano alterado: ${res.previousTier ?? "—"} → ${res.newTier}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      } finally {
        setPendingId(null);
        setPendingKind(null);
      }
    });
  }

  function toggleStatus(user: Profile) {
    const next = user.subscription_status === "active" ? "canceled" : "active";
    const verb = next === "active" ? "ATIVAR" : "DESATIVAR";
    const label = user.full_name || user.id.slice(0, 10);
    if (!confirm(`${verb} a assinatura de ${label}?`)) return;

    setPendingId(user.id);
    setPendingKind("status");
    startTransition(async () => {
      try {
        const res = await setSubscriptionStatus({ user_id: user.id, status: next });
        toast.success(`Status: ${res.previousStatus ?? "—"} → ${next}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      } finally {
        setPendingId(null);
        setPendingKind(null);
      }
    });
  }

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
      <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-white" },
          { label: "Free", value: counts.free, color: "text-gray-2" },
          { label: "Acesso", value: counts.acesso, color: "text-info" },
          { label: "Plano 1", value: counts.plano1, color: "text-info" },
          { label: "Plano 2", value: counts.plano2, color: "text-pink" },
          { label: "Plano 3", value: counts.plano3, color: "text-pink" },
          { label: "Atleta", value: counts.atleta, color: "text-yellow" },
        ].map((s) => (
          <div key={s.label} className="bg-bg-1 border border-gray-4 rounded-[14px] p-3 text-center">
            <div className={`font-display text-[24px] leading-none ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-gray-3 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 stroke-gray-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou ID..."
            className="w-full bg-bg-1 border border-gray-4 rounded-[8px] text-white text-[14px] pl-10 pr-4 py-2.5 outline-none focus:border-pink placeholder:text-gray-3"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TIERS.map((plan) => (
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

      {/* Table (desktop) */}
      <div className="hidden md:block bg-bg-1 border border-gray-4 rounded-[14px] overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-4 hover:bg-transparent">
              <TableHead className="text-gray-2">Nome</TableHead>
              <TableHead className="text-gray-2">Plano atual</TableHead>
              <TableHead className="text-gray-2">Status</TableHead>
              <TableHead className="text-gray-2">Streak</TableHead>
              <TableHead className="text-gray-2">Vencimento</TableHead>
              <TableHead className="text-gray-2">Mudar plano</TableHead>
              <TableHead className="text-gray-2">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => {
              const isBusy = pending && pendingId === p.id;
              const isActive = p.subscription_status === "active";
              const targetTier = (selectedTier[p.id] ?? p.plan_tier) as PlanTier;
              const tierChanged = targetTier !== p.plan_tier;
              return (
                <TableRow key={p.id} className="border-gray-4">
                  <TableCell>
                    <div className="text-white text-sm font-medium truncate max-w-[200px]">
                      {p.full_name || "—"}
                    </div>
                    <div className="font-mono text-[10px] text-gray-3 truncate max-w-[200px]">
                      {p.id}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={planBadgeVariant[p.plan_tier] || "dark"}>
                      {p.plan_tier.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant[p.subscription_status] || "dark"}>
                      {statusLabel[p.subscription_status] || p.subscription_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-pink">{p.workout_streak}</span>
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-gray-2">
                    {p.subscription_ends_at
                      ? new Date(p.subscription_ends_at).toLocaleDateString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={targetTier}
                        onChange={(e) =>
                          setSelectedTier({ ...selectedTier, [p.id]: e.target.value as PlanTier })
                        }
                        disabled={isBusy}
                        className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[12px] px-2 py-1.5 outline-none focus:border-pink disabled:opacity-50"
                      >
                        {TIER_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => applyTier(p)}
                        disabled={isBusy || !tierChanged}
                        title="Aplicar novo plano"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold bg-pink text-white hover:bg-pink-light disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        {isBusy && pendingKind === "tier" ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Save size={12} />
                        )}
                        Aplicar
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleStatus(p)}
                      disabled={isBusy}
                      title={isActive ? "Desativar assinatura" : "Ativar assinatura"}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11px] font-semibold border transition-all disabled:opacity-50 ${
                        isActive
                          ? "border-gray-4 text-gray-1 hover:border-danger hover:text-danger"
                          : "border-success/40 text-success hover:bg-success/10"
                      }`}
                    >
                      {isBusy && pendingKind === "status" ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : isActive ? (
                        <PowerOff size={12} />
                      ) : (
                        <Power size={12} />
                      )}
                      {isActive ? "Desativar" : "Ativar"}
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Cards (mobile) */}
      <div className="md:hidden space-y-3">
        {filtered.map((p) => {
          const isBusy = pending && pendingId === p.id;
          const isActive = p.subscription_status === "active";
          const targetTier = (selectedTier[p.id] ?? p.plan_tier) as PlanTier;
          const tierChanged = targetTier !== p.plan_tier;
          return (
            <div
              key={p.id}
              className="bg-bg-1 border border-gray-4 rounded-[18px] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-white font-semibold truncate">
                    {p.full_name || "—"}
                  </div>
                  <div className="text-[10px] text-gray-3 font-mono truncate">
                    {p.id}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={planBadgeVariant[p.plan_tier] || "dark"}>
                    {p.plan_tier.toUpperCase()}
                  </Badge>
                  <Badge variant={statusBadgeVariant[p.subscription_status] || "dark"}>
                    {statusLabel[p.subscription_status] || p.subscription_status}
                  </Badge>
                </div>
              </div>

              <div className="flex gap-2">
                <select
                  value={targetTier}
                  onChange={(e) =>
                    setSelectedTier({ ...selectedTier, [p.id]: e.target.value as PlanTier })
                  }
                  disabled={isBusy}
                  className="flex-1 bg-bg-2 border border-gray-4 rounded-[8px] text-white text-sm px-2 py-2 outline-none focus:border-pink"
                >
                  {TIER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => applyTier(p)}
                  disabled={isBusy || !tierChanged}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-[12px] font-semibold bg-pink text-white hover:bg-pink-light disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isBusy && pendingKind === "tier" ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Save size={12} />
                  )}
                  Aplicar
                </button>
              </div>

              <button
                type="button"
                onClick={() => toggleStatus(p)}
                disabled={isBusy}
                className={`w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-[8px] text-[12px] font-semibold border transition-all disabled:opacity-50 ${
                  isActive
                    ? "border-gray-4 text-gray-1 hover:border-danger hover:text-danger"
                    : "border-success/40 text-success hover:bg-success/10"
                }`}
              >
                {isBusy && pendingKind === "status" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : isActive ? (
                  <PowerOff size={12} />
                ) : (
                  <Power size={12} />
                )}
                {isActive ? "Desativar assinatura" : "Ativar assinatura"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="text-center">
        <span className="font-mono text-[11px] text-gray-3">
          Mostrando {filtered.length} de {profiles.length} assinantes
        </span>
      </div>
    </div>
  );
}
