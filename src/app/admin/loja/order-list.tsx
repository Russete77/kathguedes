"use client";

import { useState } from "react";
import { updateOrderStatus } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Truck, Check, Tag, ExternalLink, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface Order {
  id: string;
  user_id: string;
  status: string;
  items: { title: string; quantity: number; price_cents: number }[];
  total_cents: number;
  shipping_cost_cents: number | null;
  shipping_method: string | null;
  shipping_label_url: string | null;
  tracking_code: string | null;
  estimated_delivery: string | null;
  created_at: string;
  profiles: { full_name: string };
}

const statusConfig: Record<string, { label: string; variant: "yellow" | "pink" | "green" | "dark" }> = {
  pending: { label: "Pendente", variant: "yellow" },
  paid: { label: "Pago", variant: "pink" },
  shipped: { label: "Enviado", variant: "green" },
  delivered: { label: "Entregue", variant: "green" },
  canceled: { label: "Cancelado", variant: "dark" },
};

function formatPrice(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function GenerateLabelButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/loja/shipping/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Etiqueta gerada!", {
          description: `Código: ${data.tracking_code}`,
          style: { borderLeft: "3px solid #00FF88" },
        });
        // Reload para mostrar tracking code
        window.location.reload();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Erro ao gerar etiqueta");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleGenerate} disabled={loading}>
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Tag size={12} />}
      {loading ? "Gerando..." : "Gerar Etiqueta"}
    </Button>
  );
}

export function OrderList({ orders }: { orders: Order[] }) {
  if (!orders.length) {
    return (
      <div className="text-center py-12">
        <Package size={48} className="stroke-gray-3 mx-auto mb-4" />
        <p className="text-gray-2">Nenhum pedido ainda.</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-4 hover:bg-transparent">
            <TableHead className="text-gray-2">Pedido</TableHead>
            <TableHead className="text-gray-2">Cliente</TableHead>
            <TableHead className="text-gray-2">Itens</TableHead>
            <TableHead className="text-gray-2">Total</TableHead>
            <TableHead className="text-gray-2">Envio</TableHead>
            <TableHead className="text-gray-2">Status</TableHead>
            <TableHead className="text-gray-2 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => {
            const cfg = statusConfig[o.status] || statusConfig.pending;
            const profile = o.profiles as unknown as { full_name: string } | null;
            return (
              <TableRow key={o.id} className="border-gray-4">
                <TableCell className="font-mono text-[11px] text-gray-3">
                  {o.id.slice(0, 8)}...
                  <div className="text-[10px]">
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </TableCell>
                <TableCell className="text-white text-sm">
                  {profile?.full_name || "—"}
                </TableCell>
                <TableCell className="text-gray-2 text-sm">
                  {(o.items as unknown as { title: string; quantity: number; price_cents: number }[]).map((i) => `${i.quantity}x ${i.title}`).join(", ")}
                </TableCell>
                <TableCell className="font-mono text-sm text-pink">
                  {formatPrice(o.total_cents)}
                  {o.shipping_cost_cents != null && o.shipping_cost_cents > 0 && (
                    <div className="text-[10px] text-gray-3">
                      Frete: {formatPrice(o.shipping_cost_cents)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-[12px]">
                  {o.shipping_method && (
                    <div className="text-gray-2">{o.shipping_method}</div>
                  )}
                  {o.estimated_delivery && (
                    <div className="text-gray-3 text-[10px]">{o.estimated_delivery}</div>
                  )}
                  {o.tracking_code && (
                    <div className="font-mono text-[10px] text-pink mt-0.5">
                      {o.tracking_code}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={cfg.variant}>{cfg.label}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1 flex-wrap">
                    {/* Gerar Etiqueta — apenas pedidos pagos sem etiqueta */}
                    {o.status === "paid" && !o.shipping_label_url && (
                      <GenerateLabelButton orderId={o.id} />
                    )}

                    {/* Ver Etiqueta — se já tem URL */}
                    {o.shipping_label_url && (
                      <a
                        href={o.shipping_label_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="ghost">
                          <ExternalLink size={12} /> Etiqueta
                        </Button>
                      </a>
                    )}

                    {/* Marcar como Enviado */}
                    {o.status === "paid" && (
                      <Button size="sm" variant="secondary" onClick={() => updateOrderStatus(o.id, "shipped")}>
                        <Truck size={12} /> Enviar
                      </Button>
                    )}

                    {/* Marcar como Entregue */}
                    {o.status === "shipped" && (
                      <Button size="sm" variant="ghost" onClick={() => updateOrderStatus(o.id, "delivered")}>
                        <Check size={12} /> Entregue
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
