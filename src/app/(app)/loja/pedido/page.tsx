import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { PaymentPanel } from "./payment-panel";

export const metadata: Metadata = {
  title: "Confirmação do Pedido",
  description: "Realize o pagamento do seu pedido via Pix.",
};

interface Props {
  searchParams: Promise<{ id?: string }>;
}

export default async function PedidoPage({ searchParams }: Props) {
  const { id: orderId } = await searchParams;
  const { userId } = await auth();

  if (!userId || !orderId) {
    redirect("/loja");
  }

  // Admin + filtro user_id (lookup do proprio pedido por id).
  const supabase = createAdminSupabaseClient();

  const { data: orderData } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", userId)
    .single();

  if (!orderData) {
    redirect("/loja/pedidos");
  }

  // Type assertion needed until Supabase types are auto-generated
  const order = orderData as unknown as {
    id: string;
    items: Array<{ title: string; quantity: number; price_cents: number }>;
    total_cents: number;
    shipping_cost_cents: number;
    shipping_method: string | null;
    status: string;
  };

  const items = order.items || [];
  const shortId = order.id.substring(0, 8).toUpperCase();
  const isPaid = order.status !== "pending";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Link
        href="/loja"
        className="inline-flex items-center gap-2 text-pink text-sm font-semibold hover:text-pink-light transition-colors"
      >
        <ArrowLeft size={16} />
        Voltar à loja
      </Link>

      {/* Order Confirmed Header */}
      <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-6">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle size={28} className="stroke-green-400" />
          <div>
            <h1 className="font-display text-2xl text-white">
              PEDIDO #{shortId}
            </h1>
            <p className="text-gray-3 text-sm">
              {isPaid
                ? "Pagamento confirmado!"
                : "Pedido criado. Realize o pagamento abaixo."}
            </p>
          </div>
        </div>

        {/* Items summary */}
        <div className="space-y-2 border-t border-gray-4 pt-4 mt-4">
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-gray-2">
                {item.quantity}x {item.title}
              </span>
              <span className="font-mono text-white">
                R$ {((item.price_cents * item.quantity) / 100).toFixed(2).replace(".", ",")}
              </span>
            </div>
          ))}

          {order.shipping_cost_cents > 0 && (
            <div className="flex justify-between text-sm pt-2 border-t border-gray-4">
              <span className="text-gray-3">
                Frete ({order.shipping_method || "Padrão"})
              </span>
              <span className="font-mono text-gray-2">
                R$ {(order.shipping_cost_cents / 100).toFixed(2).replace(".", ",")}
              </span>
            </div>
          )}

          <div className="flex justify-between pt-3 border-t border-gray-4">
            <span className="text-white font-semibold">Total</span>
            <span className="font-display text-2xl text-pink">
              R$ {(order.total_cents / 100).toFixed(2).replace(".", ",")}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Section */}
      {isPaid ? (
        <div className="bg-green-900/20 border border-green-500/30 rounded-[22px] p-6 text-center">
          <CheckCircle size={48} className="stroke-green-400 mx-auto mb-3" />
          <h2 className="font-display text-xl text-white mb-2">PAGAMENTO CONFIRMADO</h2>
          <p className="text-gray-2 text-sm mb-4">
            Seu pedido está sendo preparado para envio.
          </p>
          <Link
            href="/loja/pedidos"
            className="inline-flex items-center gap-2 font-body font-semibold text-sm px-7 py-3 bg-pink text-white rounded-full hover:bg-pink-light transition-all"
          >
            Ver Meus Pedidos
          </Link>
        </div>
      ) : (
        <PaymentPanel orderId={order.id} totalCents={order.total_cents} />
      )}
    </div>
  );
}
