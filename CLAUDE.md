# CLAUDE.md — KathApp

> Carregado automaticamente em sessões Claude Code. Versão curta. Para detalhes, sempre ler `docs/HANDBOOK.md` antes de codar.

## Contexto
- App de Kath Guedes (atleta Bikini, 351K seguidores). Stack: Next.js 15 (App Router) + TypeScript + Tailwind v4 + shadcn/ui + Supabase Postgres + Clerk (auth) + Asaas (pagamentos) + Vercel. PWA dark always-on.
- 4 planos: FREE / START R$19 / PRO R$39 / VIP R$99. 3 módulos principais: Fitness, Kath Estética, Loja + funcionalidades transversais (Consultoria VIP, Cupons, Afiliados, Chat VIP).
- Status: produção em curso. Desenvolvimento "production-first": sem retrabalho, sem mock, sem código sujo.

## Regras inegociáveis (TL;DR — ver `docs/HANDBOOK.md` para detalhes)
1. **Antes de tocar em código, ler `docs/wiki/{dominio|plataforma}/<área>.md` + a auditoria mais recente em `docs/audit/`.**
2. **Server Component por padrão.** `'use client'` só para interatividade real. Forms = Server Actions.
3. **Validação Zod sempre em `src/lib/validations.ts`.** Toda entrada externa.
4. **Pricing/decisão no servidor.** Cliente envia IDs; servidor recalcula valor, desconto, gate por plano.
5. **Cliente Supabase certo:** `createServerSupabaseClient()` para ações do user (RLS aplica), `createAdminSupabaseClient()` só em webhook/admin/cron.
6. **RLS é a fronteira de segurança.** Toda tabela: `enable row level security` + 4 policies (select/insert/update_own + admin).
7. **Counters são atômicos via RPC** (`update set col = col + 1`). NUNCA SELECT-then-UPDATE.
8. **Webhook idempotente.** Erro de handler = 5xx para reentregar.
9. **Auth admin centralizada:** `requireAdmin()` de `lib/auth-helpers.ts`. Não duplicar no client.
10. **Conteúdo sempre in-app.** Treinos, dietas, anamneses — componentes nativos. **Nunca PDF.**
11. **Design System:** tokens (`bg-bg-1`, `text-pink`), `cn()`, `next/font`, `next/image`. Sem hex hardcoded em componente.
12. **Sem emojis** em código de produção, salvo se o user pedir.
13. **Idiomas:** UI em pt-BR. Mensagens de erro técnicas (route handlers) em inglês curto. Code/identifiers em inglês.
14. **Antes de fechar trabalho:** `npm run lint && npm run build && npm run test` + browser test do fluxo afetado.

## Cliente Supabase — qual usar?
| Caso | Cliente |
|------|---------|
| User lê/escreve seu próprio dado | `createServerSupabaseClient()` |
| Webhook externo (Asaas/Clerk) | `createAdminSupabaseClient()` |
| Admin server action após `requireAdmin()` | `createAdminSupabaseClient()` |
| Cron / job | `createAdminSupabaseClient()` |

**Anti-pattern:** usar admin para "evitar problema de RLS" em rota normal. Se RLS bloqueia legítimo, **corrija a policy**.

## Anti-patterns proibidos (lista curta)
- `'use client'` no `layout.tsx`
- `<meta noindex>` JSX em layout (use `export const metadata`)
- Cor hex hardcoded em componente
- SELECT-then-UPDATE para contador
- `createAdminSupabaseClient()` em rota normal de user
- Validar preço no client
- `try { ... } catch { /* swallow */ }`
- Webhook que retorna 200 em erro de handler
- PDF para conteúdo
- Mock de DB em teste integration

## Onde está o quê
- Schemas Zod: `src/lib/validations.ts`
- Auth helpers: `src/lib/auth-helpers.ts`
- Asaas: `src/lib/asaas/{client,checkout,webhook,config}.ts`
- Supabase: `src/lib/supabase/{server,admin,browser,types}.ts`
- Rate limit: `src/lib/rate-limit.ts` (`checkRateLimitAsync`)
- Error handler: `src/lib/api-error.ts` (`handleApiError`)
- Env validation: `src/lib/env.ts`
- Design tokens: `src/app/globals.css`
- DB: `supabase/schema.sql` + `supabase/migration_*.sql`
- Wiki: `docs/wiki/`
- Auditoria: `docs/audit/`
- Handbook: `docs/HANDBOOK.md`

## Stack pinado
- Next.js 15.5.x (App Router) + React 19.x
- Clerk v7 (`@clerk/nextjs`) — JWT nativo Clerk-Supabase, RLS via `auth.jwt()->>'sub'`
- Supabase v2 SDK
- Asaas (sandbox/prod via `ASAAS_ENV`)
- Tailwind v4 + shadcn/ui
- ioredis 5 (rate-limit)
- web-push 3 (VAPID)

## Quando o user falar de:
- **planos / billing / preços:** sempre considerar impacto em assinantes existentes (Asaas mantém valor antigo até nova subscription). Recalcular no servidor.
- **comissões / equipe / split:** trabalhar sobre o modelo `revenue_streams` + `team_members` + `commission_allocations` (descrito em `docs/audit/2026-05-01-cto-audit.md` §5). Não criar tabelas paralelas por feature.
- **bug em pagamento:** cheque webhook idempotência, `webhook_events`, e logs do handler.
- **acesso negado:** primeiro suspeitar de RLS policy faltando, não de bypass com service role.
- **lentidão:** ver index, depois subqueries em RLS, depois N+1, depois client-side over-fetching.

## Fluxo de trabalho preferido
1. Brainstorm (skill `superpowers:brainstorming` se disponível) antes de feature de produto.
2. Plano em `docs/wiki/` ou comentário no PR.
3. Schema/RLS primeiro, depois API/actions, depois UI.
4. Testar em partes; não acumular trabalho sem verificar.
5. Atualizar `docs/wiki/` ao fim.

---

Se entrar em conflito com instruções diretas do user, instruções do user vencem. Mas pergunte se o conflito é intencional.
