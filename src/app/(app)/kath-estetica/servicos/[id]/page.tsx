import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Check, Droplets, Calendar } from "lucide-react";
import {
  type EsteticaService,
  finalPriceCents,
  formatPrice,
  planDiscount,
} from "@/lib/estetica/types";

export const metadata: Metadata = { title: "Detalhe do Serviço" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ServicoDetailPage({ params }: Props) {
  const { id } = await params;
  const { userId } = await auth();
  const supabase = await createServerSupabaseClient();

  const [{ data: serviceRaw }, { data: profile }] = await Promise.all([
    supabase
      .from("estetica_services")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .single(),
    supabase.from("profiles").select("plan_tier").eq("id", userId!).single(),
  ]);

  if (!serviceRaw) notFound();
  const service = serviceRaw as unknown as EsteticaService;
  const planTier = (profile?.plan_tier as string) || "free";
  const finalCents = finalPriceCents(service, planTier);
  const disc = planDiscount(service, planTier);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 lg:py-6 space-y-4 lg:space-y-6 pb-32 lg:pb-6">
      <Link
        href="/kath-estetica/servicos"
        className="inline-flex items-center gap-2 text-pink text-[13px] font-semibold hover:text-pink-light"
      >
        <ArrowLeft size={14} />
        Voltar
      </Link>

      <div className="grid lg:grid-cols-2 gap-4 lg:gap-8">
        {/* Imagem: compacta no mobile (22vh), quadrada no desktop */}
        <div className="relative h-[22vh] min-h-[160px] max-h-[240px] lg:h-auto lg:aspect-square bg-bg-1 border border-gray-4 rounded-[18px] overflow-hidden">
          {service.image_url ? (
            <Image
              src={service.image_url}
              alt={service.title}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <Droplets size={60} className="stroke-gray-3" />
            </div>
          )}
          <div className="absolute top-3 left-3">
            <Badge variant="pink">{service.category.toUpperCase()}</Badge>
          </div>
          {disc > 0 && (
            <Badge variant="solid" className="absolute top-3 right-3">
              -{disc}%
            </Badge>
          )}
        </div>

        <div className="min-w-0">
          <h1 className="font-display text-2xl lg:text-4xl text-white leading-tight">
            {service.title.toUpperCase()}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[12px] text-gray-3">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {service.duration_min} min
            </span>
            {service.eligible_for_loyalty && (
              <span className="flex items-center gap-1 text-pink">
                <Check size={12} />
                Fidelidade
              </span>
            )}
          </div>

          {service.description && (
            <p className="text-gray-2 text-[13px] lg:text-[15px] mt-3 leading-relaxed line-clamp-3 lg:line-clamp-none">
              {service.description}
            </p>
          )}

          <div className="flex items-baseline gap-3 mt-3 lg:mt-6">
            <span className="font-display text-[36px] lg:text-[48px] leading-none text-pink">
              {formatPrice(finalCents)}
            </span>
            {disc > 0 && (
              <div className="flex flex-col">
                <span className="font-mono text-[12px] lg:text-[14px] text-gray-3 line-through">
                  {formatPrice(service.price_cents)}
                </span>
                <span className="font-mono text-[10px] lg:text-[11px] text-pink">
                  plano {planTier.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* CTA desktop (inline no grid) */}
          <Link
            href={`/kath-estetica/agendar/${service.id}`}
            className="hidden lg:inline-flex mt-6 items-center justify-center gap-2 w-full font-body font-semibold text-base px-7 py-4 bg-pink text-white rounded-full shadow-pink hover:bg-pink-light transition-all"
          >
            <Calendar size={18} />
            Agendar agora
          </Link>

          {service.includes.length > 0 && (
            <div className="mt-4 lg:mt-6">
              <h3 className="font-display text-base lg:text-xl text-white mb-2 lg:mb-3">INCLUI</h3>
              <ul className="space-y-1.5 lg:space-y-2">
                {service.includes.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-[12px] lg:text-[14px] text-gray-2"
                  >
                    <Check size={14} className="stroke-pink mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* CTA mobile fixo no rodapé (acima da tab bar) */}
      <div className="lg:hidden fixed bottom-32 left-4 right-4 z-40">
        <Link
          href={`/kath-estetica/agendar/${service.id}`}
          className="flex items-center justify-center gap-2 w-full font-body font-semibold text-base px-7 py-4 bg-pink text-white rounded-full shadow-pink hover:bg-pink-light transition-all"
        >
          <Calendar size={18} />
          Agendar agora
        </Link>
      </div>
    </div>
  );
}
