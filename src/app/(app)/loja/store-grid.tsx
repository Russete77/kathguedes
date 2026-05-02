"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Plus, Minus, Trash2, Truck, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ShippingQuote {
  provider: string;
  service_id?: number;
  service: string;
  price_cents: number;
  estimated_days: number;
  estimated_delivery: string;
  logo_url?: string;
}

interface Product {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  price_cents: number;
  compare_price: number | null;
  category: string;
  stock: number;
  weight_kg: number | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  discount_start: number;
  discount_pro: number;
  discount_vip: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

function formatPrice(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function getDiscount(product: Product, plan: string): number {
  if (plan === "vip") return product.discount_vip;
  if (plan === "pro") return product.discount_pro;
  if (plan === "start") return product.discount_start;
  return 0;
}

function discountedPrice(cents: number, discountPct: number): number {
  return Math.round(cents * (1 - discountPct / 100));
}

export function StoreGrid({
  products,
  planTier,
}: {
  products: Product[];
  planTier: string;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Shipping
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState<ShippingQuote | null>(null);
  const [shippingZip, setShippingZip] = useState("");
  const shippingFetchedRef = useRef("");

  // Invalidar frete quando o carrinho muda (peso diferente → cotação diferente)
  useEffect(() => {
    if (shippingQuotes.length > 0 || selectedShipping) {
      setShippingQuotes([]);
      setSelectedShipping(null);
      shippingFetchedRef.current = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.length, cart.map((i) => i.quantity).join(",")]);

  async function fetchShippingQuotes(zip: string) {
    const clean = zip.replace(/\D/g, "");
    if (clean.length !== 8) return;
    shippingFetchedRef.current = clean;
    setShippingLoading(true);
    setSelectedShipping(null);
    setShippingQuotes([]);

    // Enviar dimensões reais dos produtos do carrinho
    const items = cart.map((i) => ({
      weight_kg: (i.product.weight_kg || 0.5) * i.quantity,
      height_cm: i.product.height_cm || 10,
      width_cm: i.product.width_cm || 20,
      length_cm: i.product.length_cm || 30,
    }));

    try {
      const res = await fetch("/api/loja/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip: clean, items }),
      });
      if (res.ok) {
        const data = await res.json();
        setShippingQuotes(data.quotes || []);
        // Auto-select cheapest
        if (data.quotes?.length > 0) {
          setSelectedShipping(data.quotes[0]);
        }
      } else {
        toast.error("Erro ao calcular frete");
      }
    } catch {
      toast.error("Erro de conexão ao calcular frete");
    } finally {
      setShippingLoading(false);
    }
  }

  function formatCep(value: string) {
    const nums = value.replace(/\D/g, "").slice(0, 8);
    if (nums.length > 5) return `${nums.slice(0, 5)}-${nums.slice(5)}`;
    return nums;
  }

  // Persistir carrinho no localStorage
  // Load cart from localStorage after hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kathapp_cart");
      if (saved) {
        setCart(JSON.parse(saved));
      }
    } catch {}
    setCartLoaded(true);
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    if (!cartLoaded) return;
    try {
      if (cart.length > 0) {
        localStorage.setItem("kathapp_cart", JSON.stringify(cart));
      } else {
        localStorage.removeItem("kathapp_cart");
      }
    } catch {}
  }, [cart, cartLoaded]);

