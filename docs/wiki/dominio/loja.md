# Setor: Loja

> **2026-05-02 — Atualizações financeiras.** Coluna `cost_cents` (CMV) adicionada a `products`; colunas `discount_start/pro/vip` removidas — desconto agora vem de `plans.store_discount_pct` em runtime via `getStoreDiscountPct(planTier)`. Checkout aceita `use_cashback_cents` (clamp 50% + saldo via `clampCashbackCents`). Coluna `orders.cashback_used_cents` rastreia quanto foi consumido. Cashback é creditado quando admin marca pedido como `delivered` (`updateOrderStatus`). Detalhes em [`docs/wiki/plataforma/financeiro.md`](../plataforma/financeiro.md).

## 1. Visão geral
- **Propósito:** E-commerce de produtos físicos da marca Kath (stickers, camisetas, acessórios, suplementos). Cobre vitrine, carrinho, cotação de frete multi-provedor, checkout com cobrança Pix via Asaas (com cashback opcional aplicado no payload), acompanhamento de pedidos pelo cliente e administração (CRUD de produtos, gestão de pedidos, geração de etiquetas Melhor Envio).
- **Quem usa:** Ambos — usuário final autenticado (vitrine, carrinho, checkout, "Meus Pedidos") e admin (CRUD de produtos, mudança de status, geração de etiquetas).
- **Status percebido:** production (fluxo end-to-end implementado: produtos → carrinho → frete → checkout → Pix Asaas → pagamento → admin envia → tracking). Integrações 99 Entrega e Lalamove ainda estão como stubs (HMAC simplificado, geocoding pendente).

## 2. Rotas
| Path | Arquivo | Tipo | Descrição |
|---|---|---|---|
| `/loja` | `src/app/(app)/loja/page.tsx:19` | Server Component (autenticada) | Vitrine: lista produtos ativos via Supabase, busca `plan_tier` do perfil para aplicar descontos e renderiza `<StoreGrid>`. |
| `/loja` (loading) | `src/app/(app)/loja/loading.tsx:1` | UI fallback | Skeleton da grade de produtos. |
| `/loja/pedido?id=<orderId>` | `src/app/(app)/loja/pedido/page.tsx:18` | Server Component | Tela de confirmação do pedido recém-criado: resumo de itens/frete/total + `<PaymentPanel>` com QR Pix. |
| `/loja/pedidos` | `src/app/(app)/loja/pedidos/page.tsx:101` | Server Component | "Meus Pedidos": histórico com badge de status, total, código de rastreio e timeline visual. |
| `/admin/loja` | `src/app/admin/loja/page.tsx:8` | Server Component (admin) | Dashboard admin: tabela de produtos (`<ProductList>`) com botão `<ProductForm>` e tabela de pedidos (`<OrderList>`). |
| `POST /api/loja/checkout` | `src/app/api/loja/checkout/route.ts:11` | API Route | Cria pedido a partir do carrinho (revalida estoque e preço server-side, decrementa estoque atomicamente). |
| `POST /api/loja/payment` | `src/app/api/loja/payment/route.ts:14` | API Route | Gera cobrança Pix do pedido via Asaas (com fallback para Pix manual). |
| `POST /api/loja/shipping/quote` | `src/app/api/loja/shipping/quote/route.ts:14` | API Route | Cotação agregada de frete (Melhor Envio + 99 Entrega + Lalamove) ordenada por preço. |
| `POST /api/checkout/subscribe` | `src/app/api/checkout/subscribe/route.ts:27` | API Route | **Não pertence à loja física** — cria assinatura recorrente (planos Start/Pro/VIP). Listado por estar em `api/checkout/`. Veja `../plataforma/pagamentos-asaas.md`. |
| `POST /api/checkout/cancel` | `src/app/api/checkout/cancel/route.ts:15` | API Route | **Não pertence à loja física** — cancela assinatura recorrente. Veja `../plataforma/pagamentos-asaas.md`. |

