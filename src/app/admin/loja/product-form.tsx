"use client";

import { useState, ReactNode } from "react";
import { createProduct, updateProduct } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Product {
  id: string;
  title: string;
  image_url: string;
  price_cents: number;
  cost_cents: number | null;
  compare_price: number | null;
  category: string;
  module: string;
  stock: number;
  description: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
}

interface ProductFormProps {
  product?: Product;
  children?: ReactNode;
}

export function ProductForm({ product, children }: ProductFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEditing = !!product;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      if (isEditing) {
        await updateProduct(product.id, formData);
        toast.success("Produto atualizado com sucesso!");
      } else {
        await createProduct(formData);
        toast.success("Produto criado com sucesso!");
      }
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(isEditing ? "Erro ao atualizar produto" : "Erro ao criar produto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!children ? (
        <DialogTrigger className="inline-flex items-center justify-center gap-2 font-body font-semibold text-xs px-5 py-2 bg-pink text-white rounded-full shadow-pink hover:bg-pink-light transition-all duration-200 cursor-pointer">
          <Plus size={16} />
          Novo Produto
        </DialogTrigger>
      ) : (
        <span onClick={() => setOpen(true)} className="cursor-pointer">
          {children}
        </span>
      )}
      <DialogContent className="bg-bg-1 border-gray-4 max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white">
            {isEditing ? "EDITAR PRODUTO" : "ADICIONAR PRODUTO"}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <Input
            name="title"
            label="Nome do produto"
            placeholder="Ex: Sticker Kath Moto"
            defaultValue={product?.title}
            required
          />
          <Input
            name="image_url"
            label="URL da imagem"
            placeholder="https://..."
            defaultValue={product?.image_url}
            required
          />
          <Input
            name="description"
            label="Descrição"
            placeholder="Adesivo premium..."
            defaultValue={product?.description || ""}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Input
              name="price_cents"
              label="Preço (centavos)"
              type="number"
              min={1}
              placeholder="4990"
              defaultValue={product?.price_cents}
              required
            />
            <Input
              name="compare_price"
              label="De (centavos)"
              type="number"
              min={0}
              placeholder="7990"
              defaultValue={product?.compare_price ?? ""}
            />
            <Input
              name="stock"
              label="Estoque"
              type="number"
              placeholder="100"
              defaultValue={product?.stock}
              required
            />
          </div>
          <label className="block">
            <span className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">Custo do fornecedor (centavos) — CMV</span>
            <Input
              name="cost_cents"
              type="number"
              min={0}
              defaultValue={product?.cost_cents ?? 0}
            />
            <span className="text-xs text-gray-2">Usado no cálculo de margem para comissões. Ex: 12000 = R$ 120,00</span>
          </label>
          {/* Peso e dimensões (frete) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input
              name="weight_kg"
              label="Peso (kg)"
              type="number"
              step="0.01"
              placeholder="0.5"
              defaultValue={product?.weight_kg ?? 0.5}
              required
            />
            <Input
              name="height_cm"
              label="Altura (cm)"
              type="number"
              placeholder="10"
              defaultValue={product?.height_cm ?? 10}
              required
            />
            <Input
              name="width_cm"
              label="Largura (cm)"
              type="number"
              placeholder="20"
              defaultValue={product?.width_cm ?? 20}
              required
            />
            <Input
              name="length_cm"
              label="Compr. (cm)"
              type="number"
              placeholder="30"
              defaultValue={product?.length_cm ?? 30}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              name="category"
              label="Categoria"
              placeholder="sticker, camiseta..."
              defaultValue={product?.category}
              required
            />
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">Módulo</label>
              <Select name="module" defaultValue={product?.module || "geral"}>
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
          </div>
          <div className="rounded-md bg-bg-2 border border-gray-4 p-3 text-sm text-gray-2">
            <strong className="text-gray-1">Descontos por plano:</strong> aplicados automaticamente
            conforme a tabela <a href="/admin/plans" className="underline text-pink">Planos</a>.
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading
                ? (isEditing ? "Salvando..." : "Adicionando...")
                : (isEditing ? "Salvar Alterações" : "Adicionar")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
