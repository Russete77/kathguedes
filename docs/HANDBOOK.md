# KathApp — Development Handbook

> **Para devs, agentes (Claude / Copilot / Gemini / Cursor) e skills.** Este é o documento canônico de regras do projeto. Antes de tocar em qualquer arquivo, leia: (1) este handbook; (2) o módulo correspondente em `docs/wiki/`; (3) a auditoria mais recente em `docs/audit/`. Se uma instrução do usuário conflitar com este handbook, a instrução do usuário vence — mas pergunte se a divergência é intencional.

## 0. TL;DR — não erre nestas 12

1. **Ler antes de escrever.** Wiki (`docs/wiki/`) primeiro, código depois. Não invente padrões.
2. **Produção desde o dia 1.** Sem `TODO`, sem mocks em código, sem feature flag órfão.
3. **Server Components por padrão.** `'use client'` só para interatividade real.
4. **Validação Zod sempre.** Toda entrada externa (route handler, server action, webhook) tem schema em `lib/validations.ts`.
5. **Pricing/cálculo no servidor.** Cliente envia IDs e quantidade; servidor recalcula valores e descontos.
6. **RLS é a fronteira de segurança, não a UI.** Toda tabela com `enable row level security` + 4 policies (select_own, insert_own, update_own, admin).
7. **Cliente Supabase certo:** `createServerSupabaseClient()` (RLS) para ações do user, `createAdminSupabaseClient()` (service role) só em webhook/admin/cron.
8. **Idempotência em webhooks** (Asaas/Clerk/qualquer). Erro de handler = 5xx para reentregar.
9. **Sem PDF.** Treinos, dietas, anamneses, planos — sempre componentes nativos.
10. **Design System é regra.** Tokens (`bg-bg-1`, `text-pink`), `cn()`, `next/font`, `next/image`. Sem cor hex hardcoded fora de `globals.css`.
11. **Testar antes de avançar.** `npm run lint && npm run build && npm run test`. Browser test no fluxo afetado.
12. **Atualizar wiki** quando a arquitetura mudar. Documentação rota com o código.

---

## 1. Stack & versões alvo

| Camada | Tech | Versão | Notas |
|--------|------|--------|-------|
| Framework | Next.js | 15.5.x (App Router) | server actions, Cache Components disponíveis |
| Runtime | React | 19.x | use Server Components extensivamente |
| Language | TypeScript | 5.x strict | `noEmit: true`, path alias `@/*` |
| Auth | Clerk | v7 (`@clerk/nextjs`) | integração nativa Clerk-Supabase (não usar JWT template deprecado) |
| DB | Supabase Postgres | v2 SDK | RLS sempre, JWT do Clerk via `auth.jwt()->>'sub'` |
| Pagamentos | Asaas | sandbox/prod via env | webhook token timing-safe, idempotência por `payment_id` |
| Cache/RL | Redis (Railway) | ioredis 5 | fallback in-memory só em dev |
| Push | Web Push (VAPID) | web-push 3 | hook `usePushSubscribe` para subscribe (consumir após onboarding) |
| Estilo | Tailwind CSS | v4 | tokens em `globals.css` via `@theme inline` |
| UI prim. | shadcn/ui + Base UI | — | customizado em `components/ui/` |
| Ícones | Lucide React | — | stroke only, tamanhos 16/20/24/32/48 |
| Email | Resend | — | (planejado para fluxos transacionais) |
| Vídeo | YouTube unlisted | — | nunca embed sem ID; usar `lib/youtube/` parser |
| Deploy | Vercel | — | ambientes preview/production |
| Monitoring | Sentry | dynamic import | `SENTRY_DSN` required em prod |
| Storage | Supabase Storage | — | RLS por bucket (path-prefix do user) |
| Frete | Melhor Envio + 99 + Lalamove | — | quote com `Promise.allSettled` |

**Não use:** Supabase Auth (substituído por Clerk), Pages Router, JWT template Clerk legacy, mocks de DB em testes integration, qualquer biblioteca de form state que reinvente Server Actions.

---

