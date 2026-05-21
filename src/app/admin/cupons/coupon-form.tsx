"use client";

import { useState } from "react";
import { createCoupon } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CouponForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await createCoupon(formData);
      setOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="inline-flex items-center justify-center gap-2 font-body font-semibold text-xs px-5 py-2 bg-pink text-white rounded-full shadow-pink hover:bg-pink-light transition-all duration-200 cursor-pointer"
      >
        <Plus size={16} />
        Novo Cupom
      </DialogTrigger>
      <DialogContent className="bg-bg-1 border-gray-4 max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white">
            CRIAR CUPOM
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <Input
            name="title"
            label="Título da promoção"
            placeholder="Ex: 10% OFF em capacetes LS2"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              name="code"
              label="Código do cupom"
              placeholder="Ex: KATH15"
              required
            />
            <Input
              name="discount_pct"
              label="Desconto (%)"
              type="number"
              placeholder="15"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              name="partner_name"
              label="Marca parceira"
              placeholder="Ex: LS2 Helmets"
              required
            />
            <Input
              name="partner_url"
              label="URL do parceiro"
              placeholder="https://loja.com"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
                Módulo
              </label>
              <Select name="module" defaultValue="geral">
                <SelectTrigger className="bg-bg-1 border-gray-4 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-2 border-gray-4">
                  <SelectItem value="fitness">Fitness</SelectItem>
                  <SelectItem value="moto">Moto</SelectItem>
                  <SelectItem value="geral">Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
                Plano mínimo
              </label>
              <Select name="required_plan" defaultValue="start">
                <SelectTrigger className="bg-bg-1 border-gray-4 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-2 border-gray-4">
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="start">Start</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              name="valid_until"
              label="Válido até"
              type="datetime-local"
              required
            />
            <Input
              name="max_uses"
              label="Limite de usos"
              type="number"
              placeholder="Ilimitado"
            />
          </div>
          <input type="hidden" name="is_flash" value="false" />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Criando..." : "Criar Cupom"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
