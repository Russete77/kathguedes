import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AnamneseForm } from "./anamnese-form";
import { redirect } from "next/navigation";
import { Settings2 } from "lucide-react";

export const metadata = { title: "Anamnese" };

export default async function AnamesePage() {
  const { userId } = await auth();
  const supabase = await createServerSupabaseClient();

  // Buscar consultoria ativa sem anamnese (qualquer status — pode ter sido
  // entregue antes do usuário preencher)
  const { data: consultation } = await supabase
    .from("consultations")
    .select("id, package_type, anamnesis")
    .eq("user_id", userId!)
    .in("status", ["pending", "in_progress", "delivered"])
    .is("anamnesis", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!consultation) {
    // Sem consultoria sem anamnese — redirecionar
    redirect("/consultoria");
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-pink-dim rounded-full flex items-center justify-center border border-pink/20 mx-auto mb-4">
          <Settings2 size={28} className="stroke-pink" />
        </div>
        <h1 className="font-display text-4xl text-white">
          ANAMNESE
        </h1>
        <p className="text-gray-2 text-[14px] mt-2 max-w-md mx-auto">
          Preencha com atenção — essas informações são essenciais pra Kath
          montar seu plano personalizado.
        </p>
      </div>

      <AnamneseForm consultationId={consultation.id} />
    </div>
  );
}
