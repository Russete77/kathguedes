import { notFound } from "next/navigation";
import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import { type EsteticaService } from "@/lib/estetica/types";
import { BookingForm } from "./booking-form";
import { getEsteticaDiscountPct } from "@/lib/billing/plans";
import { getWalletActiveCents } from "@/lib/billing/wallet";
import type { PlanTier } from "@/lib/supabase/types";

export const metadata = { title: "Agendar Serviço" };

interface Props {
  params: Promise<{ serviceId: string }>;
}

export default async function AgendarPage({ params }: Props) {
  const { serviceId } = await params;
  const { userId } = await auth();
  const user = await currentUser();
  const supabase = await createServerSupabaseClient();

  const [{ data: serviceRaw }, { data: profile }] = await Promise.all([
    supabase
      .from("estetica_services")
      .select("*")
      .eq("id", serviceId)
      .eq("is_active", true)
      .single(),
    supabase
      .from("profiles")
      .select("plan_tier, full_name, phone")
      .eq("id", userId!)
      .single(),
  ]);

  if (!serviceRaw) notFound();
  const service = serviceRaw as unknown as EsteticaService;
  const planTier = ((profile?.plan_tier as string) || "free") as PlanTier;

  const [discountPct, activeCashbackCents] = await Promise.all([
    getEsteticaDiscountPct(planTier),
    getWalletActiveCents(userId!),
  ]);

  // Verificar elegibilidade fidelidade (3 fotos aprovadas no mês atual)
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { count: approvedCount } = await supabase
    .from("estetica_loyalty_photos")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId!)
    .eq("month", currentMonth)
    .eq("approved", true);

  // Já usou o loyalty_free neste mês?
  const startOfMonth = `${currentMonth}-01T00:00:00Z`;
  const { data: alreadyUsedRaw } = await supabase
    .from("estetica_bookings")
    .select("id")
    .eq("user_id", userId!)
    .eq("loyalty_free", true)
    .gte("scheduled_at", startOfMonth)
    .limit(1);

  const loyaltyEligible =
    service.eligible_for_loyalty &&
    (approvedCount ?? 0) >= 3 &&
    (!alreadyUsedRaw || alreadyUsedRaw.length === 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 lg:py-6 space-y-4 lg:space-y-6 pb-32 lg:pb-6">
      <Link
        href={`/kath-estetica/servicos/${service.id}`}
        className="inline-flex items-center gap-2 text-pink text-[13px] font-semibold hover:text-pink-light"
      >
        <ArrowLeft size={14} />
        Voltar
      </Link>

      <div>
        <h1 className="font-display text-xl lg:text-3xl text-white leading-tight">
          AGENDAR <span className="text-pink">{service.title.toUpperCase()}</span>
        </h1>
      </div>

      <BookingForm
        service={service}
        discountPct={discountPct}
        activeCashbackCents={activeCashbackCents}
        defaultName={
          (profile?.full_name as string) ||
          `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
          ""
        }
        defaultPhone={(profile?.phone as string) || ""}
        loyaltyEligible={loyaltyEligible}
      />
    </div>
  );
}
