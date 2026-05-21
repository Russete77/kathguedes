# Fase A — Mapa do que existe (Wiki Completa) — Design

**Data:** 2026-04-28
**Projeto:** KathApp
**Fase:** A de 4 (A: Mapa · B: Auditoria · C: Diagramas · D: Arquitetura)

---

## 1. Objetivo

Produzir uma **wiki técnica completa** do KathApp documentando todo o que existe hoje — features, rotas, componentes, server actions, API routes, modelo de dados, integrações e fluxos — de forma que qualquer dev consiga entender o sistema inteiro consultando apenas `docs/wiki/`.

A wiki é a **base** das fases B (auditoria de gaps), C (diagramas de fluxo) e D (revisão arquitetural). Sem o mapa, as outras fases trabalham no escuro.

## 2. Escopo

**Dentro:**
- Todo o código em `src/` (rotas, componentes, libs).
- Schema Supabase (`supabase/schema.sql` + migrations).
- Integrações externas: Clerk, Asaas, VAPID/Web Push, YouTube.
- Configuração: `middleware.ts`, `next.config.ts`, env vars, `manifest.json`, `sw.js`.
- Status percebido de cada feature (production / beta / WIP / stub).

**Fora:**
- Auditoria detalhada de bugs e gaps → **Fase B**.
- Diagramas visuais (mermaid, fluxogramas) → **Fase C**.
- Avaliação arquitetural (camadas, acoplamento) → **Fase D**.
- Implementação de melhorias.
- Tradução para outros idiomas.

## 3. Particionamento — 14 Setores

Cada setor vira um arquivo markdown produzido por um agente independente em paralelo.

### 3.1 Domínio (8) — cobrem user + admin + api + DB do domínio inteiro

| # | Setor | Escopo |
|---|---|---|
| 1 | **Fitness** | `/fitness`, `/desafio`, `/calculadora`, `components/fitness`, `api/workout`, `admin/treinos`, migrations workout |
| 2 | **Loja** | `/loja`, `api/loja`, `api/checkout`, `lib/shipping`, `admin/loja`, migrations loja/shipping |
| 3 | **Cupons** | `/cupons`, `components/coupons`, `api/coupon`, `admin/cupons` |
| 4 | **Afiliados** | `/afiliados`, `components/affiliates`, `api/affiliate`, `admin/afiliados` |
| 5 | **Consultoria** | `/consultoria`, `api/consultoria`, `admin/consultorias`, migration consultations_inapp |
| 6 | **Chat** | `/chat`, `admin/chat` |
| 7 | **Kath Estética** | `/kath-estetica`, `components/estetica`, `lib/estetica`, `api/estetica`, `admin/kath-estetica`, migration kath_estetica |
| 8 | **Perfil, Onboarding & Planos** | `/perfil`, `/onboarding`, `/planos`, `/dashboard`, `api/onboarding`, `components/plans`, migration phone |

### 3.2 Plataforma (6) — crosscutting

| # | Setor | Escopo |
|---|---|---|
| 9 | **Auth & Middleware** | `/login`, `/registro`, `middleware.ts`, `lib/auth-helpers.ts`, integração Clerk↔Supabase |
| 10 | **Pagamentos (Asaas)** | `lib/asaas`, `api/webhook`, integração com checkout/consultoria/loja/estética |
| 11 | **Push & PWA** | `lib/push`, `lib/notifications.ts`, `api/push`, `public/sw.js`, `public/manifest.json`, `admin/push`, `admin/templates` |
| 12 | **Admin Core** | `/admin` overview, `admin/dashboard`, `admin/assinantes`, `admin/actions.ts`, layout admin (apenas o que não é coberto pelos agentes de domínio) |
| 13 | **Infra Compartilhada** | `lib/supabase`, `lib/env.ts`, `lib/rate-limit.ts`, `lib/api-error.ts`, `lib/validations.ts`, `lib/utils.ts`, `lib/youtube`, `supabase/schema.sql`, RLS patterns globais |
| 14 | **Landing Pública** | `/(public)`, `components/landing`, `robots.ts`, `sitemap.ts`, SEO |

## 4. Template Padrão por Setor

Cada arquivo segue rigorosamente este template, em **PT-BR**:

