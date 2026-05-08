import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Gift, Check, Clock, Camera } from "lucide-react";
import type { EsteticaLoyaltyPhoto } from "@/lib/estetica/types";

export const metadata: Metadata = {
  title: "Programa de Fidelidade — Kath Estética",
  description: "4 lavagens com foto aprovada no mês → 5ª grátis.",
};

export default async function FidelidadePage() {
  const { userId } = await auth();
  const supabase = await createServerSupabaseClient();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthLabel = new Date().toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const { data: photosRaw } = await supabase
    .from("estetica_loyalty_photos")
    .select("*")
    .eq("user_id", userId!)
    .eq("month", currentMonth)
    .order("created_at", { ascending: false });

  const photos = (photosRaw || []) as unknown as EsteticaLoyaltyPhoto[];
  const approved = photos.filter((p) => p.approved).length;
  const pending = photos.filter((p) => !p.approved).length;
  const unlocked = approved >= 4;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <Link
        href="/kath-estetica"
        className="inline-flex items-center gap-2 text-pink text-sm font-semibold hover:text-pink-light"
      >
        <ArrowLeft size={16} />
        Voltar
      </Link>

      <div>
        <Badge variant="pink" className="mb-2">
          <Gift size={12} />
          PROGRAMA FIDELIDADE
        </Badge>
        <h1 className="font-display text-4xl text-white">
          4 LAVAGENS = <span className="text-pink">5ª GRÁTIS</span>
        </h1>
        <p className="text-gray-2 text-sm mt-1 capitalize">
          Progresso de {monthLabel}.
        </p>
      </div>

      {/* Progress */}
      <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-[11px] text-gray-3 uppercase tracking-[0.12em]">
            Progresso do mês
          </span>
          <span className="font-display text-2xl text-pink">
            {Math.min(approved, 4)}/4
          </span>
        </div>
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`flex-1 h-12 rounded-[10px] flex items-center justify-center font-display text-xl border transition-all ${
                approved >= n
                  ? "bg-pink text-white border-pink shadow-pink"
                  : "bg-bg-2 text-gray-3 border-gray-4"
              }`}
            >
              {approved >= n ? <Check size={20} /> : n}
            </div>
          ))}
          <div
            className={`flex-1 h-12 rounded-[10px] flex items-center justify-center border-2 border-dashed transition-all ${
              unlocked
                ? "border-pink bg-pink-dim text-pink"
                : "border-gray-4 text-gray-3"
            }`}
          >
            <Gift size={20} />
          </div>
        </div>

        {unlocked ? (
          <div className="bg-pink/10 border border-pink/40 rounded-[14px] p-4 text-center">
            <div className="font-display text-2xl text-white mb-1">
              🎉 5ª LAVAGEM DESBLOQUEADA!
            </div>
            <p className="text-gray-2 text-sm mb-3">
              No próximo agendamento deste mês, marque a opção &quot;Usar benefício fidelidade&quot; e pague R$0.
            </p>
            <Link
              href="/kath-estetica/servicos"
              className="inline-flex items-center gap-2 font-body font-semibold text-sm px-6 py-3 bg-pink text-white rounded-full hover:bg-pink-light"
            >
              Agendar agora
            </Link>
          </div>
        ) : (
          <p className="text-gray-2 text-sm text-center">
            Faltam <strong className="text-pink">{4 - approved}</strong> fotos aprovadas pra liberar a 5ª grátis.
            {pending > 0 && (
              <span className="block text-yellow text-xs mt-1">
                {pending} foto(s) aguardando aprovação da Kath.
              </span>
            )}
          </p>
        )}
      </div>

      {/* Como funciona */}
      <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-6">
        <h2 className="font-display text-xl text-white mb-3">COMO FUNCIONA</h2>
        <ol className="space-y-2 text-[14px] text-gray-2">
          <li className="flex gap-3">
            <span className="font-display text-pink text-xl leading-none">1.</span>
            Agende e realize uma lavagem na Kath Guedes Estética Moto.
          </li>
          <li className="flex gap-3">
            <span className="font-display text-pink text-xl leading-none">2.</span>
            Em &quot;Meus Agendamentos&quot;, envie uma foto da sua moto lavada.
          </li>
          <li className="flex gap-3">
            <span className="font-display text-pink text-xl leading-none">3.</span>
            A Kath aprova a foto pra contar no programa.
          </li>
          <li className="flex gap-3">
            <span className="font-display text-pink text-xl leading-none">4.</span>
            Ao atingir 4 fotos aprovadas no mesmo mês, a 5ª lavagem sai grátis.
          </li>
          <li className="flex gap-3">
            <span className="font-display text-pink text-xl leading-none">5.</span>
            O contador reseta todo dia 1º do mês.
          </li>
        </ol>
      </div>

      {/* Fotos do mês */}
      {photos.length > 0 && (
        <div>
          <h2 className="font-display text-xl text-white mb-3">FOTOS DO MÊS</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photos.map((p) => (
              <div
                key={p.id}
                className="relative aspect-square bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden"
              >
                <Image
                  src={p.photo_url}
                  alt="Foto fidelidade"
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover"
                />
                <div className="absolute bottom-2 left-2">
                  {p.approved ? (
                    <Badge variant="pink" className="gap-1">
                      <Check size={10} />
                      APROVADA
                    </Badge>
                  ) : (
                    <Badge variant="yellow" className="gap-1">
                      <Clock size={10} />
                      PENDENTE
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {photos.length === 0 && (
        <div className="text-center py-12 bg-bg-1 border border-gray-4 rounded-[22px]">
          <Camera size={40} className="stroke-gray-3 mx-auto mb-3" />
          <p className="text-gray-2 text-sm">
            Nenhuma foto enviada este mês. Finalize um serviço pra começar.
          </p>
        </div>
      )}
    </div>
  );
}
