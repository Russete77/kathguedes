# Setor: Kath Estética

## 1. Visão geral
- **Propósito:** Módulo "Kath Guedes Estética Moto" — catálogo de serviços de estética automotiva (lavagem, polimento, vitrificação, higienização, cristalização), agendamento online com slots dinâmicos, pagamento via Pix (Asaas) e programa de fidelidade "4 fotos aprovadas no mês = 5ª lavagem grátis". Integração total no app KathApp para usuário final + painel admin para gestão de agenda, serviços, portfólio e aprovação de fotos.
- **Quem usa:** Ambos. Usuário final consome em `/kath-estetica/*`; admin (Clerk role=`admin`) gerencia em `/admin/kath-estetica/*`.
- **Status percebido:** production. Tabelas, RPCs, RLS, storage buckets, fluxo de pagamento Asaas, webhook e notificações push estão completos e referenciados em produção (vide `migration_kath_estetica.sql`, webhook `src/app/api/webhook/asaas/route.ts:63`).

## 2. Rotas

### Área do usuário (`src/app/(app)/kath-estetica/`)
| Path | Arquivo | Tipo | Descrição |
|---|---|---|---|
| `/kath-estetica` | `src/app/(app)/kath-estetica/page.tsx:41` | RSC (page) | Hub do setor — quick actions, hero, status fidelidade do mês, serviços em destaque, portfólio em destaque, diferenciais |
| `/kath-estetica/servicos` | `src/app/(app)/kath-estetica/servicos/page.tsx:21` | RSC (page) | Listagem completa de serviços ativos com preço calculado pelo `plan_tier` do usuário |
| `/kath-estetica/servicos/[id]` | `src/app/(app)/kath-estetica/servicos/[id]/page.tsx:22` | RSC (page) | Detalhe do serviço com CTA "Agendar agora" |
| `/kath-estetica/agendar/[serviceId]` | `src/app/(app)/kath-estetica/agendar/[serviceId]/page.tsx:15` | RSC (page) + client form | Formulário de agendamento; resolve elegibilidade fidelidade no servidor |
| `/kath-estetica/meus-agendamentos` | `src/app/(app)/kath-estetica/meus-agendamentos/page.tsx:35` | RSC (page) | Histórico do usuário; cada card abre ação contextual (gerar Pix se `pending`, upload de foto se `done`) |
| `/kath-estetica/fidelidade` | `src/app/(app)/kath-estetica/fidelidade/page.tsx:15` | RSC (page) | Progresso 4/5 do mês, "como funciona", grid de fotos do mês |
| `/kath-estetica/portfolio` | `src/app/(app)/kath-estetica/portfolio/page.tsx:15` | RSC (page) | Galeria pública (autenticada) de pares antes/depois |

### Área admin (`src/app/admin/kath-estetica/`)
| Path | Arquivo | Tipo | Descrição |
|---|---|---|---|
| `/admin/kath-estetica/servicos` | `src/app/admin/kath-estetica/servicos/page.tsx:7` | RSC (page) | CRUD de `estetica_services` (lista + modal de form) |
| `/admin/kath-estetica/agendamentos` | `src/app/admin/kath-estetica/agendamentos/page.tsx:6` | RSC (page) | Kanban com filtros por status e transições controladas |
| `/admin/kath-estetica/fidelidade` | `src/app/admin/kath-estetica/fidelidade/page.tsx:6` | RSC (page) | Aprovação/reprovação de fotos pendentes |
| `/admin/kath-estetica/horarios` | `src/app/admin/kath-estetica/horarios/page.tsx:7` | RSC (page) | Edição da `estetica_schedule` semanal e CRUD de bloqueios |
| `/admin/kath-estetica/portfolio` | `src/app/admin/kath-estetica/portfolio/page.tsx:6` | RSC (page) | CRUD de `estetica_portfolio` |

