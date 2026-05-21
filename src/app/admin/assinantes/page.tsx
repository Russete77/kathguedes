import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { AssinantesList } from "./assinantes-list";

export const metadata = { title: "Assinantes" };

export default async function AdminAssinantesPage() {
  const supabase = createAdminSupabaseClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-4xl text-white">ASSINANTES</h1>
        <p className="text-gray-2 text-sm mt-1">
          Todos os usuários do KathApp — plano, status e dados.
        </p>
      </div>
      <AssinantesList profiles={profiles || []} />
    </div>
  );
}
