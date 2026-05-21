"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart2,
  Bike,
  Flame,
  ShoppingBag,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const interests = [
  { value: "treinos", label: "Treinos", desc: "Vídeos e programas", icon: BarChart2 },
  { value: "consultoria", label: "Consultoria", desc: "Treino + dieta", icon: Flame },
  { value: "moto", label: "Mundo Moto", desc: "Produtos e cupons", icon: Bike },
  { value: "loja", label: "Loja Kath", desc: "Produtos da marca", icon: ShoppingBag },
];

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function toggleInterest(value: string) {
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, interests: selected }),
      });
      toast.success("Perfil configurado!", {
        style: { borderLeft: "3px solid #00FF88" },
      });
      router.push("/dashboard");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex justify-center gap-2">
        <div className={cn("w-8 h-1 rounded-full", step >= 1 ? "bg-pink" : "bg-gray-4")} />
        <div className={cn("w-8 h-1 rounded-full", step >= 2 ? "bg-pink" : "bg-gray-4")} />
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <Input
            label="Seu telefone (WhatsApp)"
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            hint="Usado para contato sobre sua consultoria"
          />
          <Button
            size="lg"
            className="w-full"
            onClick={() => setStep(2)}
            disabled={!phone.trim()}
          >
            Continuar
            <ArrowRight size={16} />
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <p className="text-center text-gray-2 text-[14px]">
            O que mais te interessa no KathApp?
          </p>

          <div className="grid grid-cols-2 gap-3">
            {interests.map((item) => {
              const active = selected.includes(item.value);
              return (
                <button
                  key={item.value}
                  onClick={() => toggleInterest(item.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-5 rounded-[14px] border transition-all duration-150",
                    active
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-[14px] flex items-center justify-center border transition-all",
                      active
                        ? "bg-pink/20 border-pink/30"
                        : "bg-bg-2 border-gray-4"
                    )}
                  >
                    <item.icon
                      size={24}
                      strokeWidth={active ? 2 : 1.6}
                      className={active ? "stroke-pink" : "stroke-gray-3"}
                    />
                  </div>
                  <div className="font-bold text-[14px]">{item.label}</div>
                  <div className="text-[11px] text-gray-3">{item.desc}</div>
                </button>
              );
            })}
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" size="lg" onClick={() => setStep(1)} className="flex-1">
              Voltar
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={handleSubmit}
              disabled={loading || selected.length === 0}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {loading ? "Salvando..." : "Começar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
