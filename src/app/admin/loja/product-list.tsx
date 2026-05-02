"use client";

import { toggleProductActive, deleteProduct } from "../actions";
import { ProductForm } from "./product-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleLeft, ToggleRight, ShoppingBag, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ProductRow {
  id: string;
  title: string;
  image_url: string;
  price_cents: number;
  compare_price: number | null;
  category: string;
  module: string;
  stock: number;
  description: string | null;
  is_active: boolean;
  discount_start: number;
  discount_pro: number;
  discount_vip: number;
  weight_kg: number | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
}

function formatPrice(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export function ProductList({ products }: { products: ProductRow[] }) {
  async function handleDelete(id: string, title: string) {
    if (!confirm(`Deseja deletar o produto "${title}"?`)) return;

    try {
      await deleteProduct(id);
      toast.success("Produto deletado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao deletar produto");
    }
  }

  if (!products.length) {
    return (
      <div className="text-center py-16">
        <ShoppingBag size={48} className="stroke-gray-3 mx-auto mb-4" />
        <p className="text-gray-2">Nenhum produto cadastrado.</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-4 hover:bg-transparent">
            <TableHead className="text-gray-2">Produto</TableHead>
            <TableHead className="text-gray-2">Preço</TableHead>
            <TableHead className="text-gray-2">Estoque</TableHead>
            <TableHead className="text-gray-2">Status</TableHead>
            <TableHead className="text-gray-2 text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => (
            <TableRow key={p.id} className="border-gray-4">
              <TableCell>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-[8px] bg-bg-2 bg-cover bg-center shrink-0 border border-gray-4"
                    style={{ backgroundImage: `url(${p.image_url})` }}
                  />
                  <div>
                    <div className="text-white font-medium text-sm">{p.title}</div>
                    <div className="text-[11px] text-gray-3">{p.category}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="font-mono text-sm text-pink">{formatPrice(p.price_cents)}</div>
                {p.compare_price && (
                  <div className="font-mono text-[11px] text-gray-3 line-through">
                    {formatPrice(p.compare_price)}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <span className={`font-mono text-sm ${p.stock > 0 ? "text-gray-1" : "text-danger"}`}>
                  {p.stock}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={p.is_active ? "green" : "dark"}>
                  {p.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="icon" size="icon" className="w-8 h-8"
                    onClick={() => toggleProductActive(p.id, !p.is_active)}
                  >
                    {p.is_active ? <ToggleRight size={16} className="text-success" /> : <ToggleLeft size={16} />}
                  </Button>
                  <ProductForm product={p}>
                    <Button variant="icon" size="icon" className="w-8 h-8">
                      <Pencil size={16} className="text-pink" />
                    </Button>
                  </ProductForm>
                  <Button
                    variant="icon"
                    size="icon"
                    className="w-8 h-8 rounded-full"
                    onClick={() => handleDelete(p.id, p.title)}
                  >
                    <Trash2 size={16} className="text-danger" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
