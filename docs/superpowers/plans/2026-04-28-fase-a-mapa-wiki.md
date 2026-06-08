# Fase A — Mapa do que existe (Wiki) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produzir `docs/wiki/` com 14 documentos markdown (um por setor) + um `README.md` mestre, mapeando todo o KathApp.

**Architecture:** 14 agentes `general-purpose` rodam em paralelo, cada um lendo apenas seu escopo de arquivos e escrevendo **um único** markdown seguindo o template de 10 seções. O orquestrador (Claude principal) verifica cobertura e duplicação, depois escreve o `README.md` mestre.

**Tech Stack:** Agent tool (`general-purpose` subagents), Bash, Read/Grep/Glob (read-only no código de produção), Write (apenas docs).

**Spec base:** `docs/superpowers/specs/2026-04-28-fase-a-mapa-wiki-design.md`

---

## File Structure

| Caminho | Tipo | Responsabilidade |
|---|---|---|
| `docs/wiki/README.md` | Output | Índice mestre escrito pelo orquestrador |
| `docs/wiki/dominio/{fitness,loja,cupons,afiliados,consultoria,chat,kath-estetica,perfil-onboarding-planos}.md` | Output | 8 docs de domínio (1 agente cada) |
| `docs/wiki/plataforma/{auth,pagamentos-asaas,push-pwa,admin-core,infra-compartilhada,landing}.md` | Output | 6 docs de plataforma (1 agente cada) |

Nenhum código de produção é modificado.

---

## Task 1: Scaffolding de `docs/wiki/`

**Files:**
- Create: `docs/wiki/dominio/.gitkeep`
- Create: `docs/wiki/plataforma/.gitkeep`

- [ ] **Step 1: Criar diretórios**

```bash
mkdir -p "C:/Users/erick/KATH-GUEDES/kathapp/docs/wiki/dominio"
mkdir -p "C:/Users/erick/KATH-GUEDES/kathapp/docs/wiki/plataforma"
```

- [ ] **Step 2: Verificar estrutura**

```bash
ls -la "C:/Users/erick/KATH-GUEDES/kathapp/docs/wiki/"
```

Expected: dois subdiretórios (`dominio/` e `plataforma/`) listados.

- [ ] **Step 3: Não commit ainda**

Commits agrupados no final (Task 5).

---

## Task 2: Definir prompt-base do agente (referência inline)

Esta task **não cria arquivo**. Documenta o template de prompt que o orquestrador usa nos 14 dispatches da Task 3. Mantido inline para garantir consistência entre os 14 agentes.

- [ ] **Step 1: Conferir o prompt-base abaixo, sem alteração**

````
Você está documentando o setor "{SETOR_NAME}" do projeto KathApp como parte de uma equipe paralela de 14 agentes. Sua entrega é UM ÚNICO arquivo markdown em PT-BR.

# Contexto do projeto
KathApp = Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4 + Supabase + Clerk + Asaas + Web Push (VAPID).
Raiz do código: C:\Users\erick\KATH-GUEDES\kathapp
Spec orientadora: docs/superpowers/specs/2026-04-28-fase-a-mapa-wiki-design.md (leia se quiser contexto adicional)

# Seu escopo (investigue APENAS estes paths)
{SCOPE_PATHS}

# Onde gravar
{OUTPUT_PATH}

# Restrições operacionais
- READ-ONLY no código de produção. Use Read, Grep, Glob, Bash (apenas `ls`/`git log`). NUNCA edite código.
- Idioma: PT-BR.
- Crie APENAS o arquivo de saída acima. Nada mais.
- Se uma seção do template não se aplica, escreva "N/A" com justificativa de uma linha.
- Se encontrar arquivos/tabelas/integrações fora do seu escopo, mencione-os em "10. Referências" como link cruzado, mas NÃO os documente aqui (outro agente cuida).
- Toda afirmação concreta deve referenciar `arquivo:linha` ou nome de migration.
- Tamanho-alvo: 200-600 linhas de markdown. Qualidade > volume.

# Regras anti-duplicação
- Tabelas Supabase: documente APENAS as do seu setor. Patterns globais de schema/RLS são responsabilidade do agente "Infra Compartilhada".
- Auth/Pagamentos/Push: se seu setor consome esses subsistemas, REFERENCIE com link cruzado; quem documenta detalhes é o setor de plataforma correspondente.
- Schemas Zod compartilhados (`lib/validations.ts`): cite o nome do schema; só descreva campos completos se você é o setor "dono lógico".