## 2. Layout do repositório

```
kathapp/
├─ src/app/
│  ├─ (app)/        # rotas autenticadas — layout com onboarding gate
│  ├─ (auth)/       # login + registro Clerk
│  ├─ (public)/     # landing
│  ├─ admin/        # SEGMENT REAL (não route group). Layout com role check.
│  ├─ api/          # Route Handlers
│  └─ onboarding/   # primeiro acesso
├─ src/components/
│  ├─ ui/           # shadcn customizado (Button, Card, Dialog, Select, etc)
│  └─ {dominio}/    # componentes brand (fitness/, coupons/, estetica/, ...)
├─ src/lib/
│  ├─ asaas/        # client, checkout, webhook, config
│  ├─ supabase/     # server, admin, browser, types
│  ├─ push/, shipping/, youtube/, estetica/
│  ├─ validations.ts  # ÚNICO LUGAR de schemas Zod
│  ├─ env.ts          # validação runtime de env vars
│  ├─ auth-helpers.ts # isAdmin / requireAdmin
│  ├─ rate-limit.ts   # checkRateLimitAsync (Redis + fallback)
│  ├─ api-error.ts    # handleApiError centralizado
│  └─ notifications.ts
├─ src/middleware.ts  # Clerk + role admin + onboarding gate
├─ supabase/
│  ├─ schema.sql      # base consolidada
│  └─ migration_*.sql # idempotentes (sempre `IF NOT EXISTS`/`OR REPLACE`)
├─ docs/
│  ├─ wiki/           # documentação viva (atualizar com cada feature)
│  └─ audit/          # snapshots de auditoria
└─ public/manifest.json, sw.js
```

**Convenções:**
- Route groups com parênteses (`(app)`, `(auth)`, `(public)`) só para layouts compartilhados; admin é segmento real.
- Componentes brand não vão em `ui/` — `ui/` é reservado para primitivos.
- Hooks ficam em `src/hooks/`; types em `src/types/`; constantes em `src/constants/`.
- Testes ficam ao lado do arquivo (`*.test.ts`) ou em `src/test/`.

---

## 3. Auth, sessão e middleware

### 3.1 Clerk + Supabase
- Auth controlada por **Clerk** (não Supabase Auth).
- JWT do Clerk consumido por Supabase via integração nativa (third-party auth provider). RLS usa `auth.jwt()->>'sub'` — esse valor é o `clerk_user_id` (`user_xxx`).
- Em route handlers / server actions:
  ```ts
  import { auth } from "@clerk/nextjs/server";
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  ```
- Para admin, **sempre** usar o helper centralizado:
  ```ts
  import { requireAdmin } from "@/lib/auth-helpers";
  await requireAdmin(); // throw se não-admin
  ```
- Role admin via `publicMetadata.role = "admin"` no Clerk.
- Onboarding flag via `publicMetadata.onboarding_completed = true`.

### 3.2 Middleware
- `src/middleware.ts` faz: (a) protegê rotas autenticadas; (b) admin gate; (c) onboarding gate.
- **Não duplicar role check no client.** Se a rota está em `/admin/*`, o middleware já garante; verifique apenas o action no servidor.

### 3.3 Forçar autenticação em UI
```tsx
// Server Component
import { currentUser } from "@clerk/nextjs/server";
const user = await currentUser();
if (!user) redirect("/login");
```

---

## 4. Server vs Client Components

### 4.1 Default = Server
- Não escreva `'use client'` por reflexo.
- Server Components fazem: data fetching, render estático, leitura de cookies/headers, sitemap/robots, layouts.
- Passe dados para client como props (serializáveis: sem funções, classes, Date direto).

### 4.2 Quando ir para Client
- `useState`, `useEffect`, `onClick`, `useFormStatus`, browser APIs (geo, push), realtime subscriptions.
- Marque o **menor escopo possível** com `'use client'` — se só o botão é interativo, separe o botão.