## 3. Componentes
- **`<StoreGrid>`** (`src/app/(app)/loja/store-grid.tsx:59`) — Client Component que renderiza grade de produtos, gerencia carrinho em `localStorage` (`kathapp_cart`), modal de checkout, cálculo de frete (CEP) e submissão para `/api/loja/checkout`. Calcula desconto local conforme `plan_tier` (`getDiscount`/`discountedPrice` em `:48-57`). Auto-seleciona o frete mais barato (`:115`).
- **`<PaymentPanel>`** (`src/app/(app)/loja/pedido/payment-panel.tsx:24`) — Client Component que faz `POST /api/loja/payment` ao montar e renderiza dois modos: `asaas_pix` (QR base64 + payload copia-e-cola + URL da fatura) ou `manual_pix` (chave Pix do `.env`). Botão de copiar via `navigator.clipboard`.
- **`<Timeline>`** (`src/app/(app)/loja/pedidos/page.tsx:51`) — função interna do server component, exibe progresso em 4 etapas (Pedido → Pago → Enviado → Entregue) baseado em `order.status`.
- **`<ProductList>`** (`src/app/admin/loja/product-list.tsx:35`) — tabela admin com toggle ativo/inativo, botões de editar e deletar, exibe preço, estoque e badge de status.
- **`<ProductForm>`** (`src/app/admin/loja/product-form.tsx:40`) — Dialog de criação/edição de produto. Campos: título, imagem, descrição, preço, preço comparativo, estoque, peso/dimensões (kg/cm), categoria, módulo (`fitness` | `moto` | `geral`), descontos por tier (start/pro/vip).
- **`<OrderList>`** (`src/app/admin/loja/order-list.tsx:77`) — tabela de pedidos com nome do cliente, itens, total, frete, status. Ações condicionais por status: gerar etiqueta (paid + sem `shipping_label_url`), ver etiqueta, marcar como Enviado/Entregue.
- **`<GenerateLabelButton>`** (`src/app/admin/loja/order-list.tsx:38`) — botão que faz `POST /api/admin/loja/shipping/label` (rota fora deste escopo — referenciada em §10).

## 4. Server Actions / API Routes
| Endpoint/Action | Método | Input | Output | Quem chama |
|---|---|---|---|---|
| `POST /api/loja/checkout` | POST | `{ items: [{product_id, quantity}], shipping_cost_cents, shipping_method, estimated_delivery, shipping_info }` | `{ orderId }` ou `{ error }` | `<StoreGrid>` (`store-grid.tsx:185`) |
| `POST /api/loja/payment` | POST | `{ orderId }` | `{ method: "asaas_pix", paymentId, invoiceUrl, pixQrCode, pixPayload, expirationDate, total }` ou `{ method: "manual_pix", pixKey, pixName, instructions, total }` | `<PaymentPanel>` (`payment-panel.tsx:39`) |
| `POST /api/loja/shipping/quote` | POST | `{ zip: string, items?: [{weight_kg, height_cm, width_cm, length_cm}] }` | `{ quotes: ShippingQuote[] }` | `<StoreGrid>` (`store-grid.tsx:106`) |
| `getProducts()` | Server Action | — | `Product[]` | `/admin/loja` (`page.tsx:9`) |
| `createProduct(formData)` | Server Action | `FormData` validado por `createProductSchema` | void (revalida `/admin/loja`) | `<ProductForm>` (`product-form.tsx:50`) |
| `updateProduct(id, formData)` | Server Action | `id`, `FormData` | void (revalida `/admin/loja`) | `<ProductForm>` (`product-form.tsx:48`) |
| `deleteProduct(id)` | Server Action | `id` | void (revalida `/admin/loja`) | `<ProductList>` (`product-list.tsx:40`) |
| `toggleProductActive(id, active)` | Server Action | `id`, `active: boolean` | void | `<ProductList>` (`product-list.tsx:106`) |
| `getOrders()` | Server Action | — | `Order[]` (com `profiles(full_name)` join) | `/admin/loja` (`page.tsx:9`) |
| `updateOrderStatus(id, status, trackingCode?)` | Server Action | `id`, `status`, `trackingCode?` | void + dispara push `notifyUser` (eventos `shipped`/`delivered`/`canceled`) | `<OrderList>` (`order-list.tsx:165,172`) |

Definições das actions em `src/app/admin/actions.ts:567-726`.

## 5. Modelo de dados