# Template OBRIGATÓRIO de saída (preencha exatamente esta estrutura)

```markdown
# Setor: {SETOR_NAME}

## 1. Visão geral
- **Propósito:** <1-2 frases>
- **Quem usa:** <usuário final / admin / ambos>
- **Status percebido:** <production | beta | WIP | stub>

## 2. Rotas

| Path | Arquivo | Tipo | Descrição |
|---|---|---|---|
| /exemplo | src/app/.../page.tsx:1 | page | <descrição> |

## 3. Componentes

- **`<NomeComponente>`** (`src/components/.../arquivo.tsx:linha`) — responsabilidade.

## 4. Server Actions / API Routes

| Endpoint/Action | Método | Input | Output | Quem chama |
|---|---|---|---|---|
| /api/... | POST | Zod schema X | { ok: bool } | <componente/rota> |

## 5. Modelo de dados

### Tabela `<nome>` (`supabase/migration_xxx.sql`)
- `coluna`: tipo — descrição
- **RLS:** <resumo das policies, se houver>

## 6. Integrações externas
- <Clerk / Asaas / VAPID / YouTube / outras> — como é usada aqui (link cruzado para o setor de plataforma).

## 7. Validações
- **`<nomeSchema>`** (`src/lib/validations.ts:linha` ou inline) — campos validados.

## 8. Fluxos principais

### Fluxo: <nome do fluxo>
1. Passo 1 (componente/rota envolvido)
2. Passo 2
3. ...

## 9. Observações (notas para Fase B — não auditar agora)
- TODOs/FIXMEs visíveis no código (cite arquivo:linha).
- Stubs ou placeholders óbvios.
- Pontos suspeitos a investigar na Fase B.

## 10. Referências
- **Arquivos-chave:** lista `path:linha`.
- **Migrations:** lista de arquivos.
- **Setores cruzados:** links relativos para outros docs da wiki (ex.: `../plataforma/pagamentos-asaas.md`).
```

# Quando terminar
Reporte apenas o caminho do arquivo que você criou e um resumo de 2-3 linhas do que documentou.
````

---

## Task 3: Dispatch dos 14 agentes em paralelo

**Files:**
- Create (via subagentes): os 14 arquivos markdown listados em File Structure.

**IMPORTANTE:** Esta task é **uma única chamada de ferramenta** com 14 invocações `Agent` em paralelo (mesma mensagem, multiple tool calls). Tudo em `general-purpose`.

- [ ] **Step 1: Disparar os 14 agentes em uma única mensagem**

Para cada agente abaixo, customizar o prompt-base da Task 2 substituindo `{SETOR_NAME}`, `{SCOPE_PATHS}` e `{OUTPUT_PATH}`. Subagent type: `general-purpose`. Não usar worktree (todos leem read-only e cada um escreve em path diferente).