### 4.3 Forms — use Server Actions
```tsx
// app/admin/treinos/actions.ts
"use server";
import { requireAdmin } from "@/lib/auth-helpers";
import { createWorkoutSchema, parseFormData } from "@/lib/validations";

export async function createWorkout(formData: FormData) {
  await requireAdmin();
  const data = parseFormData(createWorkoutSchema, formData);
  const supabase = createAdminSupabaseClient();
  await supabase.from("workout_videos").insert(data);
  revalidatePath("/admin/treinos");
}
```
```tsx
// component
<form action={createWorkout}>
  <Input name="title" />
  <SubmitButton>Criar</SubmitButton>
</form>
```
- `<SubmitButton>` deve usar `useFormStatus()` para `disabled` durante pending.

### 4.4 Loading / error / not-found
- Toda rota com fetch significativo: `loading.tsx` com skeleton (não spinner).
- Toda área com risco de erro: `error.tsx` com botão de reset.
- Para 404 contextuais: `not-found.tsx` na rota.

### 4.5 Admin layout
- Admin layout deve ser **Server Component**. Sidebar/menu interativo extraído para `<AdminSidebar />` client.
- `noindex` via `export const metadata = { robots: { index: false, follow: false } }` — **não** via `<meta>` JSX.

---

## 5. API Routes & Server Actions — checklist obrigatório

Toda rota em `app/api/**/route.ts` ou server action:

```ts
export async function POST(req: Request) {
  // 1. Auth (sempre)
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // 2. Rate limit (em endpoints custosos ou públicos)
  const rl = await checkRateLimitAsync(`route:${userId}`, { maxRequests: 5, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: "rate_limit" }, { status: 429 });

  // 3. Validação Zod
  const parsed = mySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    // 4. Cliente Supabase certo
    const supabase = createAdminSupabaseClient();

    // 5. IDOR check em mutations sobre recursos do user
    const { data, error } = await supabase
      .from("foo")
      .select("*")
      .eq("id", parsed.data.id)
      .eq("user_id", userId)
      .single();
    if (error || !data) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // 6. Pricing/decisões NO SERVIDOR
    const finalPrice = recalcPrice(data.price_cents, profile.plan_tier);

    // 7. Mutação atômica (RPC se contador / estoque)
    await supabase.rpc("decrement_stock", { p_id: data.id, p_qty: parsed.data.qty });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // 8. Error handler centralizado
    return handleApiError(err, "POST /api/foo");
  }
}
```

**Regra de bolso para escolha do cliente Supabase:**
| Caso | Cliente |
|------|---------|
| Ação do user (ele lê/escreve seu próprio dado, RLS deve aplicar) | `createServerSupabaseClient()` |
| Webhook externo (Asaas) | `createAdminSupabaseClient()` |
| Admin server action depois de `requireAdmin()` | `createAdminSupabaseClient()` |
| Dashboard admin agregando dados de muitos users | `createAdminSupabaseClient()` |
| Cron / job de sistema | `createAdminSupabaseClient()` |

**Anti-pattern grave:** usar `createAdminSupabaseClient()` em rota normal de user para "evitar problema de RLS". Isso bypassa toda segurança. Se RLS está bloqueando legítimo, **corrija a policy**.

---

## 6. Webhooks

### 6.1 Asaas (`/api/webhook/asaas`)
- **Validar token timing-safe** (`timingSafeEqual`) contra `ASAAS_WEBHOOK_TOKEN`. Já implementado em `lib/asaas/webhook.ts`.
- **Idempotência:** registrar `(payment_id)` em `webhook_events` antes de processar. Se já existe, retornar 200 sem reprocessar.
  - PK deve ser `payment_id` (single column). Se múltiplos events para mesmo pagamento, ordenar por prioridade: `PAYMENT_CONFIRMED` ou `PAYMENT_RECEIVED` define a verdade; `PAYMENT_DELETED` cancela.
- **Em erro de handler:** retornar 5xx para Asaas reentregar. **Nunca** consumir evento e silenciar.
- **`externalReference` é o roteador:**
  - prefixo `estetica:<id>` → `estetica_bookings`
  - prefixo `loja:<id>` ou apenas UUID puro → `orders`
  - sem prefixo → assinatura → `profiles`
