import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { RulesForm } from "./rules-form";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Regras de comissão" };

type Rule = {
  id: string;
  pct: number;
  applies_to_type: string | null;
  applies_to_category: string | null;
  is_active: boolean;
  team_members: { full_name: string };
};

type Member = { id: string; full_name: string };

export default async function RegrasPage() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const { data: rules } = await supabase
    .from("commission_rules")
    .select("id, pct, applies_to_type, applies_to_category, is_active, team_members(full_name)")
    .eq("is_active", true)
    .order("applies_to_type", { ascending: true, nullsFirst: true });

  const { data: members } = await supabase
    .from("team_members")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-4xl text-white">REGRAS DE COMISSÃO</h1>
          <p className="text-sm text-gray-2 mt-1">
            Quem leva quanto, por categoria de receita. Owner (Kath) recebe o residual automaticamente.
          </p>
        </div>
        <Link href="/admin/team" className="text-sm text-pink hover:text-pink-light underline">
          ← Membros
        </Link>
      </header>

      <section>
        <h2 className="font-display text-2xl text-white mb-3">Regras vigentes</h2>
        {(rules ?? []).length === 0 ? (
          <p className="text-sm text-gray-3">Nenhuma regra ativa.</p>
        ) : (
          <div className="rounded-[14px] border border-gray-4 bg-bg-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-2 border-b border-gray-4">
                  <th className="py-3 px-4">Sócio</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {(rules as unknown as Rule[]).map(r => (
                  <tr key={r.id} className="border-t border-gray-4">
                    <td className="py-2.5 px-4 text-gray-1">{r.team_members.full_name}</td>
                    <td className="py-2.5 px-4 text-gray-2">
                      {r.applies_to_type ?? <Badge variant="white">qualquer</Badge>}
                    </td>
                    <td className="py-2.5 px-4 text-gray-2">
                      {r.applies_to_category ?? <Badge variant="white">qualquer</Badge>}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-pink">{r.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl text-white mb-3">Adicionar regra</h2>
        <RulesForm members={(members ?? []) as Member[]} />
      </section>
    </main>
  );
}