| # | SETOR_NAME | SCOPE_PATHS | OUTPUT_PATH |
|---|---|---|---|
| 1 | **Fitness** | `src/app/(app)/fitness`, `src/app/(app)/desafio`, `src/app/(app)/calculadora`, `src/components/fitness`, `src/app/api/workout`, `src/app/admin/treinos`, `supabase/migration_workout_v2.sql` | `docs/wiki/dominio/fitness.md` |
| 2 | **Loja** | `src/app/(app)/loja`, `src/app/api/loja`, `src/app/api/checkout`, `src/lib/shipping`, `src/app/admin/loja`, `src/components/plans` (apenas o que for de loja), `supabase/migration_loja.sql`, `supabase/migration_product_shipping.sql` | `docs/wiki/dominio/loja.md` |
| 3 | **Cupons** | `src/app/(app)/cupons`, `src/components/coupons`, `src/app/api/coupon`, `src/app/admin/cupons` | `docs/wiki/dominio/cupons.md` |
| 4 | **Afiliados** | `src/app/(app)/afiliados`, `src/components/affiliates`, `src/app/api/affiliate`, `src/app/admin/afiliados` | `docs/wiki/dominio/afiliados.md` |
| 5 | **Consultoria** | `src/app/(app)/consultoria`, `src/app/api/consultoria`, `src/app/admin/consultorias`, `supabase/migration_consultations_inapp.sql` | `docs/wiki/dominio/consultoria.md` |
| 6 | **Chat** | `src/app/(app)/chat`, `src/app/admin/chat` | `docs/wiki/dominio/chat.md` |
| 7 | **Kath Estética** | `src/app/(app)/kath-estetica`, `src/components/estetica`, `src/lib/estetica`, `src/app/api/estetica`, `src/app/admin/kath-estetica`, `supabase/migration_kath_estetica.sql` | `docs/wiki/dominio/kath-estetica.md` |
| 8 | **Perfil, Onboarding & Planos** | `src/app/(app)/perfil`, `src/app/onboarding`, `src/app/(app)/planos`, `src/app/(app)/dashboard`, `src/app/api/onboarding`, `src/components/plans`, `supabase/migration_phone.sql` | `docs/wiki/dominio/perfil-onboarding-planos.md` |
| 9 | **Auth & Middleware** | `src/app/(auth)`, `src/middleware.ts`, `src/lib/auth-helpers.ts` | `docs/wiki/plataforma/auth.md` |
| 10 | **Pagamentos (Asaas)** | `src/lib/asaas`, `src/app/api/webhook`, `src/app/api/checkout` (apenas os pontos de integração com Asaas) | `docs/wiki/plataforma/pagamentos-asaas.md` |
| 11 | **Push & PWA** | `src/lib/push`, `src/lib/notifications.ts`, `src/app/api/push`, `public/sw.js`, `public/manifest.json`, `src/app/admin/push`, `src/app/admin/templates`, `supabase/migration_notifications.sql` | `docs/wiki/plataforma/push-pwa.md` |
| 12 | **Admin Core** | `src/app/admin/page.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/dashboard`, `src/app/admin/assinantes`, `src/app/admin/actions.ts`, `src/components/admin` (apenas o que não é coberto por agentes de domínio/plataforma específicos) | `docs/wiki/plataforma/admin-core.md` |
| 13 | **Infra Compartilhada** | `src/lib/supabase`, `src/lib/env.ts`, `src/lib/rate-limit.ts`, `src/lib/api-error.ts`, `src/lib/validations.ts`, `src/lib/utils.ts`, `src/lib/youtube`, `supabase/schema.sql`, `supabase/migrations/`, `supabase/migration_audit_fixes.sql`, `supabase/migration_fixes.sql` | `docs/wiki/plataforma/infra-compartilhada.md` |
| 14 | **Landing Pública** | `src/app/(public)`, `src/components/landing`, `src/app/robots.ts`, `src/app/sitemap.ts` | `docs/wiki/plataforma/landing.md` |

**Description curta de cada Agent (3-5 palavras):** "Documentar setor X — wiki KathApp".

- [ ] **Step 2: Aguardar todos os 14 agentes**

Não passar ao próximo passo até receber retorno dos 14. Se algum falhar (erro, output vazio, fora do template), re-disparar somente o(s) agente(s) que falharam — nunca re-disparar todos.

- [ ] **Step 3: Verificar existência dos 14 arquivos**

```bash
ls "C:/Users/erick/KATH-GUEDES/kathapp/docs/wiki/dominio/" \
   "C:/Users/erick/KATH-GUEDES/kathapp/docs/wiki/plataforma/"
```

Expected: 8 arquivos `.md` em `dominio/` e 6 em `plataforma/`. Total: 14.

---

## Task 4: Verificação contra critérios de aceitação

Verifica os critérios da Seção 9 do spec. Sem testes automatizados (entregável é documentação), a verificação é por inspeção dirigida.

- [ ] **Step 1: Cada doc tem todas as 10 seções**

```bash
cd "C:/Users/erick/KATH-GUEDES/kathapp/docs/wiki"
for f in dominio/*.md plataforma/*.md; do
  echo "=== $f ==="
  grep -c '^## [0-9]\+\.' "$f"
done
```

Expected: cada arquivo retorna **10**.

Se algum retornar < 10: re-disparar o agente correspondente apontando especificamente as seções faltantes.

- [ ] **Step 2: Toda rota em `src/app/` aparece em pelo menos um setor**

Listar rotas conhecidas e usar Grep para verificar:

```bash
# Listar todos os page.tsx
find "C:/Users/erick/KATH-GUEDES/kathapp/src/app" -name "page.tsx" -type f
```

Para cada path, fazer Grep no `docs/wiki/` procurando o caminho do arquivo. Anotar cobertura. Se algum não aparecer: identificar qual setor deveria cobri-lo e re-disparar.

- [ ] **Step 3: Toda migration `supabase/migration_*.sql` é referenciada**

```bash
ls "C:/Users/erick/KATH-GUEDES/kathapp/supabase/migration_"*.sql
```

Para cada migration, Grep em `docs/wiki/` procurando o nome do arquivo. Cobertura esperada: 100%.