- Sempre alimentar `revenue_streams` com a transação confirmada (após criação dessa tabela).

### 6.2 Clerk (a implementar)
- Caso seja necessário sync de delete/email change: criar `/api/webhook/clerk` com Svix signature verification.
- Reagir a `user.deleted` removendo (ou anonimizando) o profile.

### 6.3 Padrão geral
- Toda mutation em webhook = `createAdminSupabaseClient()`.
- Logar resultado estruturado (`console.log(JSON.stringify({ event, payment_id, action }))`).

---

## 7. Database & RLS

### 7.1 Toda tabela nova
```sql
create table public.foo (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  -- campos
  created_at timestamptz not null default now()
);

alter table public.foo enable row level security;

create policy foo_select_own on public.foo for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create policy foo_insert_own on public.foo for insert to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

create policy foo_update_own on public.foo for update to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

create policy foo_admin on public.foo for all to service_role
  using (true) with check (true);

create index idx_foo_user on public.foo(user_id);
```

### 7.2 Migrations
- **Sempre idempotentes:** `if not exists`, `or replace`, `drop ... if exists`.
- Nomear: `migration_<descricao>.sql` ou `migrations/<timestamp>_<descricao>.sql`.
- Comentar no topo o que faz e por quê.
- **Após aplicar em prod:** atualizar `schema.sql` consolidado para refletir o estado atual.
- Tipos TS: regenerar `lib/supabase/types.ts` via `supabase gen types`.

### 7.3 Counters & estoque
- **Nunca** SELECT-then-UPDATE para incremento.
- Sempre RPC com `update foo set count = count + 1 where ...` ou `for update`.
- Funções existentes: `increment_affiliate_clicks`, `increment_coupon_uses`, `decrement_stock`, `increment_stock`. Use-as.

### 7.4 Storage Supabase
- Cada bucket precisa de policies explícitas:
  - **Público leitura** (portfolio, products): `for select to authenticated, anon using (true)` + `for insert/update/delete to service_role using (true)`.
  - **Privado por user** (loyalty): path no formato `{user_id}/...`, policies usando `(storage.foldername(name))[1] = (auth.jwt()->>'sub')`.
- Validar antes de subir: tipo MIME, tamanho máximo, sanitização de nome.

### 7.5 Audit log (planejado)
- Tabela `audit_log(id, actor_id, action, resource_type, resource_id, before jsonb, after jsonb, created_at)`.
- Triggers em `profiles.plan_tier`, `products.price_cents`, `commission_allocations.status`, `orders.status`.

---

## 8. Validação (Zod)

- **Único lugar:** `src/lib/validations.ts`.
- Toda entrada externa (form, body, query) tem schema.
- **Padronizar em `price_cents` (int)**, não `price` (decimal). Onde precisar aceitar decimal de UI:
  ```ts
  price_cents: z.coerce.number().min(0.01).transform(v => Math.round(v * 100))
  ```
- Para arrays multi-select de FormData: usar `formData.getAll(key)`.
- Helper `parseFormData(schema, formData)` está disponível.

---

## 9. Billing, planos e comissões

### 9.1 Estado atual
- Preços em `lib/asaas/config.ts` (`PLAN_PRICES`). FREE/START/PRO/VIP = R$ 0/19/39/99.
- Subscription mensal Asaas. Webhook atualiza `plan_tier`.
- VIP cria automaticamente `consultations` pendente.

### 9.2 Antes de mexer em billing
1. Conferir o impacto em assinantes existentes (Asaas mantém valor antigo até nova subscription).
2. Toda transação confirmada (assinatura/loja/estética/consultoria) **deve** alimentar `revenue_streams` (tabela a criar — ver `docs/audit/2026-05-01-cto-audit.md` §5).
3. Comissões da equipe: `team_members` + `commission_rules` + `commission_allocations`. Job calcula allocations a partir de cada `revenue_stream`.

