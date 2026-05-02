import { getProducts, getOrders } from "../actions";
import { ProductList } from "./product-list";
import { OrderList } from "./order-list";
import { ProductForm } from "./product-form";

export const metadata = { title: "Loja" };

export default async function AdminLojaPage() {
  const [products, ordersData] = await Promise.all([getProducts(), getOrders()]);

  const orders = (ordersData || []) as unknown as any[];

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
          <ProductForm />
        </div>
        <ProductList products={products} />
      </section>

      {/* Pedidos */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl text-white">PEDIDOS</h2>
        <OrderList orders={orders} />
      </section>
    </div>
  );
}
