# Apostila Técnica — KathApp

> Material de estudo para **controle técnico total** do KathApp. Cobre os Tiers 2 a 7 do plano de estudos: autenticação, banco/segurança, pagamentos, domínio do produto, infraestrutura e qualidade. Ancorada no **código real** do repositório (referências `arquivo:linha`), com estudos de caso dos bugs reais que enfrentamos e exercícios ao final de cada módulo.
>
> ~90-105 páginas no total. Escrita em 2026-05-22.

## Como usar

- Leia **na ordem dos módulos** — eles se referenciam (ex.: RLS no Módulo 2 explica o "vídeos vazios" introduzido no Módulo 1).
- Cada seção tem: **conceito → como funciona → "No KathApp" (com `arquivo:linha`) → ⚠️ armadilhas → exercícios**.
- Abra o arquivo citado em paralelo no VS Code e confirme o que está lendo no código real. O melhor jeito de fixar é **ler a apostila com o arquivo aberto ao lado**.
- As caixas **⚠️ Armadilha** são o "conhecimento escondido" — os pontos que falham silenciosamente em produção. Dê atenção redobrada a elas.

## Sumário

| # | Módulo | Tier | O que você domina ao fim | Páginas |
|---|--------|------|--------------------------|---------|
| 1 | [Autenticação & Identidade](./01-autenticacao-identidade.md) | 2 | Clerk (dev×prod, claims, session token), integração Clerk↔Supabase RLS, middleware de gate. **Resolve o bloqueador "app aparece vazio".** | ~14 |
| 2 | [Banco de Dados & Segurança](./02-banco-seguranca.md) | 3 | PostgreSQL aplicado, RLS a fundo, triggers de segurança, os 2 clientes Supabase, workflow de migrations, RPCs atômicas. | ~17 |
| 3 | [Pagamentos & Modelo Financeiro](./03-pagamentos-financeiro.md) | 4 | Asaas (sandbox×prod, IP allowlist, PIX), assinaturas/cobranças/webhooks idempotentes, `revenue_streams`/wallet/comissões, pricing no servidor. **Onde mora a receita.** | ~19 |
| 4 | [Domínio do Produto](./04-dominio-produto.md) | 5 | Gating por plano, Fitness/Estética/Loja e os transversais (Consultoria, Cupons, Afiliados, Chat, Push, Cashback). | ~15 |
| 5 | [Infraestrutura, Deploy & Operação](./05-infra-deploy.md) | 6 | Vercel/envs/logs, topologia de branches, rate limit (Redis), crons, CSP, Web Push. | ~15 |
| 6 | [Qualidade & Observabilidade](./06-qualidade-observabilidade.md) | 7 | Vitest, Zod, contrato de erros, Sentry, CI, disciplina de qualidade. | ~12 |

## Caminho de estudo recomendado

1. **Módulos 1 + 2** primeiro — auth + RLS é o que mais te dá controle e o que **trava o app hoje** (claim `role` no Clerk + Third-Party Auth no Supabase). Domine o fluxo *"JWT do Clerk → claim role → PostgREST → policy RLS"*.
2. **Módulo 3** — pagamentos e modelo financeiro: maior risco de bug caro (receita).
3. **Módulos 4 → 6** — domínio, infra e qualidade, conforme for tocando cada área.

## Pré-requisito (Tier 1, fora desta apostila)

Esta apostila assume base em **Next.js 15 App Router, React Server Components e TypeScript**. Se precisar reforçar, estude antes: Server vs Client Components, Server Actions vs Route Handlers, `layout.tsx`/route groups, e tipos gerados do banco. (Ver Tier 1 do plano de estudos.)

## Documentos relacionados no repo

- `CLAUDE.md` — regras inegociáveis do projeto (resumo).
- `docs/HANDBOOK.md` — detalhamento das regras.
- `docs/audit/2026-05-22-cto-audit-followup.md` — estado atual + bloqueadores pendentes.
- `docs/deploy/clerk-supabase-rls.md` — procedimento da integração que destrava a RLS.
- `docs/wiki/` — wiki por domínio/plataforma.

---

*Apostila gerada a partir do código real em 2026-05-22. Ao evoluir o código, revise as referências `arquivo:linha` — elas refletem o estado naquela data.*