### 9.3 Regras de produto
- **Downgrade** (quando implementado): marcar como "deferred"; só aplica na próxima renovação.
- **Upgrade**: cria nova subscription, cancela antiga, prorata se possível.
- **Trial**: não existe hoje. Se for adicionar, modelar `trial_ends_at` em `profiles`.
- **PIX manual fallback**: aceitar apenas em dev. Em produção, `ASAAS_API_KEY` deve estar setado e válido — se falhar, retornar 503 e logar para Sentry, não cair em PIX texto.

### 9.4 Quando user mencionar "split", "comissão", "equipe", "porcentagem"
- Trabalhar **sempre** sobre o modelo `revenue_streams` + `commission_allocations`.
- Não criar tabelas paralelas por feature; centralizar no modelo financeiro.

---

## 10. Conteúdo (treinos, dietas, anamnese, planos)

- **Nunca PDF.** Tudo é renderizado como componente nativo dentro do app. Memória durável: `memory/feedback_no_pdf.md`.
- Treinos: `workout_videos` (YouTube unlisted ID + metadata). Player em `components/fitness/video-player.tsx` detecta Shorts vs Normal.
- Consultoria: `consultations.workout_plan` e `diet_plan` em JSONB. Editor admin em `app/admin/consultorias/[id]/plan-editor.tsx`. Templates em `plan_templates`.
- Anamnese: form em `app/(app)/consultoria/anamnese/anamnese-form.tsx`. Persiste em `consultations.anamnesis` JSONB.

**Schema sugerido para JSONB de plano de treino:**
```ts
type WorkoutPlanJson = {
  weeks: Array<{
    week: number;
    days: Array<{
      day: number;
      title: string;
      exercises: Array<{
        name: string; sets: number; reps: string; rest_sec: number;
        video_youtube_id?: string; notes?: string;
      }>;
    }>;
  }>;
};
```
**Schema sugerido para JSONB de dieta:**
```ts
type DietPlanJson = {
  totals: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
  meals: Array<{
    name: string; time?: string;
    items: Array<{ food: string; qty_g: number; kcal: number }>;
  }>;
};
```
Manter consistente para que UI possa renderizar de forma uniforme.

---

## 11. Design System

- Tokens em `src/app/globals.css` via `@theme inline`. Nunca cor hex hardcoded em componente.
- Fontes via `next/font/google` no root layout (`Bebas_Neue`, `Space_Grotesk`, `DM_Mono`). Use `font-display`, `font-body`, `font-mono`.
- Sempre `cn()` (de `@/lib/utils`) para combinar classes.
- Componentes shadcn em `src/components/ui/`; brand custom em `src/components/{dominio}/`.
- Ícones: Lucide React. Tamanhos `16/20/24/32/48`. Stroke padrão (não fill).
- Toasts: `sonner` já configurado no root layout.
- Dark mode é **always-on** (sem toggle). `<html className="dark">`.
- Sem emojis em produção, exceto se explicitamente solicitado.
- Border radius: `rounded-sm` (8), `rounded-md` (14), `rounded-lg` (22), `rounded-xl` (32).

Ver `KATH/designsystem.md` para spec completa.

---

## 12. Segurança operacional

### 12.1 Headers & CSP
- `next.config.ts` define HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- CSP atualmente em **Report-Only**. Antes de promover para enforce: revisar logs por 7 dias e alinhar `connect-src`/`script-src` com qualquer integração nova.

### 12.2 Secrets
- Nunca commitar valores reais.
- `.env.example` é a fonte de verdade dos nomes.
- `lib/env.ts` valida em runtime: `required()` lança em ausência; `requiredInProduction()` permite ausência em dev/preview.
- Em PR: `npm audit --audit-level=high` deve passar.

### 12.3 Rate-limit
- Endpoints públicos ou custosos: aplicar `checkRateLimitAsync` com chave por user/IP.
- Buckets recomendados:
  - Mutations financeiras (`/checkout/*`, `/loja/payment`, `/estetica/bookings/*`): 5/min/user.
  - Push send (admin): 10/min.
  - Affiliate click, coupon use: 60/min/user.
  - Shipping quote: 10/min/user.