  async function handleCheckout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedShipping) {
      toast.error("Selecione uma opção de frete");
      return;
    }
    setCheckoutLoading(true);

    const form = new FormData(e.currentTarget);
    const shippingInfo = {
      name: form.get("name") as string,
      phone: form.get("phone") as string,
      address: form.get("address") as string,
      city: form.get("city") as string,
      state: form.get("state") as string,
      zip: form.get("zip") as string,
    };

    // Server recalcula tudo — cliente só envia product_id + quantity
    const items = cart.map((i) => ({
      product_id: i.product.id,
      quantity: i.quantity,
    }));

    const shippingCents = selectedShipping.price_cents;

    try {
      const res = await fetch("/api/loja/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          shipping_cost_cents: shippingCents,
          shipping_method: selectedShipping.service,
          estimated_delivery: selectedShipping.estimated_delivery,
          shipping_info: shippingInfo,
        }),
      });

      if (res.ok) {
        const { orderId } = await res.json();
        // Limpar carrinho
        setCart([]);
        setShowCheckout(false);
        setShippingQuotes([]);
        setSelectedShipping(null);
        setShippingZip("");
        shippingFetchedRef.current = "";
        // Redirecionar para página de pagamento
        if (orderId) {
          router.push(`/loja/pedido?id=${orderId}`);
        } else {
          toast.success("Pedido realizado!", {
            description: "Acesse 'Meus Pedidos' para ver o status.",
            style: { borderLeft: "3px solid #00FF88" },
          });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Erro ao criar pedido");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setCheckoutLoading(false);
    }
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: Math.min(i.quantity + 1, product.stock) }
            : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    toast.success(`${product.title} adicionado ao carrinho`, {
      style: { borderLeft: "3px solid #FF0080" },
    });
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product.id !== productId) return i;
          const qty = i.quantity + delta;
          if (qty <= 0) return null;
          return { ...i, quantity: Math.min(qty, i.product.stock) };
        })
        .filter(Boolean) as CartItem[]
    );
  }

  const cartTotal = cart.reduce((sum, i) => {
    const disc = getDiscount(i.product, planTier);
    return sum + discountedPrice(i.product.price_cents, disc) * i.quantity;
  }, 0);

  return (
    <div className="space-y-8">
      {/* Product Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {products.map((p) => {
          const disc = getDiscount(p, planTier);
          const finalPrice = discountedPrice(p.price_cents, disc);

          return (
            <div
              key={p.id}
              className="bg-bg-1 border border-gray-4 rounded-[22px] overflow-hidden transition-all duration-200 hover:border-pink/40 hover:-translate-y-0.5 group"
            >
              <div className="h-[200px] bg-bg-2 relative overflow-hidden">
                {p.image_url ? (
                  <Image
                    src={p.image_url}
                    alt={p.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <ShoppingBag size={48} className="stroke-gray-3" />
                  </div>
                )}
                {disc > 0 && (
                  <Badge variant="solid" className="absolute top-3 right-3">
                    -{disc}%
                  </Badge>
                )}
                {p.stock <= 0 && (
                  <div className="absolute inset-0 bg-bg-base/70 flex items-center justify-center">
                    <Badge variant="dark">Esgotado</Badge>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="font-mono text-[10px] text-gray-3 uppercase tracking-[0.1em] mb-1">
                  {p.category}
                </div>
                <h3 className="font-bold text-[15px] text-white mb-2 line-clamp-1">
                  {p.title}
                </h3>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="font-display text-[24px] leading-none text-pink">
                    {formatPrice(finalPrice)}
                  </span>
                  {(p.compare_price || disc > 0) && (
                    <span className="font-mono text-[12px] text-gray-3 line-through">
                      {formatPrice(p.compare_price || p.price_cents)}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => addToCart(p)}
                  disabled={p.stock <= 0}
                >
                  <ShoppingBag size={14} />
                  {p.stock > 0 ? "Adicionar" : "Esgotado"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 sm:w-[340px] bg-bg-1 border border-gray-4 rounded-[22px] p-5 shadow-card z-50">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag size={18} className="stroke-pink" />
            <span className="font-display text-xl text-white">CARRINHO</span>
            <Badge variant="pink" className="ml-auto">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </Badge>
          </div>

          <div className="space-y-3 max-h-[200px] overflow-y-auto mb-4">
            {cart.map((item) => {
              const disc = getDiscount(item.product, planTier);
              const price = discountedPrice(item.product.price_cents, disc);
              return (
                <div key={item.product.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-white text-[13px] font-medium line-clamp-1">
                      {item.product.title}
                    </div>
                    <div className="font-mono text-[11px] text-pink">
                      {formatPrice(price)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-bg-3 text-gray-2 hover:text-white"
                    >
                      {item.quantity === 1 ? <Trash2 size={10} /> : <Minus size={10} />}
                    </button>
                    <span className="font-mono text-[13px] text-white w-6 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-bg-3 text-gray-2 hover:text-white"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-gray-4 pt-3 flex items-center justify-between mb-3">
            <span className="text-gray-2 text-sm">Total</span>
            <span className="font-display text-[28px] leading-none text-pink">
              {formatPrice(cartTotal)}
            </span>
          </div>

          <Button size="lg" className="w-full" onClick={() => setShowCheckout(true)}>
            Finalizar Compra
          </Button>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCheckout(false)} />
          <div className="relative bg-bg-1 border border-gray-4 rounded-[22px] p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="font-display text-2xl text-white mb-4">DADOS DE ENTREGA</h3>
            <form onSubmit={handleCheckout} className="space-y-3">
              <input name="name" placeholder="Nome completo" required className="w-full bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[14px] px-4 py-3 outline-none focus:border-pink placeholder:text-gray-3" />
              <input name="phone" placeholder="Telefone (WhatsApp)" required className="w-full bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[14px] px-4 py-3 outline-none focus:border-pink placeholder:text-gray-3" />
              <input name="address" placeholder="Endereço completo" required className="w-full bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[14px] px-4 py-3 outline-none focus:border-pink placeholder:text-gray-3" />
              <div className="grid grid-cols-2 gap-3">
                <input name="city" placeholder="Cidade" required className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[14px] px-4 py-3 outline-none focus:border-pink placeholder:text-gray-3" />
                <input name="state" placeholder="Estado" required className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[14px] px-4 py-3 outline-none focus:border-pink placeholder:text-gray-3" />
              </div>

              {/* CEP + Calcular Frete */}
              <div className="flex gap-2">
                <input
                  name="zip"
                  placeholder="CEP"
                  required
                  value={shippingZip}
                  onChange={(e) => setShippingZip(formatCep(e.target.value))}
                  className="flex-1 bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[14px] px-4 py-3 outline-none focus:border-pink placeholder:text-gray-3"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  disabled={shippingLoading || shippingZip.replace(/\D/g, "").length !== 8}
                  onClick={() => fetchShippingQuotes(shippingZip)}
                  className="shrink-0"
                >
                  {shippingLoading ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
                  {shippingLoading ? "Calculando..." : "Calcular Frete"}
                </Button>
              </div>

              {/* Shipping Options */}
              {shippingQuotes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-gray-2 text-xs font-medium uppercase tracking-wider">Opções de envio</p>
                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                    {shippingQuotes.map((q, idx) => (
                      <label
                        key={`${q.provider}-${q.service}-${idx}`}
                        className={`flex items-center gap-3 p-3 rounded-[8px] border cursor-pointer transition-colors ${
                          selectedShipping?.service === q.service && selectedShipping?.provider === q.provider
                            ? "border-pink bg-pink/5"
                            : "border-gray-4 bg-bg-2 hover:border-gray-3"
                        }`}
                      >
                        <input
                          type="radio"
                          name="shipping_option"
                          checked={selectedShipping?.service === q.service && selectedShipping?.provider === q.provider}
                          onChange={() => setSelectedShipping(q)}
                          className="sr-only"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-[13px] font-medium truncate">{q.service}</div>
                          <div className="text-gray-3 text-[11px]">{q.estimated_delivery}</div>
                        </div>
                        <div className="font-mono text-[13px] text-pink font-bold shrink-0">
                          {q.price_cents === 0 ? "Grátis" : formatPrice(q.price_cents)}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {shippingQuotes.length === 0 && shippingFetchedRef.current && !shippingLoading && (
                <p className="text-yellow-400 text-xs text-center">
                  Nenhuma opção de frete disponível para este CEP. Tente outro.
                </p>
              )}

              {/* Totais */}
              <div className="border-t border-gray-4 pt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-3 text-xs">Subtotal</span>
                  <span className="font-mono text-sm text-gray-2">{formatPrice(cartTotal)}</span>
                </div>
                {selectedShipping && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-3 text-xs">Frete ({selectedShipping.service})</span>
                    <span className="font-mono text-sm text-gray-2">
                      {selectedShipping.price_cents === 0 ? "Grátis" : formatPrice(selectedShipping.price_cents)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-gray-2 text-sm font-medium">Total</span>
                  <span className="font-display text-[24px] leading-none text-pink">
                    {formatPrice(cartTotal + (selectedShipping?.price_cents || 0))}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="ghost" size="lg" onClick={() => setShowCheckout(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" size="lg" disabled={checkoutLoading || !selectedShipping} className="flex-1">
                  {checkoutLoading ? "Enviando..." : "Confirmar Pedido"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
