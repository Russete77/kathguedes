import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Droplets, Clock, Check, MapPin } from "lucide-react";
import {
  type EsteticaService,
  finalPriceCents,
  formatPrice,
} from "@/lib/estetica/types";
import { getEsteticaDiscountPct } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Serviços — Kath Guedes Estética Moto",
  description:
    "Catálogo completo de serviços de estética para motos: lavagem, polimento, vitrificação, higienização, cristalização. Preços, tempo médio e agendamento online.",
};

export default async function ServicosPage() {
  const { userId } = await auth();
  const supabase = await createServerSupabaseClient();

  const [{ data: servicesRaw }, { data: profile }] = await Promise.all([
    supabase
      .from("estetica_services")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase.from("profiles").select("plan_tier").eq("id", userId!).single(),
  ]);

  const services = (servicesRaw || []) as unknown as EsteticaService[];
  const planTier = ((profile?.plan_tier as string) || "free") as PlanTier;
  const discountPct = await getEsteticaDiscountPct(planTier);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="font-display text-4xl lg:text-5xl text-white">
          SERVIÇOS <span className="text-pink">ESTÉTICA MOTO</span>
        </h1>
        <p className="text-gray-2 text-sm mt-1">
          Escolha um serviço pra sua moto e agende pelo app. Assinantes têm desconto exclusivo.
        </p>
      </div>

      {services.length === 0 ? (
        <div className="text-center py-20 bg-bg-1 border border-gray-4 rounded-[22px]">
          <Droplets size={48} className="stroke-gray-3 mx-auto mb-4" />
          <p className="text-gray-2">
            Catálogo em configuração. Em breve serviços estarão disponíveis.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((s) => {
            const finalCents = finalPriceCents(s, discountPct);
            const disc = discountPct;
            const walkinOnly = s.requires_booking === false;
            return (
              <Link
                key={s.id}
                href={`/kath-estetica/servicos/${s.id}`}
                className="bg-bg-1 border border-gray-4 rounded-[22px] overflow-hidden hover:border-pink/40 hover:-translate-y-0.5 transition-all duration-200 group flex flex-col"
              >
                <div className="h-[200px] bg-bg-2 relative overflow-hidden">
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
                      <Droplets size={56} className="stroke-gray-3" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <Badge variant="pink">{s.category.toUpperCase()}</Badge>
                  </div>
                  {disc > 0 && (
                    <Badge variant="solid" className="absolute top-3 right-3">
                      -{disc}%
                    </Badge>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-[16px] text-white mb-1 line-clamp-1">
                    {s.title}
                  </h3>
                  {s.description && (
                    <p className="text-[13px] text-gray-2 line-clamp-2 mb-3">
                      {s.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-gray-3 mb-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {s.duration_min} min
                    </span>
                    {s.eligible_for_loyalty && (
                      <span className="flex items-center gap-1 text-pink">
                        <Check size={11} />
                        Conta na fidelidade
                      </span>
                    )}
                    {walkinOnly && (
                      <span className="flex items-center gap-1 text-yellow">
                        <MapPin size={11} />
                        Sem agendamento · loja
                      </span>
                    )}
                  </div>
                  {s.includes.length > 0 && (
                    <ul className="space-y-1 mb-4">
                      {s.includes.slice(0, 3).map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-[12px] text-gray-2"
                        >
                          <Check size={12} className="stroke-pink mt-0.5 shrink-0" />
                          <span className="line-clamp-1">{item}</span>
                        </li>
                      ))}
                      {s.includes.length > 3 && (
                        <li className="text-[11px] text-gray-3 pl-5">
                          + {s.includes.length - 3} itens
                        </li>
                      )}
                    </ul>
                  )}
                  <div className="flex items-baseline gap-2 mt-auto">
                    <span className="font-display text-[28px] leading-none text-pink">
                      {formatPrice(finalCents)}
                    </span>
                    {disc > 0 && (
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
    </div>
  );
}