### Tabela `products` (`supabase/migration_loja.sql:6` + `supabase/migration_product_shipping.sql:7`)
- `id` uuid PK — gerado por `gen_random_uuid()`.
- `title` text NOT NULL — nome do produto.
- `description` text — descrição livre.
- `image_url` text NOT NULL — URL pública da imagem.
- `price_cents` int NOT NULL — preço em centavos.
- `compare_price` int — preço "de" riscado (centavos).
- `category` text NOT NULL — sticker/camiseta/acessório etc.
- `module` text default `'geral'` — check (`fitness` | `moto` | `geral`).
- `variants` jsonb default `'[]'` — `[{ name, stock }]` (estrutura criada na migration mas não consumida no checkout atual; ver `validatedItems.variant: null` em `route.ts:128`).
- `stock` int NOT NULL default 0 — estoque agregado.
- `discount_start` / `discount_pro` / `discount_vip` int default 0 — % de desconto por tier de assinatura.
- `is_active` boolean default `true` — filtra na vitrine.
- `sort_order` int default 0 — ordem na grade.
- `created_at` timestamptz default `now()`.
- `weight_kg` numeric(6,2) default 0.5 — peso para frete.
- `height_cm` / `width_cm` / `length_cm` int — dimensões para frete (defaults 10/20/30).
- **Índice:** `idx_products_active(is_active, sort_order)`.
- **RLS** (`migration_loja.sql:26-39`): `products_select_active` permite SELECT a `authenticated` somente onde `is_active = true`; `products_admin` libera tudo para `service_role`.

### Tabela `orders` (`supabase/migration_loja.sql:42` + `supabase/migration_product_shipping.sql:14`)
- `id` uuid PK.
- `user_id` text NOT NULL — FK para `profiles(id)` (id do Clerk).
- `status` text default `'pending'` — check (`pending` | `paid` | `shipped` | `delivered` | `canceled`).
- `items` jsonb NOT NULL — snapshot `[{ product_id, title, variant, quantity, price_cents }]`.
- `subtotal_cents` int NOT NULL.
- `discount_cents` int default 0.
- `total_cents` int NOT NULL — `subtotal - discount + shipping`.
- `shipping_info` jsonb — `{ name, phone, address, city, state, zip }`.
- `shipping_cost_cents` (gravado em `route.ts:169`; presente no schema do app, ver §9).
- `shipping_method` (gravado em `route.ts:170`).
- `estimated_delivery` (gravado em `route.ts:171`).
- `tracking_code` text — código de rastreio (preenchido pelo admin).
- `notes` text.
- `asaas_payment_id` text — id da cobrança Pix avulsa no Asaas (gravado em `route.ts:152` do `payment`).
- `melhor_envio_order_id` text — id do envio no Melhor Envio (preenchido pela rota de etiqueta — fora do escopo).
- `shipping_label_url` text — URL para impressão da etiqueta.
- `created_at` / `updated_at` timestamptz default `now()`.
- **Índices:** `idx_orders_user(user_id, created_at desc)`, `idx_orders_status(status)`.
- **RLS** (`migration_loja.sql:58-77`): `orders_select_own` e `orders_insert_own` exigem `auth.jwt()->>'sub' = user_id`; `orders_admin` libera ao `service_role`. Como o checkout usa `createAdminSupabaseClient` (`route.ts:51`), a inserção passa pela policy admin.

### RPCs `decrement_stock` / `increment_stock`
Funções declaradas em `supabase/migration_fixes.sql:27,40` (responsabilidade do agente "Infra Compartilhada"). Consumidas em `src/app/api/loja/checkout/route.ts:141,149,182` para garantir decremento atômico de estoque com rollback em caso de erro.

## 6. Integrações externas

