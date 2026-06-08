import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { TeamForm } from "./team-form";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Equipe" };

type Member = {
  id: string;
  email: string;
  full_name: string;
  role: "owner" | "partner" | "consultant";
  pix_key: string | null;
  is_active: boolean;
  created_at: string;
};

export default async function TeamPage() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data: members } = await supabase
    .from("team_members")
    .select("id,email,full_name,role,pix_key,is_active,created_at")
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-4xl text-white">EQUIPE</h1>
          <p className="text-sm text-gray-2 mt-1">Sócios e consultores que recebem comissão.</p>
        </div>
        <Link
          href="/admin/team/regras"
          className="text-sm text-pink hover:text-pink-light underline"
        >
          Regras de comissão →
        </Link>
      </header>

      <section>
        <h2 className="font-display text-2xl text-white mb-3">Membros</h2>
        {(members ?? []).length === 0 ? (
          <p className="text-sm text-gray-3">Nenhum membro cadastrado.</p>
        ) : (
          <div className="rounded-[14px] border border-gray-4 bg-bg-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-2 border-b border-gray-4">
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">PIX</th>
                  <th className="py-3 px-4">Ativo</th>
                </tr>
              </thead>
              <tbody>
                {(members as Member[]).map(m => (
                  <tr key={m.id} className="border-t border-gray-4">
                    <td className="py-2.5 px-4 text-gray-1">{m.full_name}</td>
                    <td className="py-2.5 px-4 text-gray-2 font-mono text-xs">{m.email}</td>
                    <td className="py-2.5 px-4">
                      <Badge variant={m.role === "owner" ? "pink" : "white"}>{m.role}</Badge>
                    </td>
                    <td className="py-2.5 px-4 text-gray-3 text-xs">{m.pix_key || "—"}</td>
                    <td className="py-2.5 px-4">
                      {m.is_active ? (
                        <Badge variant="green">ativo</Badge>
                      ) : (
                        <Badge variant="dark">inativo</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl text-white mb-3">Adicionar membro</h2>
        <TeamForm />
      </section>
    </main>
  );
}