### API Routes (`src/app/api/estetica/`)
| Path | Arquivo | Tipo | Descrição |
|---|---|---|---|
| `POST /api/estetica/bookings` | `src/app/api/estetica/bookings/route.ts:17` | Route Handler | Cria agendamento (recalcula preço server-side, valida slot, valida fidelidade) |
| `POST /api/estetica/bookings/[id]/payment` | `src/app/api/estetica/bookings/[id]/payment/route.ts:10` | Route Handler | Gera cobrança Pix Asaas para o booking |
| `GET /api/estetica/slots?date=YYYY-MM-DD&duration=60` | `src/app/api/estetica/slots/route.ts:9` | Route Handler | Retorna slots disponíveis chamando RPC `get_available_slots` |
| `POST /api/estetica/loyalty/upload` | `src/app/api/estetica/loyalty/upload/route.ts:15` | Route Handler | Upload de foto pós-serviço (≤5MB, image/*); aplica lazy cleanup mensal |

## 3. Componentes

### Componentes do usuário final (cliente, dentro de `(app)/kath-estetica/`)
- **`BookingForm`** (`src/app/(app)/kath-estetica/agendar/[serviceId]/booking-form.tsx:24`) — Form do agendamento. Faz fetch reativo a `/api/estetica/slots` quando muda a data, monta payload com `service_id`, `scheduled_at`, dados do veículo, contato e flag `use_loyalty`. Mostra resumo de preço com desconto de plano e/ou fidelidade.
- **`BookingActions`** (`src/app/(app)/kath-estetica/meus-agendamentos/booking-actions.tsx:23`) — Componente contextual no card de cada booking: gera Pix (renderiza QR base64 + botão de copiar Pix Copia e Cola) quando `status='pending'`; permite upload de foto quando `status='done'`.

### Componentes admin (cliente, dentro de `admin/kath-estetica/`)
- **`ServiceForm`** (`src/app/admin/kath-estetica/servicos/service-form.tsx:27`) — Modal de criação/edição de serviço; converte preço em reais ↔ cents; campos: título, descrição, imagem, categoria, duração, preço, "preço de", descontos por plano (start/pro/vip), includes (multi-linha), `eligible_for_loyalty`, `is_active`, `sort_order`.
- **`ServiceList`** (`src/app/admin/kath-estetica/servicos/service-list.tsx:30`) — Tabela com ações editar/excluir.
- **`BookingsKanban`** (`src/app/admin/kath-estetica/agendamentos/bookings-kanban.tsx:30`) — Filtros por status + cards com transições controladas pelo dicionário `nextStatusByCurrent` (ex.: `pending → confirmed/canceled`, `confirmed → in_progress/canceled/no_show`); link `wa.me` para o telefone do cliente.
- **`LoyaltyApprovalList`** (`src/app/admin/kath-estetica/fidelidade/approval-list.tsx:12`) — Duas seções: "Aguardando aprovação" e "Aprovadas recentes" (top 10).
- **`ScheduleManager`** (`src/app/admin/kath-estetica/horarios/schedule-manager.tsx:12`) — Form por dia da semana (open/close, slot_minutes, fechado) + form de bloqueios pontuais (datetime range + motivo).
- **`PortfolioManager`** (`src/app/admin/kath-estetica/portfolio/portfolio-manager.tsx:17`) — Grid + modal de criação aceitando URLs externas para `before_url`/`after_url`, vínculo opcional a `service_id`, flag `is_featured`.

## 4. Server Actions / API Routes

### Server Actions (admin) — `src/app/admin/kath-estetica/actions.ts`
Todas chamam `requireAdmin()` (`actions.ts:8`) e usam `createAdminSupabaseClient()`.

| Action | Linha | Input | Output | Quem chama |
|---|---|---|---|---|
| `getServices()` | `actions.ts:20` | — | `estetica_services[]` ordenado por `sort_order` | `admin/.../servicos/page.tsx:8` e `admin/.../portfolio/page.tsx:7` |
| `createService(formData)` | `actions.ts:31` | `FormData` | revalida `/admin/kath-estetica/servicos` | `ServiceForm` |
| `updateService(id, formData)` | `actions.ts:64` | id, FormData | revalida | `ServiceForm` |
| `deleteService(id)` | `actions.ts:100` | id | revalida | `ServiceList` |
| `getBookings()` | `actions.ts:115` | — | últimos 200 com join `estetica_services(title)` | admin agendamentos |
| `updateBookingStatus(id, status)` | `actions.ts:127` | id, status enum | atualiza + dispara `notifyUser` | `BookingsKanban` |
| `getPendingLoyaltyPhotos()` | `actions.ts:173` | — | top 100 com join profiles + bookings | admin fidelidade |
| `approveLoyaltyPhoto(id, approved)` | `actions.ts:185` | id, bool | aprova ou exclui (storage + row); ao atingir 4 dispara push | `LoyaltyApprovalList` |
| `getPortfolio()` | `actions.ts:244` | — | itens ordenados `is_featured desc, sort_order asc` | admin portfólio |
| `createPortfolioItem(formData)` | `actions.ts:256` | FormData | revalida | `PortfolioManager` |
| `deletePortfolioItem(id)` | `actions.ts:272` | id | revalida | `PortfolioManager` |
| `getSchedule()` | `actions.ts:287` | — | 7 linhas de `estetica_schedule` | admin horários |
| `updateScheduleDay(dow, opens, closes, isClosed, slotMinutes)` | `actions.ts:297` | parâmetros | revalida | `ScheduleManager` |
| `blockSlot(startsAt, endsAt, reason)` | `actions.ts:319` | timestamps + motivo | revalida | `ScheduleManager` |
| `unblockSlot(id)` | `actions.ts:329` | id | revalida | `ScheduleManager` |

### API Routes públicas (autenticadas)
| Endpoint | Método | Input | Output | Quem chama |
|---|---|---|---|---|
| `/api/estetica/bookings` | POST | JSON `{service_id, scheduled_at, vehicle_*, customer_*, use_loyalty}` | `{bookingId, loyaltyUsed}` | `BookingForm` |
| `/api/estetica/bookings/[id]/payment` | POST | path `id` | `{method, paymentId, invoiceUrl, pixQrCode, pixPayload, expirationDate, total}` ou `{method:"free"}` | `BookingActions` |
| `/api/estetica/slots` | GET | query `date`, `duration` | `{slots: ISO[]}` | `BookingForm` |
| `/api/estetica/loyalty/upload` | POST | `multipart/form-data` (`photo`, `booking_id`) | `{ok, photo_url}` | `BookingActions` |

Validações server-side notáveis em `POST /api/estetica/bookings` (`route.ts:23-108`): rate-limit 5/min via `checkRateLimitAsync`, validação de campos obrigatórios, recálculo do preço a partir do DB (nunca confia no cliente), reuso da RPC `get_available_slots` para confirmar slot disponível, e RPC `check_loyalty_eligibility` quando `use_loyalty=true`.

## 5. Modelo de dados

Todas as tabelas estão em `supabase/migration_kath_estetica.sql`.

### Tabela `estetica_services` (`migration_kath_estetica.sql:17`)
- `id`: uuid PK — gerado.
- `title`: text NOT NULL.
- `description`, `image_url`: text nullable.
- `category`: text NOT NULL CHECK in `('lavagem','polimento','vitrificacao','higienizacao','cristalizacao','outros')` — `migration:23`.
- `duration_min`: int NOT NULL default 60 — usado para alocar slot no agendamento.
- `price_cents`: int NOT NULL.
- `compare_price`: int — preço "de/por".
- `discount_start`, `discount_pro`, `discount_vip`: int default 0 — descontos % por tier de plano.
- `includes`: text[] default `{}` — lista do que está incluso.
- `eligible_for_loyalty`: bool default true — se o serviço conta no programa fidelidade.
- `is_active`, `sort_order`, `created_at`.
- **Índices:** `idx_estetica_services_active(is_active, sort_order)`, `idx_estetica_services_category(category)`.
- **RLS:** `select` para `authenticated` quando `is_active=true` (`migration:40`); `all` para `service_role` (`migration:46`).

### Tabela `estetica_schedule` (`migration_kath_estetica.sql:59`)
- `day_of_week`: int PK CHECK 0..6 (0=domingo).
- `opens_at`, `closes_at`: time nullable.
- `is_closed`: bool default false.
- `slot_minutes`: int default 60 — granularidade dos slots.
- **Seed:** ter-sáb 8h-18h, dom/seg fechado, sáb 8h-17h (`migration:81-88`).
- **RLS:** `select` para `authenticated`; `all` para `service_role`.

### Tabela `estetica_slots_blocked` (`migration_kath_estetica.sql:94`)
- `id`: uuid PK.
- `starts_at`, `ends_at`: timestamptz NOT NULL (CHECK `ends_at > starts_at`).
- `reason`: text nullable.
- **Índice:** `idx_estetica_slots_blocked_range(starts_at, ends_at)`.
- **RLS:** `select` para `authenticated`; `all` para `service_role`.

### Tabela `estetica_bookings` (`migration_kath_estetica.sql:122`)
- `id`: uuid PK.
- `user_id`: text NOT NULL → `profiles(id)` (Clerk userId).
- `service_id`: uuid → `estetica_services(id)`.
- `scheduled_at`: timestamptz NOT NULL.
- `duration_min`: int NOT NULL — snapshot do serviço.
- Veículo: `vehicle_brand`, `vehicle_model`, `vehicle_plate` NOT NULL; `vehicle_color` nullable.
- Cliente: `customer_name`, `customer_phone` NOT NULL.
- `status`: text default `'pending'` CHECK in `('pending','confirmed','in_progress','done','canceled','no_show')` — `migration:135`.
- `price_cents`: int — preço base (snapshot server-side).
- `plan_discount_cents`: int — desconto aplicado pelo `plan_tier` no momento.
- `loyalty_free`: bool default false — se for `true`, `total=0` e status já entra como `confirmed`.
- `total_cents`: int NOT NULL.
- `asaas_payment_id`: text nullable — preenchido após `POST /payment`.
- `paid_at`, `notes`, `created_at`, `updated_at`.
- **Índices:** `idx_estetica_bookings_user(user_id, created_at desc)`, `_status`, `_scheduled`, `_service`.
- **RLS:** `select` próprio `(auth.jwt()->>'sub') = user_id` (`migration:149`); inserts/updates via `service_role` (server-only).
- **Trigger:** `estetica_bookings_touch_updated_at` (`migration:423`) → `touch_updated_at()` (`migration:413`).

### Tabela `estetica_portfolio` (`migration_kath_estetica.sql:170`)
- `id`, `title` (nullable), `service_id` (FK opcional, ON DELETE SET NULL).
- `before_url`, `after_url`: text NOT NULL.
- `description`, `is_featured` (default false), `sort_order`, `created_at`.
- **Índice:** `idx_estetica_portfolio_featured(is_featured, sort_order)`.
- **RLS:** `select` para `authenticated`; `all` para `service_role`.

### Tabela `estetica_loyalty_photos` (`migration_kath_estetica.sql:202`)
- `id`, `user_id` (FK profiles ON DELETE CASCADE), `booking_id` (FK bookings ON DELETE CASCADE).
- `photo_url`: text NOT NULL (signed URL do bucket privado).
- `month`: text NOT NULL (formato `YYYY-MM` para contagem mensal).
- `approved`: bool default false; `approved_at` nullable.
- **UNIQUE `(booking_id)`** — anti-fraude (1 foto por booking).
- **Índice:** `idx_estetica_loyalty_user_month(user_id, month, approved)`.
- **RLS:** select/insert restrito a `(auth.jwt()->>'sub') = user_id`; admin via `service_role`.

### Storage buckets (`migration_kath_estetica.sql:347-407`)
- **`estetica-portfolio`** (público): leitura `public`, escrita/delete apenas `service_role`.
- **`estetica-loyalty`** (privado): user só lê/escreve/deleta dentro do prefixo `{userId}/...` (validado por `(storage.foldername(name))[1] = (auth.jwt()->>'sub')`); admin total via `service_role`.

### RPCs
- **`check_loyalty_eligibility(p_user_id text) → boolean`** (`migration:239`) — retorna `true` se ≥4 fotos aprovadas no mês corrente E ainda não consumiu `loyalty_free` no mês.
- **`lazy_cleanup_loyalty_photos(p_user_id text) → int`** (`migration:276`) — deleta linhas de meses anteriores ao corrente. Aplicação deve apagar objects do storage **antes** de chamar.
- **`get_available_slots(p_date date, p_duration_min int) → timestamptz[]`** (`migration:298`) — gera slots a partir de `estetica_schedule` do dia, exclui sobreposição com bookings em status ativo (`pending|confirmed|in_progress`) e com bloqueios de `estetica_slots_blocked`. Usa `tstzrange && tstzrange` para colisão.

## 6. Integrações externas

- **Asaas (Pix)** — pagamento de booking. Cliente em `src/lib/asaas/client.ts` (fora de escopo) é importado dinamicamente em `src/app/api/estetica/bookings/[id]/payment/route.ts:67`. Usa `createCustomer`, `getPaymentPixQrCode` e POST direto em `${ASAAS_CONFIG.baseUrl}/payments` com `billingType: "PIX"`, `externalReference: "estetica:{bookingId}"`. **Confirmação automática via webhook** em `src/app/api/webhook/asaas/route.ts:63` (fora de escopo) — quando recebe `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` e `externalReference` começa com `estetica:`, atualiza `estetica_bookings.status='confirmed'` e dispara push.
- **Clerk (Auth)** — `auth()` em todas as routes/pages; `currentUser()` para popular dados do customer Asaas (`payment/route.ts:72`). Detalhes do subsistema documentados pelo setor "Plataforma · Auth".
- **Supabase** — `createServerSupabaseClient()` (RSC, RLS do user) e `createAdminSupabaseClient()` (server actions/API routes que precisam de `service_role`). Detalhes em "Plataforma · Supabase".
- **Web Push (VAPID)** — `notifyUser(userId, payload)` em `src/lib/notifications.ts` (fora de escopo) é disparado em `actions.ts:158` (mudança de status) e `actions.ts:227` (4ª foto aprovada). Detalhes em "Plataforma · Push".
- **Rate limiting** — `checkRateLimitAsync` em `src/lib/rate-limit.ts` (fora de escopo) usado em `POST /api/estetica/bookings` com `5 req / 60s`.

## 7. Validações

Não há schemas Zod dedicados a este setor — toda validação é manual server-side.

- **`POST /api/estetica/bookings`** (`route.ts:51-64`) — checagem de campos obrigatórios (`service_id`, `scheduled_at`, dados de veículo e contato).
- **Slot disponível** (`route.ts:92-108`) — chamada à RPC `get_available_slots` e `Array.some` comparando timestamps.
- **Elegibilidade fidelidade** (`route.ts:111-124`) — RPC `check_loyalty_eligibility` se `use_loyalty=true` e serviço marca `eligible_for_loyalty`.
- **Recálculo de preço** (`route.ts:127-130`) — usa `finalPriceCents(service, planTier)` de `src/lib/estetica/types.ts:90`; `total=0` se `loyalty_free`.
- **`POST /api/estetica/loyalty/upload`** (`route.ts:32-44`) — `file.type.startsWith("image/")`, `file.size ≤ 5MB`.
- **Booking ownership + status** (`upload/route.ts:49-74`) — booking deve pertencer ao user e estar `done`; serviço precisa ter `eligible_for_loyalty=true`.
- **Booking pertence ao user no payment** (`payment/route.ts:22-34`) — `eq("user_id", userId)`.

Helpers de pricing/format ficam em `src/lib/estetica/types.ts:83-107`: `planDiscount`, `finalPriceCents`, `formatPrice`, `formatDateTime`.

## 8. Fluxos principais

### Fluxo: Agendamento + pagamento Pix
1. Usuário entra em `/kath-estetica/agendar/[serviceId]`. RSC pré-resolve elegibilidade fidelidade (`page.tsx:38-60`).
2. `BookingForm` (cliente) busca slots via `GET /api/estetica/slots?date=...&duration=...` (`booking-form.tsx:52`).
3. Submit → `POST /api/estetica/bookings`. Servidor: rate-limit, snapshot do serviço, `plan_tier` do profile, valida slot via RPC, valida fidelidade se solicitada, recalcula preço, insere `estetica_bookings` com `status='pending'` (ou `confirmed` se `loyalty_free`).
4. Redireciona para `/kath-estetica/meus-agendamentos?highlight={id}`.
5. No card pendente, usuário clica "Pagar via Pix" → `POST /api/estetica/bookings/[id]/payment`. Servidor: garante/cria customer Asaas (persiste `profiles.asaas_customer_id`), cria payment Pix com `dueDate=hoje+1`, busca QR e payload, atualiza `asaas_payment_id`.
6. UI exibe QR base64 + botão de copiar Pix Copia e Cola.
7. Asaas webhook (`PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`) → `estetica_bookings.status='confirmed'` + push notification "Pagamento confirmado!" (`webhook/asaas/route.ts:63-89`, fora de escopo).

### Fluxo: Programa fidelidade
1. Após admin marcar booking como `done` (`updateBookingStatus`), usuário recebe push "Serviço concluído! Envie a foto…" (`actions.ts:153`).
2. Em `/kath-estetica/meus-agendamentos`, card `done` mostra botão "Enviar foto pra fidelidade". Upload via `POST /api/estetica/loyalty/upload`.
3. Servidor valida ownership e status do booking, faz lazy cleanup das fotos do user de meses anteriores (storage + DB), faz upload em `estetica-loyalty/{userId}/{bookingId}-{ts}.{ext}`, gera signed URL (45 dias), insere `estetica_loyalty_photos` com `approved=false` e `month=YYYY-MM`.
4. Admin entra em `/admin/kath-estetica/fidelidade` e aprova/reprova. Reprovação remove storage + row. Aprovação faz update; **se contagem aprovada do mês chegar a 4**, dispara push "5ª lavagem desbloqueada!" (`actions.ts:226-233`).
5. No próximo agendamento do mês, `BookingForm` exibe banner "5ª LAVAGEM GRÁTIS DISPONÍVEL!" (eligibility resolvida server-side em `agendar/[serviceId]/page.tsx:57`); user marca o checkbox e cria booking com `total=0`, `status='confirmed'`, `loyalty_free=true`.

### Fluxo: Gestão de agenda admin
1. Admin edita 7 linhas de `estetica_schedule` em `/admin/kath-estetica/horarios` (open/close/closed/slot_minutes por dia).
2. Bloqueios pontuais (folga, feriado) são inseridos em `estetica_slots_blocked` com `starts_at`/`ends_at`/`reason`.
3. Próxima chamada à RPC `get_available_slots` reflete imediatamente (a RPC consulta `estetica_schedule` e `estetica_slots_blocked` em tempo real).

### Fluxo: Transição de status (Kanban admin)
1. `/admin/kath-estetica/agendamentos` lista até 200 bookings.
2. Cada card só permite transições conforme `nextStatusByCurrent` (`bookings-kanban.tsx:21`):
   - `pending → confirmed | canceled`
   - `confirmed → in_progress | canceled | no_show`
   - `in_progress → done | canceled`
   - `done`, `canceled`, `no_show`: terminais.
3. `updateBookingStatus` revalida e dispara push contextual ao usuário (mensagens em `actions.ts:149-156`).

## 9. Observações (notas para Fase B — não auditar agora)

- **Endereço da Kath não está em DB.** Hub (`(app)/kath-estetica/page.tsx:398`) traz texto literal "Endereço configurável no admin. Confira o agendamento pra ver o local." — sem tabela ou setting. TODO: adicionar `estetica_settings` ou consumir `app_settings` global.
- **Sem schema Zod dedicado.** Validações de payload do `POST /bookings` são manuais (`route.ts:51-64`). Substituir por Zod alinharia com o padrão de outros setores e daria erros consistentes.
- **`signed URL` da foto fidelidade expira em 45 dias** (`upload/route.ts:142`). Não há rotina para regenerar antes do vencimento — fotos de meses anteriores são apagadas pelo lazy cleanup, mas se a foto do mês corrente estiver no início do mês e o admin demorar a aprovar, a URL pode estourar. Considerar URL pública via path + endpoint proxy.
- **`asaas_payment_id` salvo mas sem retry** — se a primeira chamada ao Asaas falhar parcialmente (paga mas erro de rede), não há fallback. Webhook lida com a confirmação, mas não há reconciliação manual.
- **`plan_discount_cents` calculado no insert** (`route.ts:129`) usa o `plan_tier` no momento do agendamento — se o usuário fizer downgrade depois, o preço já está congelado (comportamento desejado, mas vale documentar).
- **`updated_at` em ações admin** — `updateService`/`updatePortfolioItem` não setam `updated_at` explícito (a tabela `estetica_services`/`estetica_portfolio` não tem trigger nem coluna `updated_at`); só `estetica_bookings` tem trigger `touch_updated_at` (`migration:423`).
- **Webhook trata só PAYMENT_CONFIRMED/RECEIVED** — eventos como `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED` não são processados para estetica. TODO em fase B.
- **Sem cancelamento self-service no front** — usuário não tem botão de cancelar booking; só admin via Kanban.
- **`eligible_for_loyalty` usa default `true` no form admin** (`service-form.tsx:137`) — operacionalmente correto, mas se admin esquecer de desmarcar para um serviço caro, ele entra na contagem da fidelidade.
- **Hub (`(app)/kath-estetica/page.tsx`) tem dois helpers `planDiscountPct`/`finalPriceCents` duplicados** entre `page.tsx:407` e `lib/estetica/types.ts:83` (a função importada já existe; `planDiscountPct` é uma re-implementação inline equivalente).

## 10. Referências

### Arquivos-chave
- `src/app/(app)/kath-estetica/page.tsx:1` — hub do setor.
- `src/app/(app)/kath-estetica/servicos/page.tsx:1`, `servicos/[id]/page.tsx:1`.
- `src/app/(app)/kath-estetica/agendar/[serviceId]/page.tsx:1` + `booking-form.tsx:1`.
- `src/app/(app)/kath-estetica/meus-agendamentos/page.tsx:1` + `booking-actions.tsx:1`.
- `src/app/(app)/kath-estetica/fidelidade/page.tsx:1`.
- `src/app/(app)/kath-estetica/portfolio/page.tsx:1`.
- `src/app/api/estetica/bookings/route.ts:1`.
- `src/app/api/estetica/bookings/[id]/payment/route.ts:1`.
- `src/app/api/estetica/slots/route.ts:1`.
- `src/app/api/estetica/loyalty/upload/route.ts:1`.
- `src/app/admin/kath-estetica/actions.ts:1`.
- `src/app/admin/kath-estetica/servicos/page.tsx:1` + `service-form.tsx:1` + `service-list.tsx:1`.
- `src/app/admin/kath-estetica/agendamentos/page.tsx:1` + `bookings-kanban.tsx:1`.
- `src/app/admin/kath-estetica/fidelidade/page.tsx:1` + `approval-list.tsx:1`.
- `src/app/admin/kath-estetica/horarios/page.tsx:1` + `schedule-manager.tsx:1`.
- `src/app/admin/kath-estetica/portfolio/page.tsx:1` + `portfolio-manager.tsx:1`.
- `src/lib/estetica/types.ts:1` — types + helpers de pricing.

### Migrations
- `supabase/migration_kath_estetica.sql` — schema completo (tabelas, RPCs, RLS, storage policies, trigger).

### Setores cruzados (links relativos para outros agentes)
- `../plataforma/auth.md` — Clerk + `requireAdmin()` (`actions.ts:8`) + `auth()` em routes/pages.
- `../plataforma/supabase.md` — `createServerSupabaseClient` / `createAdminSupabaseClient` em `src/lib/supabase/server.ts`; tabela `profiles` referenciada via FK em `estetica_bookings.user_id` e `estetica_loyalty_photos.user_id` (também usado para ler `plan_tier` e `asaas_customer_id`).
- `../plataforma/asaas.md` — `src/lib/asaas/client.ts`, `src/lib/asaas/config.ts`, e `src/app/api/webhook/asaas/route.ts:63-90` (handler dedicado para `externalReference` começando com `estetica:`).
- `../plataforma/push-notifications.md` — `src/lib/notifications.ts::notifyUser` consumido em `actions.ts:158/227`.
- `../plataforma/rate-limit.md` — `src/lib/rate-limit.ts::checkRateLimitAsync` consumido em `bookings/route.ts:23`.
- `../plataforma/middleware.md` — `src/middleware.ts:7` registra `/kath-estetica(.*)` como rota protegida.
- `../plataforma/seo.md` — `src/app/sitemap.ts` lista rotas `/kath-estetica/*`.
- `../layout/navegacao.md` — `src/components/layout/{navbar,tab-bar,bottom-tab-bar}.tsx` referenciam o setor.
