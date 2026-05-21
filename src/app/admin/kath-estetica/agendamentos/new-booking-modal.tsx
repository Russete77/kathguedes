"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { PlateInput } from "@/components/ui/plate-input";
import { createBookingAsAdmin } from "../actions";
import type { ServicePricing } from "@/lib/estetica/pricing-types";
import { formatPrice } from "@/lib/estetica/types";

interface BookableService {
  id: string;
  title: string;
  duration_min: number;
  pricing: ServicePricing | undefined;
}

export function NewBookingButton({ services }: { services: BookableService[] }) {
  const [open, setOpen] = useState(false);

  if (services.length === 0) {
    return (
      <span className="text-[12px] text-gray-3 italic">
        Cadastre preços antes de criar agendamentos
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 font-body font-semibold text-xs px-5 py-2 bg-pink text-white rounded-full shadow-pink hover:bg-pink-light transition-all"
      >
        <Plus size={16} />
        Novo agendamento
      </button>
      {open && (
        <NewBookingModal services={services} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function NewBookingModal({
  services,
  onClose,
}: {
  services: BookableService[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const [serviceId, setServiceId] = useState<string>(services[0]?.id ?? "");
  const [vehicleTypeId, setVehicleTypeId] = useState<string>("");
  const [date, setDate] = useState<string>(""); // YYYY-MM-DD
  const [time, setTime] = useState<string>("09:00");

  const service = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );
  const pricing = service?.pricing;
  const pricingOption = useMemo(
    () => pricing?.options.find((o) => o.vehicle_type.id === vehicleTypeId) ?? null,
    [pricing, vehicleTypeId],
  );

  function handleServiceChange(id: string) {
    setServiceId(id);
    // Limpa vehicle_type que pode não existir no novo serviço
    setVehicleTypeId("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!serviceId || !vehicleTypeId) {
      toast.error("Selecione serviço e tipo de moto");
      return;
    }
    if (!date) {
      toast.error("Selecione a data");
      return;
    }
    if (!time) {
      toast.error("Selecione o horário");
      return;
    }

    // Monta scheduled_at em ISO local (sem TZ shift). Postgres timestamptz
    // converte para UTC ao salvar; admin escolhe horário local de SP.
    const scheduledAt = new Date(`${date}T${time}:00-03:00`).toISOString();

    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("scheduled_at", scheduledAt);
    fd.set("service_id", serviceId);
    fd.set("vehicle_type_id", vehicleTypeId);

    startTransition(async () => {
      try {
        await createBookingAsAdmin(fd);
        toast.success("Agendamento criado", {
          description: pricingOption
            ? `${formatPrice(pricingOption.price_cents)} · ${service?.title}`
            : undefined,
        });
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao criar");
      }
    });
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-bg-1 border border-gray-4 rounded-[22px] p-4 sm:p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto space-y-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl sm:text-2xl text-white">
              NOVO AGENDAMENTO
            </h2>
            <p className="text-gray-3 text-[12px] mt-0.5">
              Criado pela loja para cliente sem app. Pagamento presencial.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-2 hover:text-pink p-1 -m-1 rounded-md hover:bg-bg-2"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Serviço + tipo de moto */}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-gray-3">Serviço</span>
            <select
              value={serviceId}
              onChange={(e) => handleServiceChange(e.target.value)}
              required
              className="w-full mt-1.5 bg-bg-2 border border-gray-4 rounded-[10px] text-white text-sm px-3 py-2.5 outline-none focus:border-pink"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} · {s.duration_min} min
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-gray-3">
              Tipo da moto
              {pricing?.options && (
                <span className="ml-1 text-pink normal-case">
                  · {pricing.options.length} opções
                </span>
              )}
            </span>
            <select
              value={vehicleTypeId}
              onChange={(e) => setVehicleTypeId(e.target.value)}
              required
              className="w-full mt-1.5 bg-bg-2 border border-gray-4 rounded-[10px] text-white text-sm px-3 py-2.5 outline-none focus:border-pink"
            >
              <option value="">Selecione…</option>
              {pricing?.options.map((o) => (
                <option key={o.vehicle_type.id} value={o.vehicle_type.id}>
                  {o.vehicle_type.label} · {formatPrice(o.price_cents)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Cliente */}
        <fieldset className="space-y-3">
          <legend className="text-[11px] uppercase tracking-wider text-pink font-semibold">
            Cliente
          </legend>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field name="customer_name" label="Nome completo" required />
            <Field name="customer_phone" label="Telefone / WhatsApp" required />
          </div>
        </fieldset>

        {/* Veículo */}
        <fieldset className="space-y-3">
          <legend className="text-[11px] uppercase tracking-wider text-pink font-semibold">
            Moto
          </legend>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field name="vehicle_brand" label="Marca" required placeholder="Honda, Yamaha..." />
            <Field name="vehicle_model" label="Modelo" required placeholder="CB500, MT-09..." />
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-gray-3">
                Placa<span className="text-pink ml-1">*</span>
              </span>
              <PlateInput
                name="vehicle_plate"
                required
                className="w-full mt-1.5 bg-bg-2 border border-gray-4 rounded-[10px] text-white text-sm px-3 py-2.5 outline-none focus:border-pink placeholder:text-gray-3 font-mono"
              />
            </label>
            <Field name="vehicle_color" label="Cor" />
          </div>
        </fieldset>

        {/* Data + horário */}
        <fieldset className="space-y-3">
          <legend className="text-[11px] uppercase tracking-wider text-pink font-semibold">
            Quando
          </legend>
          <div className="bg-bg-2 border border-gray-4 rounded-[12px] flex justify-center overflow-hidden">
            <CalendarPicker
              mode="single"
              selected={date ? new Date(date + "T12:00:00") : undefined}
              onSelect={(d) => {
                if (!d) return setDate("");
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, "0");
                const day = String(d.getDate()).padStart(2, "0");
                setDate(`${y}-${m}-${day}`);
              }}
              disabled={{ before: new Date(todayStr + "T00:00:00") }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-gray-3">
                Horário
              </span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full mt-1.5 bg-bg-2 border border-gray-4 rounded-[10px] text-white text-sm px-3 py-2.5 outline-none focus:border-pink"
              />
            </label>
            <div className="flex flex-col justify-end">
              {date && (
                <p className="text-[11px] text-gray-3">
                  {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  })}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        {/* Notas */}
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-gray-3">
            Observações (opcional)
          </span>
          <textarea
            name="notes"
            rows={2}
            maxLength={1000}
            placeholder="Algo relevante para a entrega? Adesivos, peças avariadas, pedido específico..."
            className="w-full mt-1.5 bg-bg-2 border border-gray-4 rounded-[10px] text-white text-sm px-3 py-2.5 outline-none resize-none focus:border-pink placeholder:text-gray-3"
          />
        </label>

        {/* Resumo + CTA */}
        {pricingOption && (
          <div className="bg-pink/10 border border-pink/30 rounded-[12px] p-3 flex items-center justify-between gap-3">
            <div className="text-[12px]">
              <div className="text-gray-2">Total cobrado presencialmente</div>
              <div className="text-pink font-mono text-[10px] mt-0.5">
                {pricingOption.vehicle_type.label}
              </div>
            </div>
            <div className="font-display text-2xl text-pink">
              {formatPrice(pricingOption.price_cents)}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={pending || !pricingOption}>
            {pending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Save size={14} />
                Criar agendamento
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  required,
  placeholder,
}: {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-gray-3">
        {label}
        {required && <span className="text-pink ml-1">*</span>}
      </span>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full mt-1.5 bg-bg-2 border border-gray-4 rounded-[10px] text-white text-sm px-3 py-2.5 outline-none focus:border-pink placeholder:text-gray-3"
      />
    </label>
  );
}
