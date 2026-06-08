# Wiki KathApp

Mapa técnico completo do KathApp. Cada setor vira um documento independente seguindo o template padronizado de 10 seções.

> Gerado em 2026-04-28 como parte da **Fase A — Mapa do que existe**. Auditoria CTO concluída em 2026-05-01 (`docs/audit/2026-05-01-cto-audit.md`). **Refactor do modelo financeiro completo em 2026-05-02** — 6 tiers de plano, receita unificada, comissões automáticas, cashback wallet. Documentação consolidada em [`plataforma/financeiro.md`](plataforma/financeiro.md).

## Stack

- **Frontend:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4 (`@tailwindcss/postcss`), shadcn-style UI, `@base-ui/react`
- **Backend:** Server Actions + API Routes (Next.js)
- **DB:** Supabase (PostgreSQL + RLS)
- **Auth:** Clerk (integração nativa com Supabase via JWT)
- **Pagamentos:** Asaas (PIX, Boleto, Cartão)
- **Push:** Web Push API (VAPID, `web-push`)
- **Realtime:** Supabase Realtime (chat VIP)
- **Cache/Rate-limit:** Redis (`ioredis`) com fallback in-memory
- **Deploy:** Vercel · **PWA:** Service Worker nativo
- **Testes:** Vitest + Testing Library

## Como ler

Cada doc segue exatamente este template (10 seções):

1. **Visão geral** — propósito, público, status
2. **Rotas** — paths e arquivos
3. **Componentes** — UI principal e responsabilidades
4. **Server Actions / API Routes** — endpoints com input/output/quem chama
5. **Modelo de dados** — tabelas Supabase do setor + RLS
6. **Integrações externas** — Clerk, Asaas, VAPID, YouTube, etc.
7. **Validações** — schemas Zod referenciados
8. **Fluxos principais** — narrativa de ponta a ponta
9. **Observações** — TODOs/stubs/pontos para Fase B (não é auditoria)
10. **Referências** — arquivos-chave + migrations + setores cruzados

**Convenções:**
- Toda referência `arquivo:linha` mapeia para o código real.
- Tabelas Supabase aparecem **uma única vez**, no doc do setor dono. `infra-compartilhada.md` apenas lista para contexto e remete ao dono.
- **Status:** `production` (em uso pleno) · `beta` (funcional, sem polimento) · `WIP` (em construção) · `stub` (placeholder não funcional).

## Domínio (8 setores)

Cobrem ponta a ponta: rotas user + componentes + admin + API/Actions + DB do domínio.

| Setor | Arquivo | Status | Resumo |
|---|---|---|---|
| **Fitness** | [dominio/fitness.md](dominio/fitness.md) | production | Biblioteca de treinos em vídeo (YouTube embed), registro/streak, desafio 7 dias e calculadora de macros (Harris-Benedict). Gated por plano. |
| **Loja** | [dominio/loja.md](dominio/loja.md) | production | E-commerce de produtos físicos: vitrine, carrinho, frete multi-provedor (Melhor Envio + 99 + Lalamove), checkout Pix via Asaas, "Meus Pedidos" e admin completo. |
| **Cupons** | [dominio/cupons.md](dominio/cupons.md) | production | Cupons de desconto em marcas parceiras com gating por plano, contagem regressiva ("Flash Deals") e CRUD admin com push opcional. |
| **Afiliados** | [dominio/afiliados.md](dominio/afiliados.md) | production | Vitrine de produtos recomendados (Amazon, Mercado Livre, Shopee, parcerias) com tracking de cliques (rate-limited). |
| **Consultoria** | [dominio/consultoria.md](dominio/consultoria.md) | production | Consultoria fitness/dieta: anamnese 7 etapas, montagem de plano JSONB pelo admin, auto-criação para VIP via webhook Asaas. |
| **Chat** | [dominio/chat.md](dominio/chat.md) | production | Mensagens diretas assinante-VIP ↔ Kath via Supabase Realtime, com push notification quando admin responde. |
| **Kath Estética** | [dominio/kath-estetica.md](dominio/kath-estetica.md) | production | Módulo Estética Moto: agendamento com slots dinâmicos, pagamento Pix Asaas, programa de fidelidade (4 fotos aprovadas → 5ª lavagem grátis), portfólio. |
| **Perfil, Onboarding & Planos** | [dominio/perfil-onboarding-planos.md](dominio/perfil-onboarding-planos.md) | production | Onboarding (telefone + interesses), perfil, dashboard pessoal e contratação de planos (Free/Start/Pro/VIP) via Asaas. |

## Plataforma (6 setores)

Capacidades crosscutting consumidas por múltiplos domínios.

| Setor | Arquivo | Status | Resumo |
|---|---|---|---|
| **Auth & Middleware** | [plataforma/auth.md](plataforma/auth.md) | production | Clerk (login/registro com `[[...rest]]`), middleware único (proteção + role admin + enforcement de onboarding), integração JWT nativa com Supabase. |
| **Pagamentos (Asaas)** | [plataforma/pagamentos-asaas.md](plataforma/pagamentos-asaas.md) | production | Cliente HTTP, helpers de checkout, webhook receiver com idempotência (`webhook_events` PK), 6 eventos tratados, roteamento por `externalReference`. |
| **Push & PWA** | [plataforma/push-pwa.md](plataforma/push-pwa.md) | production | Web Push (VAPID + `web-push`), Service Worker, PWA manifest, camada `notifyUser`/`notifyByPlan`/`notifyAll`, admin de envio em `/admin/push`. |
| **Admin Core** | [plataforma/admin-core.md](plataforma/admin-core.md) | production | Shell e layout do `/admin`, role-gate Clerk, dashboard agregado (~27 queries), gestão de assinantes, `actions.ts` com Server Actions transversais. |
| **Infra Compartilhada** | [plataforma/infra-compartilhada.md](plataforma/infra-compartilhada.md) | production | Clients Supabase (browser/server/admin), env validation, rate-limit Redis com fallback, schemas Zod centrais, schema base SQL, helpers RLS, fix migrations globais. |
| **Landing Pública** | [plataforma/landing.md](plataforma/landing.md) | production | Home `/` densa (827 linhas), SEO técnico (`robots.ts` + `sitemap.ts` com URLs dinâmicas), JSON-LD, biblioteca de componentes de animação. |

