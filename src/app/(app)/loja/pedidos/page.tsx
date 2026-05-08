import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Package, ArrowLeft, ExternalLink, Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Meus Pedidos",
  description: "Acompanhe o status dos seus pedidos na loja KathApp — rastreamento, histórico e detalhes.",
};

interface OrderItem {
  quantity: number;
  title: string;
}

interface Order {
  id: string;
  created_at: string;
  status: "pending" | "paid" | "shipped" | "delivered" | "canceled";
  items: OrderItem[];
  total_cents: number;
  tracking_code?: string | null;
}

function formatBRCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function formatBRDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getStatusInfo(status: string) {
  const statusMap: Record<
    string,
    { label: string; variant: "yellow" | "pink" | "green" | "dark" | "white"; color: string }
  > = {
    pending: { label: "Pendente", variant: "yellow", color: "text-yellow" },
    paid: { label: "Pago", variant: "pink", color: "text-pink" },
    shipped: { label: "Enviado", variant: "green", color: "text-success" },
    delivered: { label: "Entregue", variant: "green", color: "text-success" },
    canceled: { label: "Cancelado", variant: "dark", color: "text-gray-1" },
  };
  return statusMap[status] || { label: "Desconhecido", variant: "white", color: "text-gray-2" };
}

function Timeline({ status }: { status: string }) {
  const steps = ["Pedido", "Pago", "Enviado", "Entregue"];
  const statusOrder: Record<string, number> = {
    pending: 0,
    paid: 1,
    shipped: 2,
    delivered: 3,
    canceled: -1,
  };

  const currentStep = statusOrder[status] ?? -1;
  const isCanceled = status === "canceled";

  if (isCanceled) {
    return null;
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-4">
      <p className="text-[11px] font-semibold text-gray-3 uppercase tracking-[0.08em] mb-3">
        Progresso
      </p>
      <div className="flex items-center justify-between gap-2">
        {steps.map((step, index) => (
          <div key={step} className="flex-1 flex flex-col items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                index <= currentStep
                  ? "bg-pink border-pink text-white"
                  : "border-gray-4 bg-bg-2 text-gray-3"
              }`}
            >
              {index <= currentStep ? (
                <Check size={16} />
              ) : (
                <span className="text-[11px] font-semibold">{index + 1}</span>
              )}
            </div>
            <span className={`text-[10px] font-semibold text-center ${
              index <= currentStep ? "text-white" : "text-gray-3"
            }`}>
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function MeusPedidosPage() {
  const { userId } = await auth();
  const supabase = await createServerSupabaseClient();

  if (!userId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center py-20">
          <p className="text-gray-2">É necessário estar autenticado para ver seus pedidos.</p>
        </div>
      </div>
    );
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId!)
    .order("created_at", { ascending: false });

  const typedOrders = (orders || []) as unknown as Order[];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header with back link */}
      <div>
        <Link
          href="/loja"
          className="inline-flex items-center gap-2 text-pink text-sm font-semibold mb-4 hover:text-pink-light transition-colors"
        >
          <ArrowLeft size={16} />
          Voltar à loja
        </Link>
        <h1 className="font-display text-4xl lg:text-5xl text-white">
          MEUS <span className="text-pink">PEDIDOS</span>
        </h1>
        <p className="text-gray-2 text-sm mt-1">
          Acompanhe o status de seus pedidos e receba seus produtos.
        </p>
      </div>

      {/* Empty state */}
      {typedOrders.length === 0 ? (
        <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-12 text-center">
          <Package size={48} className="stroke-gray-3 mx-auto mb-4" />
          <h2 className="font-display text-2xl text-white mb-2">NENHUM PEDIDO AINDA</h2>
          <p className="text-gray-2 mb-6">
            Você ainda não realizou nenhum pedido. Confira nossa loja e encontre produtos exclusivos.
          </p>
          <Link
            href="/loja"
            className="inline-flex items-center gap-2 font-body font-semibold text-sm px-7 py-3 bg-pink text-white rounded-full hover:bg-pink-light transition-all duration-200"
          >
            Explorar Loja
          </Link>
        </div>
      ) : (
        /* Orders grid */
        <div className="space-y-4">
          {typedOrders.map((order) => {
            const statusInfo = getStatusInfo(order.status);
            const orderDate = formatBRDate(order.created_at);
            const orderId = order.id.substring(0, 8).toUpperCase();
            const hasTracking = order.tracking_code && order.tracking_code.trim() !== "";

            return (
              <div
                key={order.id}
                className="bg-bg-1 border border-gray-4 rounded-[22px] p-6 hover:border-pink/30 transition-colors"
              >
                {/* Header with ID, date, and status */}
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h3 className="font-display text-lg text-white">
                      Pedido #{orderId}
                    </h3>
                    <p className="text-gray-3 text-[13px] mt-1">{orderDate}</p>
                  </div>
                  <Badge variant={statusInfo.variant}>
                    {statusInfo.label}
                  </Badge>
                </div>

                {/* Items list */}
                <div className="space-y-2 mb-6 pb-6 border-b border-gray-4">
                  {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
                    (order.items as unknown as OrderItem[]).map((item, idx) => (
                      <div key={idx} className="flex items-start justify-between">
                        <div>
                          <p className="text-white text-sm">
                            <span className="font-mono font-semibold">{item.quantity}x</span> {item.title}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-3 text-sm">Nenhum item registrado</p>
                  )}
                </div>

                {/* Total */}
                <div className="mb-6 pb-6 border-b border-gray-4">
                  <p className="text-gray-3 text-[12px] uppercase tracking-[0.08em] font-semibold mb-2">
                    Total
                  </p>
                  <p className="font-display text-2xl text-white">
                    {formatBRCurrency(order.total_cents)}
                  </p>
                </div>

                {/* Tracking code if available */}
                {hasTracking && (
                  <div className="mb-6 pb-6 border-b border-gray-4">
                    <p className="text-gray-3 text-[12px] uppercase tracking-[0.08em] font-semibold mb-2">
                      Código de rastreamento
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-white bg-bg-2 px-3 py-2 rounded-lg text-sm">
                        {order.tracking_code}
                      </code>
                      <a
                        href={`https://www.rastreio.com.br/${order.tracking_code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-10 h-10 rounded-lg bg-pink/10 border border-pink/30 text-pink hover:bg-pink/20 transition-colors"
                        title="Rastrear pacote"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <Timeline status={order.status} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