- [ ] **Step 4: Sem duplicação de tabelas Supabase entre setores**

Para cada tabela mencionada na Seção 5 dos docs, contar em quantos arquivos aparece como cabeçalho `### Tabela`. Cada tabela deve aparecer em **exatamente um** arquivo (apenas no setor dono). Se alguma aparecer em 2+: ajustar manualmente removendo da duplicata e mantendo apenas referência cruzada.

- [ ] **Step 5: Idioma PT-BR**

Inspeção visual de 2-3 docs aleatórios. Se algum estiver em inglês: re-disparar.

- [ ] **Step 6: Reportar relatório de cobertura ao usuário**

Resumo de 5-10 linhas listando: 14 arquivos OK, gaps encontrados (se houver), correções aplicadas.

---

## Task 5: Escrever `README.md` mestre

**Files:**
- Create: `docs/wiki/README.md`

- [ ] **Step 1: Coletar metadados de cada doc**

Para cada um dos 14 arquivos, extrair:
- Nome do setor (linha 1)
- Status percebido (Seção 1)
- Lista de rotas (Seção 2 — apenas paths)
- Setores cruzados (Seção 10)

```bash
# Exemplo para extrair títulos e status:
for f in docs/wiki/dominio/*.md docs/wiki/plataforma/*.md; do
  head -20 "$f"
  echo "---"
done
```

- [ ] **Step 2: Escrever o README mestre**

Estrutura obrigatória:

```markdown
# Wiki KathApp

Mapa técnico completo do KathApp. Cada setor vira um documento independente com 10 seções padronizadas.

> Gerado em 2026-04-28 como parte da Fase A (Mapa). Próximas fases: B (Auditoria), C (Diagramas), D (Arquitetura).

## Stack

- Frontend: Next.js 15 App Router, React 19, TypeScript, Tailwind v4
- Backend: Server Actions + API Routes (Next.js)
- DB: Supabase (PostgreSQL + RLS)
- Auth: Clerk (integração nativa com Supabase)
- Pagamentos: Asaas
- Push: Web Push API (VAPID)
- Deploy: Vercel · PWA: Service Worker nativo

## Como ler

Cada doc segue exatamente este template: Visão geral · Rotas · Componentes · Server Actions/API · Modelo de dados · Integrações · Validações · Fluxos · Observações · Referências.

## Domínio

| Setor | Arquivo | Status | Resumo |
|---|---|---|---|
| Fitness | [dominio/fitness.md](dominio/fitness.md) | <preencher> | <1 frase> |
| Loja | [dominio/loja.md](dominio/loja.md) | <preencher> | <1 frase> |
| Cupons | [dominio/cupons.md](dominio/cupons.md) | <preencher> | <1 frase> |
| Afiliados | [dominio/afiliados.md](dominio/afiliados.md) | <preencher> | <1 frase> |
| Consultoria | [dominio/consultoria.md](dominio/consultoria.md) | <preencher> | <1 frase> |
| Chat | [dominio/chat.md](dominio/chat.md) | <preencher> | <1 frase> |
| Kath Estética | [dominio/kath-estetica.md](dominio/kath-estetica.md) | <preencher> | <1 frase> |
| Perfil/Onboarding/Planos | [dominio/perfil-onboarding-planos.md](dominio/perfil-onboarding-planos.md) | <preencher> | <1 frase> |

## Plataforma

| Setor | Arquivo | Status | Resumo |
|---|---|---|---|
| Auth & Middleware | [plataforma/auth.md](plataforma/auth.md) | <preencher> | <1 frase> |
| Pagamentos (Asaas) | [plataforma/pagamentos-asaas.md](plataforma/pagamentos-asaas.md) | <preencher> | <1 frase> |
| Push & PWA | [plataforma/push-pwa.md](plataforma/push-pwa.md) | <preencher> | <1 frase> |
| Admin Core | [plataforma/admin-core.md](plataforma/admin-core.md) | <preencher> | <1 frase> |
| Infra Compartilhada | [plataforma/infra-compartilhada.md](plataforma/infra-compartilhada.md) | <preencher> | <1 frase> |
| Landing Pública | [plataforma/landing.md](plataforma/landing.md) | <preencher> | <1 frase> |

## Mapa de dependências entre setores

(Lista textual — diagramas vêm na Fase C.)

- **Fitness** depende de: Auth, Push (notificações de treino), Infra (Supabase)
- **Loja** depende de: Auth, Pagamentos, Cupons (uso de cupom no checkout), Push (status do pedido), Infra
- **Cupons** depende de: Auth, Infra. Consumido por: Loja, Consultoria
- **Afiliados** depende de: Auth, Pagamentos, Infra
- **Consultoria** depende de: Auth, Pagamentos, Cupons, Push, Chat, Infra
- **Chat** depende de: Auth, Infra. Consumido por: Consultoria
- **Kath Estética** depende de: Auth, Pagamentos, Push, Infra
- **Perfil/Onboarding/Planos** depende de: Auth, Pagamentos (assinatura), Infra
- **Admin Core** depende de: Auth (role admin), todos os domínios

(Cada link específico está nas seções "10. Referências" dos docs.)

## Convenções de leitura

- Toda referência `arquivo:linha` é um link clicável no editor.
- Tabelas Supabase aparecem **uma única vez**, no doc do setor dono.
- Status: **production** = em uso pleno · **beta** = funcional, sem polimento · **WIP** = em construção · **stub** = placeholder não funcional.

## Próximas fases

- **Fase B — Auditoria:** gaps, bugs e inconsistências por setor.
- **Fase C — Diagramas:** transformar fluxos da Seção 8 em diagramas visuais.
- **Fase D — Arquitetura:** revisão de camadas, segurança, performance.
```

