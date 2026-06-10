import { getProducts, getOrders, getPartnerStores } from "../actions";
import { ProductList } from "./product-list";
import { OrderList } from "./order-list";
import { ProductForm } from "./product-form";
import Link from "next/link";
import { Store } from "lucide-react";
import type { ComponentProps } from "react";

type OrderListOrders = ComponentProps<typeof OrderList>["orders"];

export const metadata = { title: "Loja" };

export default async function AdminLojaPage() {
  const [products, ordersData, partnerStores] = await Promise.all([
    getProducts(),
    getOrders(),
    getPartnerStores(),
  ]);

  const orders = (ordersData || []) as unknown as OrderListOrders;

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      {/* Produtos */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl text-white">LOJA KATH</h1>
            <p className="text-gray-2 text-sm mt-1">
              Produtos físicos da marca — stickers, camisetas, acessórios.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/loja/parceiros"
              className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 border border-gray-4 text-gray-2 rounded-full hover:border-gray-3 hover:text-white transition-colors"
            >
              <Store size={14} />
              Lojas Parceiras
              {partnerStores.length > 0 && (
                <span className="bg-bg-3 text-gray-2 rounded-full px-1.5 py-0.5 text-[10px] font-mono">
                  {partnerStores.length}
                </span>
              )}
            </Link>
            <ProductForm partnerStores={partnerStores} />
          </div>
        </div>
        <ProductList products={products} partnerStores={partnerStores} />
      </section>

      {/* Pedidos */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl text-white">PEDIDOS</h2>
        <OrderList orders={orders} />
      </section>
    </div>
  );
}