```markdown
# Setor: <Nome>

## 1. Visão geral
- Propósito (1-2 frases)
- Quem usa: usuário final / admin / ambos
- Status percebido: production / beta / WIP / stub

## 2. Rotas
| Path | Arquivo | Tipo (page/layout) | Descrição |

## 3. Componentes
- Lista de componentes principais com responsabilidade

## 4. Server Actions / API Routes
| Endpoint/Action | Método | Input (Zod) | Output | Quem chama |

## 5. Modelo de dados
- Tabelas Supabase próprias do setor (colunas-chave + tipos)
- Policies RLS aplicáveis

## 6. Integrações externas
- Clerk, Asaas, VAPID, YouTube, etc. (apenas as relevantes)

## 7. Validações
- Schemas Zod referenciados (de `lib/validations.ts` ou inline)

## 8. Fluxos principais
- Narrativa numerada de cada fluxo de ponta a ponta
- Ex: "Usuário compra consultoria" → 1. clica… 2. checkout… 3. webhook…

## 9. Observações (não é auditoria — apenas notas para Fase B)
- TODOs e comentários visíveis no código
- Stubs / placeholders óbvios
- Pontos a investigar na Fase B

## 10. Referências
- Arquivos-chave (path:linha)
- Migrations relacionadas
- Setores cruzados (links para outros docs da wiki)
```

**Audiência:** dev técnico que conhece a stack (Next.js App Router, React 19, Supabase, Clerk, Tailwind v4).

## 5. Estrutura de Arquivos

```
docs/wiki/
├── README.md                       ← índice mestre (escrito por mim DEPOIS dos agentes)
├── dominio/
│   ├── fitness.md
│   ├── loja.md
│   ├── cupons.md
│   ├── afiliados.md
│   ├── consultoria.md
│   ├── chat.md
│   ├── kath-estetica.md
│   └── perfil-onboarding-planos.md
└── plataforma/
    ├── auth.md
    ├── pagamentos-asaas.md
    ├── push-pwa.md
    ├── admin-core.md
    ├── infra-compartilhada.md
    └── landing.md
```

## 6. Estratégia Anti-Duplicação

Como os 14 agentes rodam em paralelo, sem coordenação eles vão duplicar conteúdo (ex: tabela `products` aparecer em Loja, Infra e Pagamentos). Regras:

1. **Tabelas Supabase:** documentadas **apenas** pelo setor de domínio dono. Infra Compartilhada documenta **patterns** de schema, conventions e RLS globais — não tabelas específicas.
2. **Auth, Pagamentos, Push:** documentados apenas pelo setor da plataforma. Domínios que consomem apenas **referenciam** com link cruzado (sem repetir detalhes).
3. **Validações compartilhadas:** se um schema Zod vem de `lib/validations.ts`, o setor que usa **referencia o nome**; quem documenta o schema completo é o consumidor "dono lógico" (geralmente o domínio).
4. **Seção "Referências"** de cada doc lista todos os outros setores tocados, com link relativo.

## 7. Índice Mestre (`docs/wiki/README.md`)

Escrito **depois** que os 14 agentes terminam (porque depende do que produziram). Conteúdo:

- Visão de 1 página do KathApp (stack, propósito, audiência).
- Tabela mestre: **Setor → arquivo → status → 1 frase descritiva**.
- Mapa de dependências entre setores (texto, não diagrama — diagramas são Fase C).
- Convenções de leitura (como navegar a wiki).

## 8. Estratégia de Execução

- **14 agentes em paralelo**, um por setor, todos com prompt baseado no template da seção 4 + escopo da seção 3 + regras anti-duplicação da seção 6.
- Cada agente é **read-only** durante a investigação e **escreve apenas seu próprio arquivo** ao final.
- Subagent type: `general-purpose` (ou `Explore` para os mais simples).
- Após os 14 entregarem, eu (orquestrador) escrevo `docs/wiki/README.md`.
- Nenhum agente modifica código de produção.

## 9. Critérios de Aceitação

A Fase A está completa quando:

- [ ] Os 14 arquivos de setor existem em `docs/wiki/` seguindo o template.
- [ ] Cada arquivo tem todas as 10 seções preenchidas (ou marcadas explicitamente como N/A com justificativa).
- [ ] Todas as rotas em `src/app/` aparecem em pelo menos um setor.
- [ ] Todos os arquivos em `src/components/`, `src/lib/`, `src/app/api/` aparecem em pelo menos um setor.
- [ ] Todas as migrations em `supabase/` são referenciadas por algum setor.
- [ ] Não há duplicação entre setores (cada tabela Supabase aparece em exatamente um setor).
- [ ] `docs/wiki/README.md` existe com índice mestre completo.
- [ ] Tudo commitado em git.

## 10. Próximas Fases

- **Fase B — Auditoria:** usa a wiki como base para auditar gaps, bugs e inconsistências. Spec separado.
- **Fase C — Diagramas:** transforma os fluxos da seção 8 de cada doc em diagramas mermaid. Spec separado.
- **Fase D — Arquitetura:** avalia camadas, acoplamento, segurança, performance usando wiki + auditoria. Spec separado.
