"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Car, Gift, Loader2 } from "lucide-react";
import {
  type EsteticaService,
  finalPriceCents,
  formatPrice,
} from "@/lib/estetica/types";
import CashbackInput from "@/components/billing/cashback-input";

interface Props {
  service: EsteticaService;
  discountPct: number;
  activeCashbackCents: number;
  defaultName: string;
  defaultPhone: string;
  loyaltyEligible: boolean;
}

export function BookingForm({
  service,
  discountPct,
  activeCashbackCents,
  defaultName,
  defaultPhone,
  loyaltyEligible,
}: Props) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [useLoyalty, setUseLoyalty] = useState(loyaltyEligible);
  const [cashbackToUse, setCashbackToUse] = useState(0);

  const discPct = discountPct;
  const basePrice = service.price_cents;
  const planDiscountCents = basePrice - finalPriceCents(service, discountPct);
  const grossPrice = basePrice - planDiscountCents;
  const total = useLoyalty ? 0 : grossPrice - cashbackToUse;

  // Buscar slots sempre que a data muda
  useEffect(() => {
    if (!date) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setSelectedSlot(null);
    fetch(
      `/api/estetica/slots?date=${date}&duration=${service.duration_min}`,
    )
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots || []);
      })
      .catch(() => toast.error("Erro ao buscar horários"))
      .finally(() => setLoadingSlots(false));
  }, [date, service.duration_min]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedSlot) {
      toast.error("Selecione um horário");
      return;
    }
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      service_id: service.id,
      scheduled_at: selectedSlot,
      vehicle_brand: form.get("vehicle_brand"),
      vehicle_model: form.get("vehicle_model"),
      vehicle_plate: form.get("vehicle_plate"),
      vehicle_color: form.get("vehicle_color") || null,
      customer_name: form.get("customer_name"),
      customer_phone: form.get("customer_phone"),
      use_loyalty: useLoyalty,
      use_cashback_cents: useLoyalty ? 0 : cashbackToUse,
    };

    try {
      const res = await fetch("/api/estetica/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao criar agendamento");
      }
      const { bookingId, loyaltyUsed } = await res.json();
      toast.success(
        loyaltyUsed ? "Agendamento grátis pelo programa fidelidade!" : "Agendamento criado!",
        { style: { borderLeft: "3px solid #FF0080" } },
      );
      router.push(`/kath-estetica/meus-agendamentos?highlight=${bookingId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
      setSubmitting(false);
    }
  }

  // Data mínima = hoje
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="space-y-3 lg:space-y-5">
      {/* Fidelidade */}
      {loyaltyEligible && (
        <div className="bg-pink/10 border border-pink/40 rounded-[14px] p-4 flex items-start gap-3">
          <Gift size={22} className="stroke-pink shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-display text-lg text-white leading-tight">
              5ª LAVAGEM GRÁTIS DISPONÍVEL!
            </div>
            <p className="text-gray-2 text-[13px] mt-1">
              Você tem 4 fotos aprovadas este mês. Ative abaixo pra agendar sem pagar.
            </p>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useLoyalty}
                onChange={(e) => setUseLoyalty(e.target.checked)}
                className="w-4 h-4 accent-pink"
              />
              <span className="text-white text-sm">Usar benefício fidelidade</span>
            </label>
          </div>
        </div>
      )}

      {/* Data + Horário lado a lado no mobile */}
      <Section icon={<Calendar size={14} className="stroke-pink" />} title="QUANDO">
        <input
          type="date"
          required
          min={todayStr}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[14px] px-3 py-2.5 outline-none focus:border-pink"
        />
      </Section>

      {/* Slots */}
      {date && (
        <Section icon={<Clock size={14} className="stroke-pink" />} title="HORÁRIO">
          {loadingSlots ? (
            <div className="flex items-center gap-2 text-gray-2 text-sm">
              <Loader2 size={14} className="animate-spin" />
              Carregando horários...
            </div>
          ) : slots.length === 0 ? (
            <p className="text-yellow text-sm">
              Sem horários disponíveis neste dia. Tente outra data.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((slot) => {
                const time = new Date(slot).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const active = selectedSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`px-3 py-2 rounded-[8px] border text-[13px] font-mono transition-all ${
                      active
                        ? "bg-pink text-white border-pink shadow-pink"
                        : "bg-bg-2 text-gray-2 border-gray-4 hover:border-pink/40"
                    }`}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {/* Moto */}
      <Section icon={<Car size={14} className="stroke-pink" />} title="SUA MOTO">
        <div className="grid grid-cols-2 gap-2">
          <Input name="vehicle_brand" placeholder="Marca" required />
          <Input name="vehicle_model" placeholder="Modelo" required />
          <Input name="vehicle_plate" placeholder="Placa" required />
          <Input name="vehicle_color" placeholder="Cor (opcional)" />
        </div>
      </Section>

      {/* Contato */}
      <Section icon={<Car size={14} className="stroke-pink" />} title="CONTATO">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            name="customer_name"
            placeholder="Nome completo"
            defaultValue={defaultName}
            required
          />
          <Input
            name="customer_phone"
            placeholder="Telefone (WhatsApp)"
            defaultValue={defaultPhone}
            required
          />
        </div>
      </Section>

      {/* Resumo compacto */}
      <div className="bg-bg-1 border border-gray-4 rounded-[12px] p-3 space-y-1.5">
        <div className="flex justify-between text-[12px]">
          <span className="text-gray-3">Serviço</span>
          <span className="text-white font-mono">{formatPrice(basePrice)}</span>
        </div>
        {discPct > 0 && !useLoyalty && (
          <div className="flex justify-between text-[12px]">
            <span className="text-gray-3">
              Desconto plano ({discPct}%)
            </span>
            <span className="text-success font-mono">
              -{formatPrice(planDiscountCents)}
            </span>
          </div>
        )}
        {useLoyalty && (
          <div className="flex justify-between text-[12px]">
            <span className="text-pink flex items-center gap-1">
              <Gift size={11} /> Fidelidade
            </span>
            <span className="text-pink font-mono">-{formatPrice(basePrice)}</span>
          </div>
        )}
        {!useLoyalty && cashbackToUse > 0 && (
          <div className="flex justify-between text-[12px]">
            <span className="text-gray-3">Cashback aplicado</span>
            <span className="text-success font-mono">-{formatPrice(cashbackToUse)}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline border-t border-gray-4 pt-1.5">
          <span className="text-white text-[13px] font-semibold">Total</span>
          <span className="font-display text-[22px] leading-none text-pink">
            {formatPrice(total)}
          </span>
        </div>
      </div>

      {/* Cashback */}
      {!useLoyalty && (
        <CashbackInput
          activeCents={activeCashbackCents}
          grossCents={grossPrice}
          onChange={setCashbackToUse}
        />
      )}

      {/* CTA — desktop inline, mobile fixo */}
      <Button
        type="submit"
        size="lg"
        className="hidden lg:flex w-full"
        disabled={submitting || !selectedSlot}
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Criando...
          </>
        ) : useLoyalty ? (
          "Confirmar (grátis)"
        ) : (
          "Confirmar e ir para pagamento"
        )}
      </Button>

      <div className="lg:hidden fixed bottom-32 left-4 right-4 z-40">
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting || !selectedSlot}
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Criando...
            </>
          ) : useLoyalty ? (
            "Confirmar (grátis)"
          ) : (
            "Confirmar e pagar"
          )}
        </Button>
      </div>
    </form>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="font-mono text-[10px] text-gray-3 tracking-[0.12em]">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-3 py-2.5 outline-none focus:border-pink placeholder:text-gray-3"
    />
  );
}
