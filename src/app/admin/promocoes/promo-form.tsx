"use client";

import { useState, ReactNode } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { upsertPromoCode, type PromoCodeRow } from "./actions";

interface Props {
  code?: PromoCodeRow;
  children?: ReactNode;
}

export function PromoForm({ code, children }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      if (code?.id) formData.append("id", code.id);
      await upsertPromoCode(formData);
      toast.success(code ? "Promoção atualizada" : "Promoção criada");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? (
        <DialogTrigger className="cursor-pointer">{children}</DialogTrigger>
      ) : (
        <DialogTrigger className="inline-flex items-center justify-center gap-2 font-body font-semibold text-xs px-5 py-2 bg-pink text-white rounded-full shadow-pink hover:bg-pink-light transition-all duration-200 cursor-pointer">
          <Plus size={16} className="mr-1" />
          Nova promoção
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{code ? "Editar promoção" : "Nova promoção"}</DialogTitle>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Slug"
              name="slug"
              defaultValue={code?.slug ?? "LANCAMENTO"}
              placeholder="LANCAMENTO"
              required
              hint="Caixa alta. Letras, números, _ e -"
            />
            <div>
              <label className="text-xs text-gray-3 block mb-1">Plano</label>
              <select
                name="plan_tier"
                defaultValue={code?.plan_tier ?? "atleta"}
                className="w-full bg-bg-1 border border-gray-4 text-white rounded-md px-3 py-2"
                required
              >
                <option value="start">Treino (Start)</option>
                <option value="evolucao">Evolução</option>
                <option value="saude_completa">Saúde Completa</option>
                <option value="atleta">Atleta</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Valor promo (centavos)"
              name="promo_value_cents"
              type="number"
              min="1"
              defaultValue={code?.promo_value_cents ?? 28490}
              required
              hint="Ex: 28490 = R$ 284,90"
            />
            <Input
              label="Desconto (centavos)"
              name="discount_cents"
              type="number"
              min="0"
              defaultValue={code?.discount_cents ?? 2500}
              hint="Só informativo. Ex: 2500 = R$ 25,00"
            />
          </div>

          <Input
            label="Vagas (max_uses)"
            name="max_uses"
            type="number"
            min="1"
            max="10000"
            defaultValue={code?.max_uses ?? 15}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Início (opcional)"
              name="starts_at"
              type="datetime-local"
              defaultValue={code?.starts_at ? code.starts_at.slice(0, 16) : ""}
            />
            <Input
              label="Fim (opcional)"
              name="ends_at"
              type="datetime-local"
              defaultValue={code?.ends_at ? code.ends_at.slice(0, 16) : ""}
            />
          </div>

          <Input
            label="Descrição"
            name="description"
            defaultValue={code?.description ?? ""}
            placeholder="Promoção de lançamento - R$ 25,00 OFF Atleta"
          />

          <label className="flex items-center gap-2 text-sm text-gray-1">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={code?.is_active ?? true}
              className="w-4 h-4"
            />
            Ativa
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando…" : code ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