### 12.4 Logs & monitoring
- Erros em route handlers: sempre `handleApiError(err, "rota")`.
- Logs estruturados (JSON) — Vercel ingere stdout.
- Sentry ativo em prod via `SENTRY_DSN`. Para o frontend, instalar `@sentry/nextjs` e habilitar no client (planejado).

### 12.5 Sandbox vs produção
- `ASAAS_ENV=sandbox` em dev/preview; `ASAAS_ENV=production` no Vercel prod env.
- Smoke test após cada deploy: criar customer test no sandbox, simular `PAYMENT_CONFIRMED` via Asaas console.

---

## 13. Testes

- Vitest + Testing Library.
- Cobertura mínima por feature nova:
  - Server-side: validação Zod, lógica pura (cálculo de preço, plan_tier_level, splits de comissão), helpers (rate-limit, asaas/webhook).
  - Webhook: idempotência, mapeamento de event → estado, falha controlada.
- **Não mockar DB em testes integration** (memória `feedback_*` reforça). Use Supabase local ou banco de teste.
- Rodar localmente antes de commit: `npm run lint && npm run build && npm run test`.
- CI (`.github/workflows/ci.yml`) bloqueia merge em qualquer falha.

---

## 14. PWA, push e Service Worker

- `public/manifest.json` e `public/sw.js` já existem.
- **Hook órfão a integrar:** `src/hooks/use-push-subscribe.ts`. Conectar no `(app)/layout.tsx` após onboarding completo, com prompt UX (não pedir permissão na primeira tela).
- Service Worker hoje só lida com push. Para offline-first mínimo:
  - Cache de shell (manifest, ícones, fonts) em `install`.
  - `fetch` com `network-first` para HTML, `cache-first` para assets imutáveis.

---

## 15. Performance

- `next/image` com `remotePatterns` específico (sem wildcards). Sempre `alt`, `sizes`, `priority` nos heróis.
- Server Components fazem fetch agregado; evitar N+1 em listas (combinar com joins ou views).
- Suspense + streaming nas listas grandes.
- Não importar grandes libs no client desnecessariamente — code-split com `dynamic`.
- `revalidatePath` / `revalidateTag` após mutations admin para refletir mudança imediata.

---

## 16. Workflow para devs e agentes

### 16.1 Antes de codar
1. Ler `docs/wiki/{dominio|plataforma}/<área>.md`.
2. Ler última auditoria em `docs/audit/`.
3. Confirmar entendimento do fluxo com 2-3 perguntas se algo for ambíguo.
4. Para features de UI/produto, brainstorm primeiro (skill `superpowers:brainstorming` se disponível).

### 16.2 Ao codar
1. Pequenas mudanças incrementais; commits coerentes.
2. Schema Zod antes do route handler.
3. RLS policies antes do CRUD admin/UI.
4. Verificação manual no browser para mudanças de UI.

### 16.3 Antes de fechar PR
1. `npm run lint` — zero erros.
2. `npm run build` — zero warnings novos.
3. `npm run test` — verde.
4. Atualizar `docs/wiki/` se a arquitetura mudou.
5. Adicionar entrada em `docs/audit/` se descobrir novo gap.
6. Não criar arquivos `*.md` aleatórios na raiz; documentação vai em `docs/`.

### 16.4 Code review checklist
- [ ] Cliente Supabase certo (RLS quando user, admin quando service)?
- [ ] Validação Zod em toda entrada externa?
- [ ] Auth/rate-limit em rotas custosas?
- [ ] Pricing/decisão no servidor?
- [ ] RLS policies + indexes no schema?
- [ ] Idempotência em mutations financeiras?
- [ ] Tokens DS, sem hardcode?
- [ ] Server Component por padrão; `'use client'` só onde precisa?
- [ ] Loading/error/not-found states?
- [ ] Tipos atualizados (`lib/supabase/types.ts`)?
- [ ] Sem PDF, sem mock em integração, sem TODO órfão?
- [ ] Wiki atualizado se aplicável?

---