- **Asaas (Pix avulso para pedidos)** — `src/app/api/loja/payment/route.ts:118` cria `POST {ASAAS_BASE}/payments` com `billingType: "PIX"`, `externalReference: orderId`, vencimento +1 dia. Usa helpers `createCustomer` e `getPaymentPixQrCode` de `@/lib/asaas/client` (`route.ts:78`). Cliente Asaas é resgatado/criado e armazenado em `profiles.asaas_customer_id` (`route.ts:90-110`). Confirmação de pagamento (`order.status = 'paid'`) deve ocorrer via webhook Asaas — fluxo do webhook é coberto por outro setor. Ver `../plataforma/pagamentos-asaas.md`.
- **Melhor Envio** — `src/lib/shipping/melhor-envio.ts`. Sandbox vs produção via `MELHOR_ENVIO_ENV` (`:26`). Token via `MELHOR_ENVIO_TOKEN`. Endpoints usados: `/shipment/calculate` (cotação), `/cart` (inserir), `/shipment/checkout` (compra), `/shipment/generate` (gerar etiqueta), `/shipment/print` (URL impressão), `/shipment/tracking` (rastreio). Função `generateFullLabel` (`:365`) executa o pipeline completo (cart → checkout → generate → print → tracking).
- **99 Entrega** — `src/lib/shipping/local-delivery.ts:46`. Auth via `Bearer ${ENTREGA99_API_KEY}`. Endpoint `/v1/deliveries/estimate` (cotação) e `/v1/deliveries` (criação). Retorna ETA em minutos; `estimated_days = 0`.
- **Lalamove** — `src/lib/shipping/local-delivery.ts:159`. Auth HMAC via `LALAMOVE_API_KEY` + `LALAMOVE_API_SECRET` (`X-LLM-Country: BR`). Endpoint `/v3/quotations` e `/v3/orders`. **Implementação parcial** (assinatura HMAC literal `"signature"`, lat/lng zerados — geocoding pendente; ver §9).
- **Clerk** — todas as rotas autenticadas usam `auth()` (e `currentUser()` em `payment/route.ts:84` para nome/email do customer Asaas). Ver `../plataforma/auth-clerk.md`.
- **Supabase** — `createServerSupabaseClient` (RLS) na vitrine/admin e `createAdminSupabaseClient` (service role) em rotas que precisam ignorar RLS (checkout/payment/admin actions). Ver `../plataforma/supabase.md`.
- **Web Push** — `notifyUser` em `actions.ts:717` dispara push ao mudar status do pedido. Ver `../plataforma/push-notifications.md`.

## 7. Validações

- **`createProductSchema`** (`src/lib/validations.ts:51`) — único schema Zod do setor. Campos validados: `title` (1-200), `description` (≤2000, opcional), `image_url` (url), `price` (≥0.01, coerce), `compare_price` (≥0, opcional), `category` (1-100), `module` (default `geral`), `stock` (int ≥0), `weight_kg` (≥0.01, default 0.5), `height_cm`/`width_cm`/`length_cm` (int ≥1, defaults 10/20/30), `discount_start`/`discount_pro`/`discount_vip` (int 0-100). Usado tanto em `createProduct` quanto `updateProduct` (`actions.ts:582,611`).
- **Validações inline em `/api/loja/checkout`** (`route.ts:38-49`): exige `items` não-vazio, `shipping_info` completo (`name`, `address`, `city`, `state`, `zip`, `phone`) e cada item com `product_id` + `quantity > 0`. Sem schema Zod nesta rota.
- **Validações inline em `/api/loja/shipping/quote`** (`route.ts:36-44`): `zip` obrigatório, normalizado e exige 8 dígitos.
- **Validações inline em `/api/loja/payment`** (`route.ts:27-30`): `orderId` obrigatório.

## 8. Fluxos principais

### Fluxo: Compra completa (cliente)
1. Cliente acessa `/loja` — server component carrega produtos ativos via RLS e `plan_tier` do perfil (`page.tsx:23-34`).
2. `<StoreGrid>` renderiza cards com preço já com desconto aplicado pelo tier; carrinho persistido em `localStorage` (`store-grid.tsx:136-156`).
3. Cliente clica "Finalizar Compra" → modal solicita dados de entrega + CEP.
4. Cliente clica "Calcular Frete" → `<StoreGrid>` faz `POST /api/loja/shipping/quote` com peso/dimensões agregadas dos itens (`store-grid.tsx:97-110`).
5. Servidor consulta Melhor Envio + 99 Entrega + Lalamove em paralelo (`getShippingOptions` em `shipping/index.ts:33`) e retorna ordenado por preço; auto-seleciona o mais barato (`store-grid.tsx:115`).
6. Cliente confirma → `<StoreGrid>` envia `POST /api/loja/checkout` apenas com `product_id + quantity` (server recalcula tudo).
7. Servidor (`checkout/route.ts`):
   - Aplica rate-limit `5/min` (`:18`).
   - Busca `plan_tier` autoritativo (`:54`).
   - Busca produtos ativos (`:63`); valida estoque e recalcula preço com desconto correto (`:113-131`).
   - Decrementa estoque atomicamente via RPC `decrement_stock` (`:141`); rollback via `increment_stock` em caso de falha (`:148-152, 182-185`).
   - Insere em `orders` com `status = 'pending'` e snapshot `items` calculado pelo servidor (`:163-177`).
   - Retorna `{ orderId }`.
