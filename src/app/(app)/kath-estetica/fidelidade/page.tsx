import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Gift, Check, Clock, Camera } from "lucide-react";
import type { EsteticaLoyaltyPhoto, EsteticaBooking, EsteticaService } from "@/lib/estetica/types";
import { LoyaltyPhotoUpload } from "./loyalty-photo-upload";

export const metadata: Metadata = {
  title: "Programa de Fidelidade — Kath Estética",
  description: "3 lavagens com foto aprovada no mês → 4ª grátis.",
};

export default async function FidelidadePage() {
  const { userId } = await auth();
  // Admin client + filtro explicito por user_id (paginas de dado proprio que RLS bloqueia em dev).
  const supabase = createAdminSupabaseClient();

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
  const approvedPhotos = photos.filter((p) => p.approved);
  const pendingPhotos = photos.filter((p) => !p.approved);
  const approved = approvedPhotos.length;
  const pending = pendingPhotos.length;
  const unlocked = approved >= 3;

  // Agendamentos concluídos do mês que AINDA NÃO TÊM foto enviada
  const bookingIdsWithPhoto = new Set(photos.map((p) => p.booking_id));
  const startOfMonth = `${currentMonth}-01T00:00:00Z`;
  const { data: doneBookingsRaw } = await supabase
    .from("estetica_bookings")
    .select("*, service:estetica_services(title, category)")
    .eq("user_id", userId!)
    .eq("status", "done")
    .gte("scheduled_at", startOfMonth)
    .order("scheduled_at", { ascending: false });

  type BookingWithService = EsteticaBooking & {
    service: Pick<EsteticaService, "title" | "category"> | null;
  };
  const doneBookings = (doneBookingsRaw || []) as unknown as BookingWithService[];
  const bookingsNeedingPhoto = doneBookings.filter(
    (b) => !bookingIdsWithPhoto.has(b.id),
  );

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
          3 LAVAGENS = <span className="text-pink">4ª GRÁTIS</span>
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
            {Math.min(approved, 3)}/3
          </span>
        </div>
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map((n) => (
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
              🎉 4ª LAVAGEM DESBLOQUEADA!
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
            Faltam <strong className="text-pink">{3 - approved}</strong> fotos aprovadas pra liberar a 4ª grátis.
            {pending > 0 && (
              <span className="block text-yellow text-xs mt-1">
                {pending} foto(s) aguardando aprovação da Kath.
              </span>
            )}
          </p>
        )}
      </div>

      {/* Agendamentos prontos pra enviar foto */}
      {bookingsNeedingPhoto.length > 0 ? (
        <div className="bg-bg-1 border border-pink/30 rounded-[22px] p-6 space-y-4">
          <div>
            <Badge variant="pink" className="mb-2">
              <Camera size={12} />
              ENVIAR FOTOS
            </Badge>
            <h2 className="font-display text-xl text-white">
              {bookingsNeedingPhoto.length} agendamento{bookingsNeedingPhoto.length > 1 ? "s" : ""} pronto{bookingsNeedingPhoto.length > 1 ? "s" : ""} pra foto
            </h2>
            <p className="text-gray-2 text-sm mt-1">
              Tire a foto pela câmera ou escolha da galeria. A Kath aprova manualmente — só depois disso a foto entra no <strong className="text-pink">Progresso do mês</strong>.
            </p>
          </div>

          <div className="space-y-3">
            {bookingsNeedingPhoto.map((b) => (
              <div
                key={b.id}
                className="bg-bg-2 border border-gray-4 rounded-[14px] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[16px] text-white leading-tight truncate">
                      {b.service?.title || "Serviço"}
                    </div>
                    <div className="text-[12px] text-gray-3 mt-1">
                      {new Date(b.scheduled_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      {" · "}
                      {b.vehicle_brand} {b.vehicle_model}
                    </div>
                  </div>
                  <Badge variant="green" className="shrink-0">
                    Concluído
                  </Badge>
                </div>
                <LoyaltyPhotoUpload bookingId={b.id} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Sem booking pronto — explicar o caminho. Inclui CTA pra /servicos. */
        <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Camera size={18} className="stroke-gray-3" />
            <span className="font-mono text-[11px] text-gray-3 uppercase tracking-[0.12em]">
              Envio de fotos
            </span>
          </div>
          <p className="text-gray-2 text-sm leading-relaxed">
            Você ainda não tem agendamentos concluídos para enviar foto. Quando a Kath
            marcar uma lavagem sua como <strong className="text-white">concluída</strong>,
            ela aparece aqui com dois botões: <strong className="text-white">Tirar foto</strong>{" "}
            (câmera traseira do celular) ou <strong className="text-white">Galeria</strong> (escolher
            arquivo do aparelho). Depois é só aguardar a aprovação manual.
          </p>
          <Link
            href="/kath-estetica/servicos"
            className="inline-flex items-center gap-2 text-pink text-sm font-semibold hover:text-pink-light"
          >
            Ver serviços disponíveis →
          </Link>
        </div>
      )}

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
            Após o serviço, envie uma foto da sua moto lavada aqui mesmo ou em &quot;Meus Agendamentos&quot;.
          </li>
          <li className="flex gap-3">
            <span className="font-display text-pink text-xl leading-none">3.</span>
            A Kath aprova a foto pra contar no programa.
          </li>
          <li className="flex gap-3">
            <span className="font-display text-pink text-xl leading-none">4.</span>
            Ao atingir 3 fotos aprovadas no mesmo mês, a 4ª lavagem sai grátis.
          </li>
          <li className="flex gap-3">
            <span className="font-display text-pink text-xl leading-none">5.</span>
            O contador reseta todo dia 1º do mês.
          </li>
        </ol>
      </div>

      {/* Aguardando aprovação — separadas pra deixar claro que NAO contam ainda */}
      {pendingPhotos.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="stroke-yellow" />
            <h2 className="font-mono text-[11px] text-yellow tracking-[0.12em] uppercase">
              Aguardando aprovação ({pendingPhotos.length})
            </h2>
          </div>
          <p className="text-gray-2 text-xs mb-3">
            Essas fotos ainda não entraram no progresso. A Kath aprova manualmente.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {pendingPhotos.map((p) => (
              <div
                key={p.id}
                className="relative aspect-square bg-bg-1 border border-yellow/30 rounded-[14px] overflow-hidden"
              >
                <Image
                  src={p.photo_url}
                  alt="Foto pendente"
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-black/30 pointer-events-none" />
                <div className="absolute bottom-2 left-2">
                  <Badge variant="yellow" className="gap-1">
                    <Clock size={10} />
                    PENDENTE
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aprovadas — essas SÃO as que contam pro progresso */}
      {approvedPhotos.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Check size={14} className="stroke-pink" />
            <h2 className="font-mono text-[11px] text-pink tracking-[0.12em] uppercase">
              Aprovadas este mês ({approvedPhotos.length})
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {approvedPhotos.map((p) => (
              <div
                key={p.id}
                className="relative aspect-square bg-bg-1 border border-pink/40 rounded-[14px] overflow-hidden"
              >
                <Image
                  src={p.photo_url}
                  alt="Foto aprovada"
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover"
                />
                <div className="absolute bottom-2 left-2">
                  <Badge variant="pink" className="gap-1">
                    <Check size={10} />
                    APROVADA
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