## 17. Anti-patterns proibidos

| Anti-pattern | Por quê | Faça em vez |
|--------------|---------|-------------|
| `'use client'` no `layout.tsx` | Quebra SSC de toda a árvore filha | Layout SSC, extraia componente client |
| `<meta>` JSX para `noindex` em layout | Não chega ao output | `export const metadata = { robots: {...} }` |
| `bg-yellow-500/10` em componente | Quebra DS | Token (`bg-warning/10`) ou criar token |
| SELECT count + UPDATE count+1 | Race condition garantida | RPC `update set col = col + 1` |
| `createAdminSupabaseClient()` em route do user | Bypassa RLS, IDOR fácil | `createServerSupabaseClient()` + checar `user_id` |
| `if (price !== expected)` no client | Tampering trivial | Sempre recalcular no servidor |
| Mock de DB em teste integration | Mascara bug que aparece em prod | Banco real / Supabase local |
| Webhook que retorna 200 em erro de handler | Asaas não reentrega → estado inconsistente | Retornar 5xx, deixar Asaas reentrar |
| `try { ... } catch { /* swallow */ }` | Erros somem; bugs duram meses | `handleApiError(err, "ctx")` ou propagar |
| Hardcoded URL Asaas em código | Quebra em prod | Usar `ASAAS_CONFIG.baseUrl` derivado de `ASAAS_ENV` |
| Cliente fetch direto a Supabase com anon key em mutations sensíveis | Sem auditoria, sem RLS | Server Action ou route handler |
| Conteúdo entregue como PDF | Tira user do app, perde retenção | Componente nativo |
| `console.log(user)` em produção | Vaza PII em logs | Logar IDs/contexto, nunca dados |
| Re-export desnecessário e barrels gigantes | Aumenta bundle, dificulta tree-shake | Importar do arquivo direto |

---

## 18. Como adicionar um novo módulo (template)

1. **Brainstorm:** descrever objetivo, persona, regras de negócio, gates de plano.
2. **DB:** novas tabelas + RLS + indexes em `supabase/migration_<modulo>.sql`. Atualizar `schema.sql`.
3. **Types:** regenerar `lib/supabase/types.ts`.
4. **Validations:** schemas Zod em `lib/validations.ts`.
5. **API/Actions:** route handlers em `app/api/<modulo>/...` ou server actions em `app/<modulo>/actions.ts`. Seguir checklist §5.
6. **UI user:** rota em `app/(app)/<modulo>/`. Server Components + client onde precisa.
7. **UI admin:** rota em `app/admin/<modulo>/`. Layout SSC + client sidebar.
8. **Componentes:** `src/components/<modulo>/`.
9. **Notificações & push:** se aplicável, alimentar `notifications` + push broadcast.
10. **Receita & comissão:** se gera receita, emitir `revenue_streams` + acionar cálculo de `commission_allocations` (após criação dessas tabelas).
11. **Wiki:** criar `docs/wiki/dominio/<modulo>.md` com mapeamento.
12. **Testes:** Zod + lógica pura + happy path.
13. **Browser test** dos fluxos golden e edge.

---

## 19. Referências cruzadas

- Auditoria atual: `docs/audit/2026-05-01-cto-audit.md`
- Wiki domínios: `docs/wiki/dominio/{fitness, kath-estetica, loja, consultoria, cupons, afiliados, chat, perfil-onboarding-planos}.md`
- Wiki plataforma: `docs/wiki/plataforma/{auth, pagamentos-asaas, push-pwa, infra-compartilhada, admin-core, landing}.md`
- Design System: `KATH/designsystem.md`
- PRD/instruções originais: `KATH/instruct.md`
- Memórias persistentes: `memory/MEMORY.md` (carregadas automaticamente em conversas Claude)

---

## 20. Mudanças neste handbook

- Atualizar este arquivo é parte de qualquer mudança que afete convenções.
- Adicionar entrada com data + autor + resumo no fim desta seção.

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-05-01 | CTO Audit | Versão 1.0 inicial — consolida auditoria 2026-05-01 |
