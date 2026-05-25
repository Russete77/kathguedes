"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { saveServicePricing } from "../actions";
import type {
  EsteticaVehicleType,
  ServicePricing,
} from "@/lib/estetica/pricing-types";

interface ServiceLite {
  id: string;
  title: string;
  category: string;
  duration_min: number;
  slug: string | null;
}

interface PriceRow {
  vehicle_type_id: string;
  price_cents: number;
}

interface RuleState {
  allow_onsite_cash: boolean;
  allow_onsite_pix: boolean;
  allow_onsite_card: boolean;
  allow_app_prepay: boolean;
  require_app_prepay: boolean;
  prepay_pct: number;
  notes: string;
}

function defaultRule(): RuleState {
  return {
    allow_onsite_cash: true,
    allow_onsite_pix: true,
    allow_onsite_card: true,
    allow_app_prepay: true,
    require_app_prepay: false,
    prepay_pct: 0,
    notes: "",
  };
}

export function PricingMatrix({
  service,
  vehicleTypes,
  initial,
  showHeader = true,
}: {
  service: ServiceLite;
  vehicleTypes: EsteticaVehicleType[];
  initial: ServicePricing | undefined;
  /**
   * Quando false, esconde o título/categoria/duração — usado quando a matriz
   * vive dentro do card de Serviços (que já mostra essa info).
   */
  showHeader?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const initialPrices: PriceRow[] = useMemo(
    () =>
      (initial?.options ?? []).map((o) => ({
        vehicle_type_id: o.vehicle_type.id,
        price_cents: o.price_cents,
      })),
    [initial],
  );
  const [prices, setPrices] = useState<PriceRow[]>(initialPrices);

  const initialRule: RuleState = useMemo(
    () =>
      initial?.payment_rule
        ? {
            allow_onsite_cash: initial.payment_rule.allow_onsite_cash,
            allow_onsite_pix: initial.payment_rule.allow_onsite_pix,
            allow_onsite_card: initial.payment_rule.allow_onsite_card,
            allow_app_prepay: initial.payment_rule.allow_app_prepay,
            require_app_prepay: initial.payment_rule.require_app_prepay,
            prepay_pct: initial.payment_rule.prepay_pct,
            notes: initial.payment_rule.notes ?? "",
          }
        : defaultRule(),
    [initial],
  );
  const [rule, setRule] = useState<RuleState>(initialRule);

  const availableToAdd = vehicleTypes.filter(
    (v) => !prices.some((p) => p.vehicle_type_id === v.id),
  );

  const vehicleTypeById = useMemo(() => {
    const map = new Map<string, EsteticaVehicleType>();
    vehicleTypes.forEach((v) => map.set(v.id, v));
    return map;
  }, [vehicleTypes]);

  function addType(vehicleTypeId: string) {
    if (!vehicleTypeId) return;
    setPrices([...prices, { vehicle_type_id: vehicleTypeId, price_cents: 0 }]);
  }

  function updatePrice(vehicleTypeId: string, value: string) {
    const n = Math.max(0, Math.round(Number(value) || 0));
    setPrices((prev) =>
      prev.map((p) =>
        p.vehicle_type_id === vehicleTypeId ? { ...p, price_cents: n } : p,
      ),
    );
  }

  function removePrice(vehicleTypeId: string) {
    setPrices((prev) => prev.filter((p) => p.vehicle_type_id !== vehicleTypeId));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await saveServicePricing({
          service_id: service.id,
          prices,
          payment_rule: {
            ...rule,
            notes: rule.notes.trim() || null,
          },
        });
        toast.success(`${service.title}: preços salvos`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  const wrapperClass = showHeader
    ? "bg-bg-1 border border-gray-4 rounded-[18px] p-4 sm:p-5 space-y-4"
    : "space-y-4";

  return (
    <section className={wrapperClass}>
      {showHeader ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg sm:text-xl text-white leading-tight">
              {service.title.toUpperCase()}
            </h2>
            <div className="flex flex-wrap gap-2 mt-1 text-[11px] text-gray-3">
              <Badge variant="pink">{service.category}</Badge>
              <span>{service.duration_min} min</span>
              {service.slug && <span className="font-mono">/{service.slug}</span>}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={pending}
            className="shrink-0"
          >
            {pending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Salvar
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">
            Preços por tipo de moto
          </span>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={pending}
            className="shrink-0"
          >
            {pending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Salvar preços
          </Button>
        </div>
      )}

      {/* Lista de preços por tipo */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-gray-3">
          Tipos de moto · preço cadastrado
        </div>

        {prices.length === 0 ? (
          <div className="text-sm text-gray-3 bg-bg-2 border border-dashed border-gray-4 rounded-[12px] p-4 text-center">
            Nenhum tipo cadastrado. Adicione abaixo.
          </div>
        ) : (
          <div className="grid gap-2">
            {prices.map((p) => {
              const vt = vehicleTypeById.get(p.vehicle_type_id);
              const reais = (p.price_cents / 100).toFixed(2).replace(".", ",");
              return (
                <div
                  key={p.vehicle_type_id}
                  className="flex items-center gap-2 bg-bg-2 border border-gray-4 rounded-[12px] p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white font-semibold truncate">
                      {vt?.label ?? "(tipo removido)"}
                    </div>
                    {vt?.description && (
                      <div className="text-[11px] text-gray-3 truncate">
                        {vt.description}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-gray-3">R$</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={p.price_cents}
                      onChange={(e) => updatePrice(p.vehicle_type_id, e.target.value)}
                      className="w-24 bg-bg-1 border border-gray-4 rounded-[8px] text-white text-sm px-2 py-1.5 outline-none focus:border-pink text-right"
                      title={`${reais} reais`}
                    />
                    <button
                      type="button"
                      onClick={() => removePrice(p.vehicle_type_id)}
                      aria-label="Remover"
                      className="p-2 text-gray-2 hover:text-danger rounded-md hover:bg-bg-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Adicionar tipo */}
        {availableToAdd.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <Plus size={14} className="stroke-pink" />
            <select
              onChange={(e) => {
                addType(e.target.value);
                e.target.value = "";
              }}
              defaultValue=""
              className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-sm px-2 py-1.5 outline-none focus:border-pink"
            >
              <option value="" disabled>
                Adicionar tipo de moto…
              </option>
              {availableToAdd.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Regra de pagamento */}
      <details className="bg-bg-2 border border-gray-4 rounded-[12px] open:bg-bg-2" open={rule.require_app_prepay}>
        <summary className="cursor-pointer px-3 py-2.5 text-[12px] uppercase tracking-wider text-gray-2 hover:text-pink select-none">
          Regra de pagamento{rule.require_app_prepay ? ` · sinal ${rule.prepay_pct}% obrigatório` : ""}
        </summary>
        <div className="p-3 space-y-3 border-t border-gray-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
            <Toggle
              label="Dinheiro"
              checked={rule.allow_onsite_cash}
              onChange={(v) => setRule({ ...rule, allow_onsite_cash: v })}
            />
            <Toggle
              label="PIX presencial"
              checked={rule.allow_onsite_pix}
              onChange={(v) => setRule({ ...rule, allow_onsite_pix: v })}
            />
            <Toggle
              label="Cartão (loja)"
              checked={rule.allow_onsite_card}
              onChange={(v) => setRule({ ...rule, allow_onsite_card: v })}
            />
            <Toggle
              label="App / Asaas"
              checked={rule.allow_app_prepay}
              onChange={(v) => setRule({ ...rule, allow_app_prepay: v })}
            />
          </div>

          <div className="border-t border-gray-4 pt-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rule.require_app_prepay}
                onChange={(e) => setRule({ ...rule, require_app_prepay: e.target.checked })}
                className="w-4 h-4 accent-pink"
              />
              <span className="text-white text-sm">
                Exigir sinal via app no agendamento
              </span>
            </label>

            {rule.require_app_prepay && (
              <div className="flex items-center gap-2 pl-6">
                <span className="text-[11px] uppercase tracking-wider text-gray-3">
                  Sinal
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={rule.prepay_pct}
                  onChange={(e) =>
                    setRule({
                      ...rule,
                      prepay_pct: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                    })
                  }
                  className="w-20 bg-bg-1 border border-gray-4 rounded-[8px] text-white text-sm px-2 py-1.5 outline-none focus:border-pink text-right"
                />
                <span className="text-sm text-gray-2">%</span>
              </div>
            )}
          </div>

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-gray-3">
              Observação para o cliente (opcional)
            </span>
            <textarea
              value={rule.notes}
              onChange={(e) => setRule({ ...rule, notes: e.target.value })}
              rows={2}
              maxLength={500}
              placeholder="Ex.: Sinal de 50% no agendamento. Restante na entrega."
              className="w-full mt-1.5 bg-bg-1 border border-gray-4 rounded-[10px] text-white text-sm px-3 py-2 outline-none resize-none focus:border-pink placeholder:text-gray-3"
            />
          </label>
        </div>
      </details>
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-pink shrink-0"
      />
      <span className="text-gray-2 leading-tight">{label}</span>
    </label>
  );
}