## Mapa de dependências entre setores

Diagramas visuais virão na Fase C. Por ora, a leitura textual:

- **Fitness** depende de: Auth, Push (notificações), Infra (Supabase, validations).
- **Loja** depende de: Auth, Pagamentos (Pix/checkout), Cupons (uso no carrinho), Push (status do pedido), Infra.
- **Cupons** depende de: Auth, Push (admin pode notificar), Infra. Consumido por: Loja.
- **Afiliados** depende de: Auth, Infra (rate-limit).
- **Consultoria** depende de: Auth, Pagamentos (auto-criação VIP via webhook), Push (entrega de plano), Chat (referência), Infra.
- **Chat** depende de: Auth, Push (notify resposta), Infra (Supabase Realtime).
- **Kath Estética** depende de: Auth, Pagamentos (Pix avulso), Push, Infra (storage buckets).
- **Perfil, Onboarding & Planos** depende de: Auth (forte — middleware enforcement), Pagamentos (assinatura recorrente), Infra.
- **Auth & Middleware** depende de: Clerk, Infra (Supabase clients).
- **Pagamentos (Asaas)** depende de: Infra (`webhook_events`, env vars). Consumido por: Loja, Consultoria, Estética, Perfil/Planos.
- **Push & PWA** depende de: Auth, Infra (`push_subscriptions`, `notifications`). Consumido por: virtualmente todos os setores.
- **Admin Core** depende de: Auth (role admin), Infra. Consome todas as Server Actions de domínio.
- **Infra Compartilhada** é a base — não depende de nenhum setor de domínio.
- **Landing Pública** depende de: Infra (Supabase admin para sitemap dinâmico). Linka para Auth (CTAs).

(Cada link específico está nas seções "10. Referências" dos docs individuais.)

## Achados notáveis (resumo de "Observações" para Fase B)

Pontos de atenção sinalizados pelos 14 agentes — entrarão como entrada para a auditoria:

- **Fitness:** `updateWorkout` sem Zod; categorias do client (6) ≠ categorias do banco (17); `/desafio` é stub que reaproveita os 7 últimos treinos; cálculo de streak por janela 24/48h tem edge cases.
- **Loja:** `shipping_cost_cents` confiado do client; Lalamove parcial (HMAC stub); `variants` sem UI de escrita; colunas `shipping_*` em `orders` ausentes nas migrations conhecidas.
- **Cupons:** verificação "se usuário já usou este cupom" descrita em comentário mas **não implementada** — `uses_count` é global.
- **Afiliados:** RPC atômica `increment_affiliate_clicks` existe mas não é usada; UPDATE direto no client substitui.
- **Consultoria:** validação fraca da anamnese; mismatch de nomes (`equipment` vs `equipments`, `mealFrequency` vs `mealsPerDay`); `workout_plan.weeks` preparado para múltiplas semanas mas só `[0]` usado; sem job para `expired`.
- **Chat:** `is_read` nunca é marcado; admin escreve `is_from_kath: true` via cliente browser (potencial conflito com RLS); sem rate-limit no envio.
- **Kath Estética:** documentação extensa, sem alertas críticos imediatos.
- **Perfil/Onboarding/Planos:** sem Zod no `/api/onboarding`; telefone sem normalização; `src/components/plans/` vazio; downgrade não implementado; sem testes.
- **Auth:** compat duplicado de claims; type-cast sem Zod; branch redundante no middleware.
- **Pagamentos:** `setTimeout 1.5s` arbitrário no checkout; ausência de Zod no webhook; drift entre `migration_fixes.sql` e `migrations/`.
- **Push:** hook `usePushSubscribe` órfão (zero consumidores); subscriptions stale (410/404) não purgadas; sem unique constraint `(user_id, endpoint)`.
- **Admin Core:** sem audit trail; `src/components/admin/` vazia; validações Zod ausentes em vários updates; "Kath Guedes" hardcoded; `seedDefaultTemplates` ~300 linhas inline.
- **Infra Compartilhada:** discrepância de categorias `createWorkoutSchema` (17) vs DB constraint (6); tipagens Supabase duplicadas (manual vs gerada); `api-error.ts` praticamente não consumido.
- **Landing:** 8 dos 11 componentes em `src/components/landing/` não são consumidos pela home atual.

## Próximas fases

| Fase | Foco | Entregável |
|---|---|---|
| **B — Auditoria** | Gaps, bugs, inconsistências priorizadas | Lista de issues com severidade |
| **C — Diagramas** | Visualizar fluxos da §8 de cada doc | Diagramas mermaid por fluxo |
| **D — Arquitetura** | Camadas, segurança, performance, acoplamento | Doc de revisão arquitetural |

Cada fase terá seu próprio spec e plan em `docs/superpowers/`.