8. Cliente é redirecionado para `/loja/pedido?id=<orderId>` (`store-grid.tsx:208`).
9. `<PaymentPanel>` faz `POST /api/loja/payment` (`payment-panel.tsx:39`).
10. Servidor (`payment/route.ts`):
    - Carrega pedido e valida `status === 'pending'`.
    - Se `ASAAS_API_KEY` ausente → retorna `{ method: "manual_pix", pixKey, pixName, instructions }` (`:65-74`).
    - Se configurado → resgata/cria customer Asaas (cacheia em `profiles.asaas_customer_id`), cria payment Pix (`:118-135`), busca QR code (`:146`), salva `asaas_payment_id` em `orders` (`:149-155`) e retorna `{ pixQrCode, pixPayload, invoiceUrl, expirationDate }`.
11. Cliente paga (escaneia QR ou copia-e-cola).
12. Webhook Asaas (fora deste setor, ver `../plataforma/pagamentos-asaas.md`) recebe `PAYMENT_CONFIRMED` e atualiza `orders.status` para `paid`.

### Fluxo: Admin envia pedido
1. Admin acessa `/admin/loja` (`page.tsx:8`) — `getProducts` + `getOrders` em paralelo via Server Actions com `requireAdmin()` (`actions.ts:568,667`).
2. Em `<OrderList>`, pedido com `status = 'paid'` e sem `shipping_label_url` exibe `<GenerateLabelButton>` (`order-list.tsx:147`).
3. Admin clica → `POST /api/admin/loja/shipping/label` (rota fora deste escopo) que dispara `generateFullLabel` do Melhor Envio (`shipping/melhor-envio.ts:365`) e grava `tracking_code`/`shipping_label_url` no pedido.
4. Admin clica "Enviar" → `updateOrderStatus(id, 'shipped')` (`actions.ts:677`).
5. `updateOrderStatus` atualiza pedido, lê `user_id` e dispara push notification "Pedido enviado!" via `notifyUser` (`actions.ts:717`).
6. Quando entregue, admin clica "Entregue" → mesmo fluxo com mensagem "Pedido entregue!".

### Fluxo: Cliente acompanha pedidos
1. `/loja/pedidos` (`page.tsx:101`) lê `orders` filtrando por `user_id` via RLS.
2. Renderiza cards com badge de status, total formatado, `<Timeline>` em 4 etapas e link de rastreamento externo `https://www.rastreio.com.br/${tracking_code}` se disponível (`page.tsx:222`).

## 9. Observações (notas para Fase B — não auditar agora)

- **Validação de frete server-side:** `checkout/route.ts:135-136` confia no valor enviado pelo cliente (`shipping_cost_cents`) e apenas faz `Math.max(0, ...)`. Comentário explícito no código: "idealmente re-cotaríamos com o melhor-envio aqui". Risco de adulteração — recotação server-side recomendada.
- **`variants` ainda não consumida:** schema cria coluna `variants jsonb` (`migration_loja.sql:18`), mas o checkout grava `variant: null` em todos os itens (`route.ts:128`). Form admin não tem UI para variants.
- **Lalamove parcial:** assinatura HMAC literalmente `"signature"` (`local-delivery.ts:144`), lat/lng zerados (`:177-181`) — não funcional sem geocoding e HMAC real.
- **Schema da migration vs colunas usadas:** colunas `shipping_cost_cents`, `shipping_method`, `estimated_delivery` são gravadas em `orders` pelo checkout (`route.ts:169-171`) mas **não constam em `migration_loja.sql`**. `migration_product_shipping.sql` adiciona apenas `asaas_payment_id`, `melhor_envio_order_id`, `shipping_label_url`. Investigar se há migration intermediária ou se foram adicionadas via dashboard. Idem para `updated_at` (declarada em `migration_loja.sql:55` ✓) e `tracking_code`/`notes` (declaradas ✓).
- **Confirmação de pagamento:** depende de webhook Asaas (fora do escopo) — sem o webhook, pedido fica preso em `pending` mesmo após Pix pago.
- **Tipagem manual:** vários `as unknown as { ... }` indicando que tipos do Supabase ainda não foram auto-gerados (`pedido/page.tsx:40`, `payment/route.ts:47`, `pedidos/page.tsx:121`, `admin/loja/page.tsx:11`).
- **Sem validação Zod no checkout:** `/api/loja/checkout` faz validação manual em try/catch (`route.ts:38-49`) — candidato a um `checkoutSchema` em `validations.ts` para uniformidade.
- **Auto-fallback do payment:** qualquer erro no Asaas cai para `manual_pix` (`payment/route.ts:166-177`) — pode mascarar falhas (cliente recebe Pix manual sem entender que houve erro).
- **Endereço de origem do remetente:** lido de `process.env.SHIPPING_ORIGIN_*` (`shipping/types.ts:54`), com fallback para CEP `01001000` (Praça da Sé/SP). Garantir configuração em produção.
- **Sem garantia de idempotência:** `/api/loja/checkout` confia no rate-limit (`5/min`) mas não tem idempotency key — refresh durante envio pode duplicar pedido (rate-limit mitiga, não elimina).

