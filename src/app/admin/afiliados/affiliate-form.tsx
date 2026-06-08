"use client";

import { useState } from "react";
import { createAffiliateLink } from "../actions";
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

export function AffiliateForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await createAffiliateLink(formData);
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
        Novo Produto
      </DialogTrigger>
      <DialogContent className="bg-bg-1 border-gray-4 max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white">
            ADICIONAR AFILIADO
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <Input
            name="title"
            label="Nome do produto"
            placeholder="Ex: Capacete LS2 Thunder"
            required
          />
          <Input
            name="image_url"
            label="URL da imagem"
            placeholder="https://..."
            required
          />
          <Input
            name="affiliate_url"
            label="Link de afiliado"
            placeholder="https://amzn.to/..."
            required
          />
          <Input
            name="description"
            label="Por que a Kath recomenda"
            placeholder="Uso diário, proteção top..."
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
                Módulo
              </label>
              <Select name="module" required>
                <SelectTrigger className="bg-bg-1 border-gray-4 text-white">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-bg-2 border-gray-4">
                  <SelectItem value="fitness">Fitness</SelectItem>
                  <SelectItem value="moto">Moto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              name="category"
              label="Categoria"
              placeholder="Ex: capacete, suplemento"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
                Plataforma
              </label>
              <Select name="platform" required>
                <SelectTrigger className="bg-bg-1 border-gray-4 text-white">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-bg-2 border-gray-4">
                  <SelectItem value="amazon">Amazon BR</SelectItem>
                  <SelectItem value="mercadolivre">Mercado Livre</SelectItem>
                  <SelectItem value="shopee">Shopee</SelectItem>
                  <SelectItem value="direto">Parceria Direta</SelectItem>
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
                  <SelectItem value="start">Start</SelectItem>
                  <SelectItem value="evolucao">Evolução</SelectItem>
                  <SelectItem value="saude_completa">Saúde Completa</SelectItem>
                  <SelectItem value="atleta">Atleta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
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
              {loading ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
