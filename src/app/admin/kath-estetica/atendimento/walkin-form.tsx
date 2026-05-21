"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizePlate, parsePlate, formatPlate } from "@/lib/estetica/plates";
import { extractPlate, hasOCRProvider } from "@/lib/estetica/ocr";
import { createWalkinService, lookupVehicleByPlate, loadServicePricing } from "../actions";
import type { EsteticaVehicleType, ServicePricing } from "@/lib/estetica/pricing-types";
import { PlateInput } from "@/components/ui/plate-input";

interface ServiceOption {
  id: string;
  title: string;
  price_cents: number;
}

interface ExistingMatch {
  plate: string;
  vehicle: { id: string; brand: string | null; model: string | null; color: string | null; year: number | null };
  customer: { id: string; full_name: string; phone: string; cpf: string | null; email: string | null };
}

const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_debito", label: "Débito" },
  { value: "cartao_credito", label: "Crédito" },
  { value: "transferencia", label: "Transferência" },
  { value: "outro", label: "Outro" },
];

const PAYMENT_STATUSES = [
  { value: "pago", label: "Pago" },
  { value: "pendente", label: "Pendente" },
  { value: "isento", label: "Isento" },
];

export function WalkinForm({
  services,
  vehicleTypes,
}: {
  services: ServiceOption[];
  vehicleTypes: EsteticaVehicleType[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [plate, setPlate] = useState("");
  const [plateValid, setPlateValid] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [lookupRunning, setLookupRunning] = useState(false);
  const [match, setMatch] = useState<ExistingMatch | null>(null);
  const [motoPreview, setMotoPreview] = useState<string | null>(null);
  const [platePreview, setPlatePreview] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string>("");
  const [vehicleTypeId, setVehicleTypeId] = useState<string>("");
  const [priceCents, setPriceCents] = useState<string>("");
  const [pricing, setPricing] = useState<ServicePricing | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  useEffect(() => {
    const normalized = normalizePlate(plate);
    setPlateValid(parsePlate(normalized) !== null);
  }, [plate]);

  useEffect(() => {
    return () => {
      if (motoPreview) URL.revokeObjectURL(motoPreview);
      if (platePreview) URL.revokeObjectURL(platePreview);
    };
  }, [motoPreview, platePreview]);

  function handlePlatePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (platePreview) URL.revokeObjectURL(platePreview);
    setPlatePreview(URL.createObjectURL(file));

    if (!hasOCRProvider()) return;
    setOcrRunning(true);
    extractPlate(file)
      .then((detected) => {
        if (detected) {
          setPlate(detected);
          toast.success(`Placa detectada: ${formatPlate(detected)}`);
        } else {
          toast.message("OCR não detectou — digite a placa manualmente.");
        }
      })
      .finally(() => setOcrRunning(false));
  }

  function handleMotoPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (motoPreview) URL.revokeObjectURL(motoPreview);
    setMotoPreview(URL.createObjectURL(file));
  }

  function handlePlateBlur() {
    const normalized = normalizePlate(plate);
    if (normalized !== plate) setPlate(normalized);
    if (parsePlate(normalized)) runLookup(normalized);
  }

  function runLookup(p: string) {
    setLookupRunning(true);
    lookupVehicleByPlate(p)
      .then((found) => {
        setMatch(found);
        if (found) toast.success(`Veículo encontrado: ${found.customer.full_name}`);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Falha ao buscar veículo");
      })
      .finally(() => setLookupRunning(false));
  }

  function handleServiceChange(id: string) {
    setServiceId(id);
    setVehicleTypeId("");
    setPricing(null);
    setPriceCents("");
    if (!id) return;

    setPricingLoading(true);
    loadServicePricing(id)
      .then((p) => {
        setPricing(p);
        // Se há apenas 1 opção, pré-seleciona
        if (p.options.length === 1) {
          const only = p.options[0];
          setVehicleTypeId(only.vehicle_type.id);
          setPriceCents(String(only.price_cents));
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error("Falha ao carregar matriz de preços");
        // Fallback: usa preço base do serviço
        const svc = services.find((s) => s.id === id);
        if (svc) setPriceCents(String(svc.price_cents));
      })
      .finally(() => setPricingLoading(false));
  }

  function handleVehicleTypeChange(id: string) {
    setVehicleTypeId(id);
    if (!id || !pricing) return;
    const opt = pricing.options.find((o) => o.vehicle_type.id === id);
    if (opt) setPriceCents(String(opt.price_cents));
  }

  // Tipos disponíveis para o serviço selecionado (matriz). Se nenhum serviço
  // selecionado, mostra todos os tipos cadastrados (entrada manual de preço).
  const availableVehicleTypes = useMemo<EsteticaVehicleType[]>(() => {
    if (!pricing || pricing.options.length === 0) return vehicleTypes;
    return pricing.options.map((o) => o.vehicle_type);
  }, [pricing, vehicleTypes]);

  const priceByVehicleType = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    pricing?.options.forEach((o) => map.set(o.vehicle_type.id, o.price_cents));
    return map;
  }, [pricing]);

  const paymentRule = pricing?.payment_rule ?? null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;

    const fd = new FormData(form);
    // Normaliza placa antes de enviar (defesa em profundidade — server também normaliza)
    fd.set("plate", normalizePlate(plate));

    startTransition(async () => {
      try {
        const res = await createWalkinService(fd);
        toast.success(
          res.isNewVehicle
            ? "Atendimento criado (cliente novo)"
            : "Atendimento criado (cliente recorrente)",
        );
        form.reset();
        setPlate("");
        setMatch(null);
        setServiceId("");
        setVehicleTypeId("");
        setPricing(null);
        setPriceCents("");
        if (motoPreview) URL.revokeObjectURL(motoPreview);
        if (platePreview) URL.revokeObjectURL(platePreview);
        setMotoPreview(null);
        setPlatePreview(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao registrar");
      }
    });
  }

  const plateFormatted = useMemo(() => formatPlate(plate), [plate]);

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="bg-bg-1 border border-gray-4 rounded-[22px] p-6 space-y-6"
    >
      {/* Fotos + placa */}
      <div>
        <h2 className="font-display text-xl text-white mb-3">1. CHEGADA DA MOTO</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <PhotoUploader
            name="moto_photo"
            label="Foto geral da moto"
            preview={motoPreview}
            onChange={handleMotoPhoto}
          />
          <PhotoUploader
            name="plate_photo"
            label="Foto da placa"
            preview={platePreview}
            onChange={handlePlatePhoto}
            badge={ocrRunning ? "Lendo placa..." : hasOCRProvider() ? "OCR ativo" : "OCR desativado"}
          />
        </div>

        <div className="mt-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-gray-2">
              Placa {plate && plateValid ? <span className="text-pink">· {plateFormatted}</span> : null}
            </span>
            <div className="relative mt-1.5">
              <PlateInput
                name="plate"
                value={plate}
                onValueChange={setPlate}
                onBlur={handlePlateBlur}
                className="w-full bg-bg-base border border-gray-4 rounded-[14px] px-4 py-3 text-white font-mono placeholder:text-gray-3 focus:border-pink outline-none"
              />
              {(ocrRunning || lookupRunning) && (
                <Loader2
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-pink"
                />
              )}
              {!ocrRunning && !lookupRunning && plateValid && (
                <button
                  type="button"
                  onClick={() => runLookup(normalizePlate(plate))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-pink hover:bg-pink/10 rounded-md p-1.5"
                  aria-label="Buscar veículo"
                >
                  <Search size={16} />
                </button>
              )}
            </div>
            <span className="text-[11px] text-gray-3 mt-1 block">
              Mercosul (ABC1D23) ou antigo (ABC1234). A placa é normalizada automaticamente.
            </span>
          </label>
        </div>

        {match && (
          <div className="mt-4 border border-pink/30 bg-pink/5 rounded-[14px] p-3">
            <div className="text-xs uppercase tracking-wider text-pink mb-1">Veículo já cadastrado</div>
            <div className="text-sm text-white">
              {match.customer.full_name} · {match.customer.phone}
            </div>
            {(match.vehicle.brand || match.vehicle.model) && (
              <div className="text-xs text-gray-2 mt-0.5">
                {[match.vehicle.brand, match.vehicle.model, match.vehicle.color, match.vehicle.year]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
            <button
              type="button"
              onClick={() => setMatch(null)}
              className="text-xs text-gray-3 hover:text-white mt-2"
            >
              Limpar e cadastrar como novo
            </button>
          </div>
        )}
      </div>

      {/* Cliente */}
      <div>
        <h2 className="font-display text-xl text-white mb-3">2. CLIENTE</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            name="customer_name"
            label="Nome do cliente"
            defaultValue={match?.customer.full_name || ""}
            required
            key={`name-${match?.customer.id || "new"}`}
          />
          <Field
            name="customer_phone"
            label="Telefone / WhatsApp"
            defaultValue={match?.customer.phone || ""}
            required
            key={`phone-${match?.customer.id || "new"}`}
          />
          <Field
            name="customer_cpf"
            label="CPF (opcional)"
            defaultValue={match?.customer.cpf || ""}
            key={`cpf-${match?.customer.id || "new"}`}
          />
          <Field
            name="customer_email"
            label="E-mail (opcional)"
            type="email"
            defaultValue={match?.customer.email || ""}
            key={`email-${match?.customer.id || "new"}`}
          />
        </div>
      </div>

      {/* Veículo */}
      <div>
        <h2 className="font-display text-xl text-white mb-3">3. MOTO</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            name="vehicle_brand"
            label="Marca"
            defaultValue={match?.vehicle.brand || ""}
            key={`brand-${match?.vehicle.id || "new"}`}
          />
          <Field
            name="vehicle_model"
            label="Modelo"
            defaultValue={match?.vehicle.model || ""}
            key={`model-${match?.vehicle.id || "new"}`}
          />
          <Field
            name="vehicle_color"
            label="Cor"
            defaultValue={match?.vehicle.color || ""}
            key={`color-${match?.vehicle.id || "new"}`}
          />
          <Field
            name="vehicle_year"
            label="Ano"
            type="number"
            inputMode="numeric"
            defaultValue={match?.vehicle.year ? String(match.vehicle.year) : ""}
            key={`year-${match?.vehicle.id || "new"}`}
          />
        </div>
      </div>

      {/* Serviço + pagamento */}
      <div>
        <h2 className="font-display text-xl text-white mb-3">4. SERVIÇO E PAGAMENTO</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-gray-2">
              Serviço {pricingLoading && <Loader2 size={11} className="inline animate-spin text-pink ml-1" />}
            </span>
            <select
              name="service_id"
              value={serviceId}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="w-full mt-1.5 bg-bg-base border border-gray-4 rounded-[14px] px-3 py-2.5 text-white focus:border-pink outline-none"
            >
              <option value="">Sem serviço (avulso)</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-gray-2">
              Tipo da moto
              {pricing && pricing.options.length > 0 && (
                <span className="ml-1 text-pink normal-case">
                  · {pricing.options.length} opção{pricing.options.length === 1 ? "" : "es"}
                </span>
              )}
            </span>
            <select
              name="vehicle_type_id"
              value={vehicleTypeId}
              onChange={(e) => handleVehicleTypeChange(e.target.value)}
              className="w-full mt-1.5 bg-bg-base border border-gray-4 rounded-[14px] px-3 py-2.5 text-white focus:border-pink outline-none"
            >
              <option value="">Não classificar</option>
              {availableVehicleTypes.map((t) => {
                const price = priceByVehicleType.get(t.id);
                return (
                  <option key={t.id} value={t.id}>
                    {t.label}
                    {price !== undefined ? ` · R$ ${(price / 100).toFixed(2)}` : ""}
                  </option>
                );
              })}
            </select>
          </label>

          <Field
            label="Preço cobrado (centavos)"
            name="price_cents"
            type="number"
            inputMode="numeric"
            value={priceCents}
            onChange={(v) => setPriceCents(v)}
            required
            hint={
              vehicleTypeId && priceByVehicleType.has(vehicleTypeId)
                ? "Vindo da matriz oficial — pode ajustar."
                : "Ex.: 5000 = R$ 50,00"
            }
          />
          <Select
            label="Forma de pagamento"
            name="payment_method"
            defaultValue="dinheiro"
            options={PAYMENT_METHODS}
          />
          <Select
            label="Status do pagamento"
            name="payment_status"
            defaultValue="pago"
            options={PAYMENT_STATUSES}
          />
        </div>

        {paymentRule && (paymentRule.require_app_prepay || paymentRule.notes) && (
          <div className="mt-3 border border-pink/30 bg-pink/5 rounded-[14px] p-3 text-xs text-gray-2">
            {paymentRule.require_app_prepay && (
              <div className="text-pink mb-1">
                Sinal de {paymentRule.prepay_pct}% obrigatório no agendamento via app.
              </div>
            )}
            {paymentRule.notes && <div>{paymentRule.notes}</div>}
          </div>
        )}

        <label className="block mt-3">
          <span className="text-xs uppercase tracking-wider text-gray-2">Observações</span>
          <textarea
            name="notes"
            rows={3}
            placeholder="Avarias, pedido específico, status visual..."
            className="w-full mt-1.5 bg-bg-base border border-gray-4 rounded-[14px] px-3 py-2.5 text-white placeholder:text-gray-3 focus:border-pink outline-none resize-none"
          />
        </label>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" disabled={pending || !plateValid}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {pending ? "Registrando..." : "Registrar atendimento"}
        </Button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// helpers visuais (inline para combinar com o resto do admin)

function Field(props: {
  name: string;
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  required?: boolean;
  type?: string;
  inputMode?: "numeric" | "text" | "tel" | "email";
  hint?: string;
}) {
  const controlled = props.value !== undefined;
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-gray-2">
        {props.label}
        {props.required && <span className="text-pink ml-1">*</span>}
      </span>
      <input
        name={props.name}
        type={props.type || "text"}
        inputMode={props.inputMode}
        required={props.required}
        defaultValue={controlled ? undefined : props.defaultValue}
        value={controlled ? props.value : undefined}
        onChange={controlled ? (e) => props.onChange?.(e.target.value) : undefined}
        autoComplete="off"
        className="w-full mt-1.5 bg-bg-base border border-gray-4 rounded-[14px] px-3 py-2.5 text-white placeholder:text-gray-3 focus:border-pink outline-none"
      />
      {props.hint && <span className="text-[11px] text-gray-3 mt-1 block">{props.hint}</span>}
    </label>
  );
}

function Select(props: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-gray-2">{props.label}</span>
      <select
        name={props.name}
        defaultValue={props.defaultValue}
        className="w-full mt-1.5 bg-bg-base border border-gray-4 rounded-[14px] px-3 py-2.5 text-white focus:border-pink outline-none"
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PhotoUploader(props: {
  name: string;
  label: string;
  preview: string | null;
  badge?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="relative cursor-pointer block group">
      <div className="text-xs uppercase tracking-wider text-gray-2 mb-1.5 flex items-center justify-between">
        <span>{props.label}</span>
        {props.badge && <span className="text-[10px] text-pink/70 normal-case">{props.badge}</span>}
      </div>
      <div className="relative aspect-[4/3] rounded-[14px] border border-dashed border-gray-4 bg-bg-base overflow-hidden flex items-center justify-center group-hover:border-pink/50 transition-colors">
        {props.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.preview} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center text-gray-3 text-xs gap-2">
            <Upload size={20} />
            <span>Tirar ou escolher foto</span>
          </div>
        )}
      </div>
      <input
        type="file"
        name={props.name}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={props.onChange}
      />
    </label>
  );
}
