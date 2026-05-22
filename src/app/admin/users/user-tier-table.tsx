"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save, Search, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { setTestUserTier } from "./actions";
import type { PlanTier } from "@/lib/supabase/types";

interface UserRow {
  id: string;
  full_name: string | null;
  plan_tier: string | null;
  subscription_status: string | null;
  onboarding_completed: boolean | null;
  created_at: string;
  asaas_customer_id: string | null;
}

const TIER_OPTIONS: { value: PlanTier; label: string; level: number }[] = [
  { value: "free", label: "Free", level: 0 },
  { value: "acesso", label: "Acesso · R$19,90", level: 1 },
  { value: "plano1", label: "Plano 1 · Treino · R$39,90", level: 2 },
  { value: "plano2", label: "Plano 2 · Treino+Dieta · R$74,90", level: 3 },
  { value: "plano3", label: "Plano 3 · Saúde · R$99,90", level: 4 },
  { value: "atleta", label: "Atleta · R$309,90", level: 5 },
];

const TIER_COLOR: Record<string, string> = {
  free: "bg-gray-4/40 text-gray-2 border-gray-4",
  acesso: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  plano1: "bg-green-500/15 text-green-300 border-green-500/30",
  plano2: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  plano3: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  atleta: "bg-pink/15 text-pink border-pink/30",
};

export function UserTierTable({ users }: { users: UserRow[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<Record<string, PlanTier>>({});

  const filtered = useMemo(() => {
    if (!query.trim()) return users;
    const q = query.toLowerCase();
    return users.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        (u.plan_tier ?? "").toLowerCase().includes(q),
    );
  }, [users, query]);

  function handleApply(user: UserRow) {
    const tier = selectedTier[user.id] ?? user.plan_tier ?? "free";
    if (tier === user.plan_tier) {
      toast.message("Esse já é o tier atual");
      return;
    }
    const confirmText = `Mudar ${user.full_name ?? user.id} de "${user.plan_tier ?? "—"}" para "${tier}"?`;
    if (!confirm(confirmText)) return;

    setPendingId(user.id);
    startTransition(async () => {
      try {
        const res = await setTestUserTier({ user_id: user.id, tier: tier as PlanTier });
        toast.success(`Tier alterado: ${res.previousTier ?? "—"} → ${res.newTier}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, id ou tier…"
          className="w-full bg-bg-2 border border-gray-4 rounded-[10px] text-white text-sm pl-9 pr-3 py-2 outline-none focus:border-pink placeholder:text-gray-3"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-bg-1 border border-gray-4 rounded-[18px]">
          <p className="text-gray-2 text-sm">Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <>
          {/* MOBILE: cards */}
          <div className="sm:hidden space-y-3">
            {filtered.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                selectedTier={selectedTier[u.id] ?? (u.plan_tier as PlanTier) ?? "free"}
                onChangeTier={(t) => setSelectedTier({ ...selectedTier, [u.id]: t })}
                onApply={() => handleApply(u)}
                applying={pending && pendingId === u.id}
              />
            ))}
          </div>

          {/* DESKTOP: tabela */}
          <div className="hidden sm:block bg-bg-1 border border-gray-4 rounded-[18px] overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-bg-2">
                <tr className="text-left">
                  <th className="px-4 py-3 font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">Nome</th>
                  <th className="px-4 py-3 font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">User ID</th>
                  <th className="px-4 py-3 font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">Tier atual</th>
                  <th className="px-4 py-3 font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">Asaas</th>
                  <th className="px-4 py-3 font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">Novo tier</th>
                  <th className="px-4 py-3 w-0" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const current = u.plan_tier ?? "free";
                  const isPending = pending && pendingId === u.id;
                  return (
                    <tr key={u.id} className="border-t border-gray-4">
                      <td className="px-4 py-3 text-white font-semibold truncate max-w-[180px]">
                        {u.full_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-3 font-mono text-[11px] truncate max-w-[180px]">
                        {u.id}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] uppercase tracking-wider border rounded-full px-2 py-0.5 ${TIER_COLOR[current] ?? TIER_COLOR.free}`}>
                          {current}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.asaas_customer_id ? (
                          <Badge variant="white" className="gap-1 text-[10px]">
                            <Crown size={10} /> sim
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-gray-3">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={selectedTier[u.id] ?? current}
                          onChange={(e) =>
                            setSelectedTier({ ...selectedTier, [u.id]: e.target.value as PlanTier })
                          }
                          className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[12px] px-2 py-1.5 outline-none focus:border-pink"
                        >
                          {TIER_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleApply(u)}
                          disabled={isPending || (selectedTier[u.id] ?? current) === current}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-semibold bg-pink text-white hover:bg-pink-light disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          {isPending ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Save size={12} />
                          )}
                          Aplicar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function UserCard({
  user,
  selectedTier,
  onChangeTier,
  onApply,
  applying,
}: {
  user: UserRow;
  selectedTier: PlanTier;
  onChangeTier: (t: PlanTier) => void;
  onApply: () => void;
  applying: boolean;
}) {
  const current = user.plan_tier ?? "free";
  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[18px] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-white font-semibold truncate">
            {user.full_name ?? "—"}
          </div>
          <div className="text-[10px] text-gray-3 font-mono truncate">
            {user.id}
          </div>
        </div>
        <span className={`text-[10px] uppercase tracking-wider border rounded-full px-2 py-0.5 ${TIER_COLOR[current] ?? TIER_COLOR.free}`}>
          {current}
        </span>
      </div>

      <select
        value={selectedTier}
        onChange={(e) => onChangeTier(e.target.value as PlanTier)}
        className="w-full bg-bg-2 border border-gray-4 rounded-[8px] text-white text-sm px-2 py-2 outline-none focus:border-pink"
      >
        {TIER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <button
        onClick={onApply}
        disabled={applying || selectedTier === current}
        className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-[8px] text-[13px] font-semibold bg-pink text-white hover:bg-pink-light disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        {applying ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Aplicar tier
      </button>
    </div>
  );
}
