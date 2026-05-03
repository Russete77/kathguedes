import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Calendar,
  Droplets,
  Shield,
  Star,
  ArrowRight,
  Gift,
  MapPin,
  Clock,
  ClipboardList,
} from "lucide-react";
import {
  type EsteticaService,
  type EsteticaPortfolioItem,
  finalPriceCents,
  formatPrice,
} from "@/lib/estetica/types";
import { getEsteticaDiscountPct } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Kath Guedes Estética Moto",
  description:
    "Estética profissional para motos — lavagem premium, polimento, vitrificação, higienização, cristalização. Agende, pague e acompanhe pelo app. Programa de fidelidade: 4 lavagens com foto → 5ª grátis.",
  keywords: [
    "kath guedes estética moto",
    "estética para motos",
    "lavagem de moto",
    "polimento de moto",
    "vitrificação moto",
    "higienização moto",
  ],
  alternates: { canonical: "https://kathapp.com.br/kath-estetica" },
};

export default async function KathEsteticaHubPage() {
  const { userId } = await auth();
  const supabase = await createServerSupabaseClient();

  const [{ data: servicesRaw }, { data: portfolioRaw }, { data: profile }] =
    await Promise.all([
      supabase
        .from("estetica_services")
        .select("*")
        .order("sort_order", { ascending: true })
        .limit(6),
      supabase
        .from("estetica_portfolio")
        .select("*")
        .eq("is_featured", true)
        .order("sort_order", { ascending: true })
        .limit(4),
      supabase
        .from("profiles")
        .select("plan_tier")
        .eq("id", userId!)
        .single(),
    ]);

  const services = (servicesRaw || []) as unknown as EsteticaService[];
  const portfolio = (portfolioRaw || []) as unknown as EsteticaPortfolioItem[];
  const planTier = ((profile?.plan_tier as string) || "free") as PlanTier;
  const discountPct = await getEsteticaDiscountPct(planTier);

  // Progresso do programa de fidelidade (fotos aprovadas do mês)
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { count: approvedCount } = await supabase
    .from("estetica_loyalty_photos")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId!)
    .eq("month", currentMonth)
    .eq("approved", true);

  const photos = approvedCount ?? 0;
  const loyaltyUnlocked = photos >= 4;

  // Contagem de agendamentos ativos (pendentes/confirmados/in_progress)
  const { count: activeBookingsCount } = await supabase
    .from("estetica_bookings")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId!)
    .in("status", ["pending", "confirmed", "in_progress"]);

  const activeBookings = activeBookingsCount ?? 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 lg:space-y-10">
      {/* Quick Actions — atalhos do topo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link
          href="/kath-estetica/servicos"
          className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 hover:border-pink/40 transition-all group"
        >
          <div className="w-10 h-10 bg-pink-dim rounded-[10px] flex items-center justify-center border border-pink/20 mb-2">
            <Droplets size={18} className="stroke-pink" />
          </div>
          <div className="font-display text-[16px] text-white leading-tight">SERVIÇOS</div>
          <div className="text-[11px] text-gray-3 mt-0.5">Ver e agendar</div>
        </Link>

        <Link
          href="/kath-estetica/meus-agendamentos"
          className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 hover:border-pink/40 transition-all group relative"
        >
          <div className="w-10 h-10 bg-pink-dim rounded-[10px] flex items-center justify-center border border-pink/20 mb-2">
            <ClipboardList size={18} className="stroke-pink" />
          </div>
          <div className="font-display text-[16px] text-white leading-tight">MEUS</div>
          <div className="text-[11px] text-gray-3 mt-0.5">Agendamentos</div>
          {activeBookings > 0 && (
            <div className="absolute top-3 right-3 min-w-[22px] h-[22px] px-1.5 rounded-full bg-pink text-white text-[11px] font-bold flex items-center justify-center shadow-pink">
              {activeBookings}
            </div>
          )}
        </Link>

        <Link
          href="/kath-estetica/fidelidade"
          className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 hover:border-pink/40 transition-all group relative"
        >
          <div className="w-10 h-10 bg-pink-dim rounded-[10px] flex items-center justify-center border border-pink/20 mb-2">
            <Gift size={18} className="stroke-pink" />
          </div>
          <div className="font-display text-[16px] text-white leading-tight">FIDELIDADE</div>
          <div className="text-[11px] text-gray-3 mt-0.5">{photos}/4 do mês</div>
          {loyaltyUnlocked && (
            <div className="absolute top-3 right-3 text-[9px] bg-pink text-white px-2 py-0.5 rounded-full font-bold">
              LIBERADO
            </div>
          )}
        </Link>

        <Link
          href="/kath-estetica/portfolio"
          className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 hover:border-pink/40 transition-all group"
        >
          <div className="w-10 h-10 bg-pink-dim rounded-[10px] flex items-center justify-center border border-pink/20 mb-2">
            <Star size={18} className="stroke-pink" />
          </div>
          <div className="font-display text-[16px] text-white leading-tight">PORTFÓLIO</div>
          <div className="text-[11px] text-gray-3 mt-0.5">Antes & depois</div>
        </Link>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[22px] border border-gray-4 bg-bg-1 p-8 lg:p-12">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-glow-pink opacity-20 pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <Badge variant="pink" className="mb-4">
            <Sparkles size={12} />
            KATH GUEDES ESTÉTICA MOTO
          </Badge>
          <h1 className="font-display text-4xl lg:text-6xl text-white leading-[0.95]">
            SUA MOTO NO <span className="text-pink">PADRÃO KATH</span>
          </h1>
          <p className="text-gray-2 text-[15px] mt-4 max-w-lg">
            Estética profissional pra quem vive em cima de duas rodas. Lavagem
            premium, polimento, vitrificação e proteção feitos por especialistas.
            Agende pelo app, pague via Pix e acompanhe tudo em tempo real.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link
              href="/kath-estetica/servicos"
              className="inline-flex items-center gap-2 font-body font-semibold text-sm px-7 py-3 bg-pink text-white rounded-full shadow-pink hover:bg-pink-light transition-all"
            >
              Ver Serviços <ArrowRight size={16} />
            </Link>
            <Link
              href="/kath-estetica/portfolio"
              className="inline-flex items-center gap-2 font-body font-semibold text-sm px-7 py-3 bg-bg-2 border border-gray-4 text-white rounded-full hover:border-pink/40 transition-all"
            >
              Antes & Depois
            </Link>
          </div>
        </div>
      </section>

      {/* Programa Fidelidade */}
      <section className="bg-bg-1 border border-pink/30 rounded-[22px] p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[250px] h-[250px] bg-glow-pink opacity-15 pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-6 justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-pink-dim rounded-[14px] flex items-center justify-center border border-pink/25 shrink-0">
              <Gift size={28} className="stroke-pink" />
            </div>
            <div>
              <Badge variant="pink" className="mb-2">
                PROGRAMA FIDELIDADE
              </Badge>
              <h2 className="font-display text-2xl lg:text-3xl text-white leading-tight">
                4 LAVAGENS COM FOTO = <span className="text-pink">5ª GRÁTIS</span>
              </h2>
              <p className="text-gray-2 text-sm mt-1 max-w-md">
                A cada lavagem, envie uma foto da sua moto na Kath Estética Moto.
                Ao bater 4 no mês, a 5ª sai 100% grátis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-display text-lg border transition-all ${
                    photos >= n
                      ? "bg-pink text-white border-pink shadow-pink"
                      : "bg-bg-2 text-gray-3 border-gray-4"
                  }`}
                >
                  {n}
                </div>
              ))}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-dashed transition-all ${
                  loyaltyUnlocked
                    ? "border-pink bg-pink-dim text-pink"
                    : "border-gray-4 text-gray-3"
                }`}
              >
                <Gift size={16} />
              </div>
            </div>
            <Link
              href="/kath-estetica/fidelidade"
              className="ml-3 text-pink text-[13px] font-semibold hover:text-pink-light"
            >
              Ver →
            </Link>
          </div>
        </div>
      </section>

      {/* Serviços em destaque */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-3xl text-white">SERVIÇOS</h2>
            <p className="text-gray-2 text-sm mt-1">
              Escolha e agende em segundos.
            </p>
          </div>
          <Link
            href="/kath-estetica/servicos"
            className="text-pink text-[13px] font-semibold flex items-center gap-1 hover:text-pink-light"
          >
            Ver todos <ArrowRight size={14} />
          </Link>
        </div>

        {services.length === 0 ? (
          <div className="text-center py-16 bg-bg-1 border border-gray-4 rounded-[22px]">
            <Droplets size={48} className="stroke-gray-3 mx-auto mb-4" />
            <p className="text-gray-2">
              Catálogo em configuração. Em breve você verá todos os serviços aqui.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s) => {
              const finalCents = finalPriceCents(s, discountPct);
              const hasDiscount = finalCents < s.price_cents;
              return (
                <Link
                  key={s.id}
                  href={`/kath-estetica/servicos/${s.id}`}
                  className="bg-bg-1 border border-gray-4 rounded-[22px] overflow-hidden hover:border-pink/40 hover:-translate-y-0.5 transition-all duration-200 group"
                >
                  <div className="h-[180px] bg-bg-2 relative overflow-hidden">
                    {s.image_url ? (
                      <Image
                        src={s.image_url}
                        alt={s.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <Droplets size={48} className="stroke-gray-3" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <Badge variant="pink">{s.category.toUpperCase()}</Badge>
                    </div>
                    {hasDiscount && (
                      <Badge
                        variant="solid"
                        className="absolute top-3 right-3"
                      >
                        -{discountPct}%
                      </Badge>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-[16px] text-white mb-1 line-clamp-1">
                      {s.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-gray-3 mb-3">
                      <Clock size={11} />
                      {s.duration_min} min
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-[26px] leading-none text-pink">
                        {formatPrice(finalCents)}
                      </span>
                      {hasDiscount && (
                        <span className="font-mono text-[12px] text-gray-3 line-through">
                          {formatPrice(s.price_cents)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Diferenciais */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <FeatureTile
          icon={<Calendar size={24} className="stroke-pink" />}
          title="AGENDE PELO APP"
          desc="Escolha data e horário em segundos"
        />
        <FeatureTile
          icon={<Shield size={24} className="stroke-pink" />}
          title="PAGAMENTO SEGURO"
          desc="Pix instantâneo via Asaas"
        />
        <FeatureTile
          icon={<Star size={24} className="stroke-pink" />}
          title="PADRÃO KATH"
          desc="Atendimento personalizado"
        />
        <FeatureTile
          icon={<Gift size={24} className="stroke-pink" />}
          title="5ª LAVAGEM GRÁTIS"
          desc="Programa de fidelidade mensal"
        />
      </section>

      {/* Portfólio preview */}
      {portfolio.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-3xl text-white">ANTES & DEPOIS</h2>
              <p className="text-gray-2 text-sm mt-1">
                Resultados reais dos nossos clientes.
              </p>
            </div>
            <Link
              href="/kath-estetica/portfolio"
              className="text-pink text-[13px] font-semibold flex items-center gap-1 hover:text-pink-light"
            >
              Ver galeria <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {portfolio.map((p) => (
              <div
                key={p.id}
                className="relative aspect-square bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden group"
              >
                <Image
                  src={p.after_url}
                  alt={p.title || "Portfólio"}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg-base/80 to-transparent" />
                <div className="absolute bottom-3 left-3">
                  <Badge variant="pink">DEPOIS</Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Localização */}
      <section className="bg-bg-1 border border-gray-4 rounded-[22px] p-6 flex items-center gap-4">
        <div className="w-12 h-12 bg-pink-dim rounded-[14px] flex items-center justify-center border border-pink/20 shrink-0">
          <MapPin size={22} className="stroke-pink" />
        </div>
        <div>
          <div className="font-display text-xl text-white">
            KATH GUEDES ESTÉTICA MOTO
          </div>
          <p className="text-gray-2 text-sm">
            Endereço configurável no admin. Confira o agendamento pra ver o local.
          </p>
        </div>
      </section>
    </div>
  );
}

function FeatureTile({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-5 hover:border-pink/35 transition-all">
      <div className="w-10 h-10 bg-pink-dim rounded-[10px] flex items-center justify-center border border-pink/20 mb-3">
        {icon}
      </div>
      <div className="font-display text-[18px] text-white leading-tight">
        {title}
      </div>
      <p className="text-[12px] text-gray-3 mt-1">{desc}</p>
    </div>
  );
}