## 10. Referências

- **Arquivos-chave:**
  - `src/app/(app)/loja/page.tsx:19`
  - `src/app/(app)/loja/store-grid.tsx:59`
  - `src/app/(app)/loja/loading.tsx:1`
  - `src/app/(app)/loja/pedido/page.tsx:18`
  - `src/app/(app)/loja/pedido/payment-panel.tsx:24`
  - `src/app/(app)/loja/pedidos/page.tsx:101`
  - `src/app/api/loja/checkout/route.ts:11`
  - `src/app/api/loja/payment/route.ts:14`
  - `src/app/api/loja/shipping/quote/route.ts:14`
  - `src/app/admin/loja/page.tsx:8`
  - `src/app/admin/loja/product-form.tsx:40`
  - `src/app/admin/loja/product-list.tsx:35`
  - `src/app/admin/loja/order-list.tsx:77`
  - `src/app/admin/actions.ts:567-726` (server actions de produtos e pedidos)
  - `src/lib/shipping/index.ts:27` (`getShippingOptions`)
  - `src/lib/shipping/types.ts:6`
  - `src/lib/shipping/melhor-envio.ts:117,365`
  - `src/lib/shipping/local-delivery.ts:46,159`
  - `src/lib/validations.ts:51` (`createProductSchema`)
- **Migrations:**
  - `supabase/migration_loja.sql` — `products`, `orders`, RLS, índices.
  - `supabase/migration_product_shipping.sql` — peso/dimensões em `products`; `asaas_payment_id`, `melhor_envio_order_id`, `shipping_label_url` em `orders`.
  - `supabase/migration_fixes.sql` — RPCs `decrement_stock` / `increment_stock` (mantida pelo setor de Infra Compartilhada).
- **Setores cruzados:**
  - `../plataforma/auth-clerk.md` — autenticação (`auth()`, `currentUser()`, `requireAdmin()`).
  - `../plataforma/supabase.md` — `createServerSupabaseClient`, `createAdminSupabaseClient`, RLS pattern.
  - `../plataforma/pagamentos-asaas.md` — helpers `@/lib/asaas/client` (`createCustomer`, `getPaymentPixQrCode`, `cancelSubscription`), `@/lib/asaas/config` (`ASAAS_CONFIG`), `@/lib/asaas/checkout` (`processCheckout`), webhook `PAYMENT_CONFIRMED`, rotas `POST /api/checkout/subscribe` e `POST /api/checkout/cancel` (assinaturas, não loja física).
  - `../plataforma/push-notifications.md` — `notifyUser` em mudanças de status (`shipped`/`delivered`/`canceled`).
  - `../plataforma/rate-limit.md` — `checkRateLimitAsync` (`@/lib/rate-limit`).
  - `../plataforma/admin.md` — `requireAdmin()`, `parseFormData`, layout `/admin`, rota `POST /api/admin/loja/shipping/label` consumida pelo `<GenerateLabelButton>`.
  - `../dominio/perfil.md` — campos `profiles.plan_tier` e `profiles.asaas_customer_id` consultados pelo checkout/payment.