Substituir `<preencher>` com base nos metadados coletados no Step 1.

- [ ] **Step 3: Verificar links**

```bash
cd "C:/Users/erick/KATH-GUEDES/kathapp/docs/wiki"
# Verificar que cada arquivo linkado existe
grep -oE '\((dominio|plataforma)/[a-z-]+\.md\)' README.md | tr -d '()' | while read p; do
  test -f "$p" && echo "OK $p" || echo "MISSING $p"
done
```

Expected: 14 linhas "OK".

---

## Task 6: Resolução do estado do git e commit final

O repo está em estado inicial sem commits e há um `.git/index.lock` órfão. Resolver explicitamente antes de commit.

**Files:**
- Touch: `.git/index.lock` (remoção)

- [ ] **Step 1: Confirmar nenhum git/editor rodando**

```bash
tasklist 2>/dev/null | grep -i "git\|code\|sublime\|atom\|notepad" || echo "no editors detected"
```

Se houver processo git/editor ativo: parar primeiro. Caso contrário, prosseguir.

- [ ] **Step 2: Remover lock órfão**

```bash
rm -f "C:/Users/erick/KATH-GUEDES/kathapp/.git/index.lock"
```

- [ ] **Step 3: Confirmar com usuário antes de commit gigante**

Como não há commits prévios, perguntar ao usuário:
- (a) Fazer initial commit incluindo TODO o staged + Fase A docs
- (b) Resetar staged, commitar APENAS spec + plan + wiki (separado do bootstrap do projeto)
- (c) Outro fluxo

Aguardar resposta.

- [ ] **Step 4: Commit conforme a escolha do usuário**

Para opção (b) (recomendada — mantém o histórico limpo):

```bash
cd "C:/Users/erick/KATH-GUEDES/kathapp"
git reset
git add docs/superpowers/specs/2026-04-28-fase-a-mapa-wiki-design.md \
        docs/superpowers/plans/2026-04-28-fase-a-mapa-wiki.md \
        docs/wiki/
git commit -m "$(cat <<'EOF'
docs(wiki): Fase A — mapa completo do KathApp em 14 setores

Wiki técnica produzida por 14 agentes em paralelo, um por setor
(8 domínio + 6 plataforma). Cada doc segue template de 10 seções:
visão geral, rotas, componentes, server actions/API, modelo de dados,
integrações, validações, fluxos principais, observações e referências.

Inclui spec e plan da Fase A em docs/superpowers/. Próximas fases
(B: auditoria · C: diagramas · D: arquitetura) terão specs separados.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Verificar commit**

```bash
git -C "C:/Users/erick/KATH-GUEDES/kathapp" log --oneline -3
git -C "C:/Users/erick/KATH-GUEDES/kathapp" status
```

Expected: log mostra o commit; status mostra apenas arquivos não-Fase-A ainda staged/untracked (que o usuário decidirá depois).

---

## Resumo de execução

- **Tasks 1, 4, 5, 6** rodam **sequencialmente** no orquestrador.
- **Task 3** é a única que paraleliza: 14 agentes em uma única mensagem.
- Tempo estimado: 1-3 min para Tasks 1, 4, 5, 6; 5-15 min para Task 3 (depende dos agentes).
- Custo de tokens: alto (14 agentes investigando codebase) — esperado e aceito pelo usuário.
