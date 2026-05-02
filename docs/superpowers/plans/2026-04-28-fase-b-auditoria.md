# Fase B — Auditoria de Gaps/Bugs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produzir `docs/audit/` com 14 documentos de auditoria (um por setor) seguindo o schema de issue completo (ID, severidade, categoria, local, descrição, impacto, correção, esforço, dependências) + `README.md` mestre consolidado com padrões arquiteturais (`ARCH-*`).

**Architecture:** 14 agentes `general-purpose` rodam em paralelo. Cada um lê o doc da Fase A do seu setor (input), re-investiga o código com mindset de auditor, valida as observações da Fase A e descobre issues novas nas 8 categorias. Output é UM markdown por setor. O orquestrador consolida no master após os 14 entregarem, detectando padrões transversais (`ARCH-*`) e produzindo backlog priorizado.

**Tech Stack:** Agent tool (`general-purpose` subagents), Bash, Read/Grep/Glob (read-only no código), Write (apenas docs de auditoria).

**Spec base:** `docs/superpowers/specs/2026-04-28-fase-b-auditoria-design.md`
**Pré-requisito:** Fase A entregue em `docs/wiki/`.

---

## File Structure

| Caminho | Tipo | Responsabilidade |
|---|---|---|
| `docs/audit/README.md` | Output | Backlog mestre + ARCH-* + sumário (escrito pelo orquestrador) |
| `docs/audit/dominio/{fitness,loja,cupons,afiliados,consultoria,chat,kath-estetica,perfil-onboarding-planos}.md` | Output | 8 docs de auditoria de domínio |
| `docs/audit/plataforma/{auth,pagamentos-asaas,push-pwa,admin-core,infra-compartilhada,landing}.md` | Output | 6 docs de auditoria de plataforma |

Nenhum código de produção é modificado.

---

## Task 1: Scaffolding de `docs/audit/`

**Files:**
- Create: `docs/audit/dominio/` (diretório)
- Create: `docs/audit/plataforma/` (diretório)

- [ ] **Step 1: Criar diretórios**

```bash
mkdir -p "C:/Users/erick/KATH-GUEDES/kathapp/docs/audit/dominio"
mkdir -p "C:/Users/erick/KATH-GUEDES/kathapp/docs/audit/plataforma"
```

- [ ] **Step 2: Verificar estrutura**

```bash
ls -la "C:/Users/erick/KATH-GUEDES/kathapp/docs/audit/"
```

Expected: dois subdiretórios (`dominio/` e `plataforma/`).

- [ ] **Step 3: Não commit ainda**

Conforme decisão do usuário, commits agrupados ao final em Task 6 (que pergunta antes de executar).

---

## Task 2: Prompt-base do agente (referência inline — não cria arquivo)

Esta task documenta o template de prompt usado nos 14 dispatches da Task 3. Mantido inline para garantir consistência entre os 14 agentes.

- [ ] **Step 1: Conferir o prompt-base abaixo, sem alteração**

````
Você é um AUDITOR técnico investigando o setor "{SETOR_NAME}" do KathApp como parte de uma equipe paralela de 14 agentes da Fase B (Auditoria). Sua entrega é UM ÚNICO arquivo markdown em PT-BR contendo todas as issues do seu setor.

# Contexto do projeto
KathApp = Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4 + Supabase + Clerk + Asaas + Web Push (VAPID).
Raiz do código: C:\Users\erick\KATH-GUEDES\kathapp
Spec orientadora: docs/superpowers/specs/2026-04-28-fase-b-auditoria-design.md (leia se quiser contexto adicional)

# Inputs obrigatórios
1. Wiki da Fase A do seu setor: {WIKI_PATH} — leia integralmente, especialmente §9 (Observações).
2. Código do setor (paths em "Seu escopo" abaixo).
3. Testes existentes do setor (`*.test.ts(x)`) — busque com Grep para saber o que JÁ está coberto antes de reportar issues `dx` de coverage.

# Seu escopo (investigue APENAS estes paths)
{SCOPE_PATHS}

# Onde gravar
{OUTPUT_PATH}

# Sua abreviação (ID prefix)
Use `{ABBREV}-NNN` para todos os IDs deste setor (ex: `{ABBREV}-001`, `{ABBREV}-002`, ...). Numere localmente, sem coordenação global.

# Restrições operacionais
- READ-ONLY no código de produção. Use Read, Grep, Glob, Bash (apenas `ls`/`git log`). NUNCA edite código.
- Idioma: PT-BR.
- Crie APENAS o arquivo de saída acima. Nada mais.
- Toda afirmação deve referenciar `arquivo:linha`.
- NÃO proponha novas features. Apenas reporte o que está quebrado/incompleto/arriscado/em débito.
- Se uma issue cruza setores e parece arquitetural (3+ setores), marque com sev `Low`/cat `tech-debt` e aponte "candidato a ARCH-* — ver master".

# Categorias permitidas
`bug` · `security` · `data-integrity` · `performance` · `ux` · `a11y` · `dx` · `tech-debt`

# Severidade (use estas definições objetivas)
- **Critical**: exploit de segurança / perda de dados / crash em produção / pagamento quebrado / vazamento de PII / RLS bypass.
- **High**: feature quebrada / RLS gap com dados sensíveis / data integrity em risco / perf impactando todos os usuários.
- **Medium**: UX prejudicada / validação ausente abusável / perf em parte dos usuários / bug com workaround.
- **Low**: cosmético / DX / testes ausentes sem risco / hardcoded sem impacto / tech-debt isolado.

# Esforço (3 níveis)
- **S**: 0-2h, 1 arquivo, mudança pontual.
- **M**: meio-dia a 2 dias, múltiplos arquivos, requer testes.
- **L**: 3+ dias, refactor / migration / coordenação cross-setor.

# Validação das observações da Fase A
Para cada bullet em §9 do doc da wiki do seu setor, classifique:
- `validado` — confirmou ainda válida → vira issue formal.
- `desatualizado` — já foi corrigida ou nunca existiu → registra como issue `Low`/`tech-debt` com `notes: desatualizado` e descreve o que mudou.
- `refinado` — encontrou versão correlata mas com escopo/severidade diferente → vira issue com `notes: refinado`.
- `net-new` (apenas para issues que NÃO estavam na Fase A) — `notes: net-new`.

# Template OBRIGATÓRIO de saída

```markdown
# Auditoria — {SETOR_NAME}

**Setor:** {SETOR_NAME}
**Prefix de ID:** `{ABBREV}`
**Wiki base:** `{WIKI_RELATIVE_PATH}`
**Total de issues:** <N>

## Sumário

| Severidade | Quantidade |
|---|---|
| Critical | X |
| High | Y |
| Medium | Z |
| Low | W |

| Categoria | Quantidade |
|---|---|
| bug | … |
| security | … |
| data-integrity | … |
| performance | … |
| ux | … |
| a11y | … |
| dx | … |
| tech-debt | … |

## Issues

### `{ABBREV}-001` — <Título curto e específico>

- **Severidade:** Critical | High | Medium | Low
- **Categoria:** bug | security | data-integrity | performance | ux | a11y | dx | tech-debt
- **Local:** `arquivo:linha` (vários se relevante)
- **Esforço:** S | M | L
- **Depende de:** `<ID>`, `<ID>` (ou "—")
- **Notes:** validado | desatualizado | refinado | net-new

**Descrição:**
<O que foi encontrado, com referências ao código>

**Impacto:**
<O que pode dar errado ou já está dando — concreto, não vago>

**Correção sugerida:**
<1-3 frases com a abordagem proposta. Cite arquivo/função quando útil.>

---

### `{ABBREV}-002` — ...
(repete...)
```

# Quando terminar
Reporte:
- O caminho do arquivo criado.
- Total de issues por severidade (ex: "3 Critical, 7 High, 12 Medium, 8 Low").
- 1-2 issues mais notáveis (Critical/High) que descobriu além da Fase A.
````

---

## Task 3: Dispatch dos 14 agentes em paralelo

**Files:**
- Create (via subagentes): os 14 arquivos markdown listados em File Structure.

**IMPORTANTE:** Esta task é **uma única chamada** com 14 invocações `Agent` em paralelo (mesma mensagem, multiple tool calls). Subagent type: `general-purpose`. Sem worktree (read-only no código, paths de output disjuntos).

- [ ] **Step 1: Disparar os 14 agentes em uma única mensagem**

Para cada agente abaixo, customizar o prompt-base da Task 2 substituindo `{SETOR_NAME}`, `{ABBREV}`, `{SCOPE_PATHS}`, `{WIKI_PATH}`, `{WIKI_RELATIVE_PATH}` e `{OUTPUT_PATH}`.

| # | SETOR_NAME | ABBREV | WIKI_PATH (input) | WIKI_RELATIVE_PATH (no doc de saída) | SCOPE_PATHS | OUTPUT_PATH |
|---|---|---|---|---|---|---|
| 1 | **Fitness** | `FIT` | `docs/wiki/dominio/fitness.md` | `../../wiki/dominio/fitness.md` | `src/app/(app)/fitness`, `src/app/(app)/desafio`, `src/app/(app)/calculadora`, `src/components/fitness`, `src/app/api/workout`, `src/app/admin/treinos`, `supabase/migration_workout_v2.sql` | `docs/audit/dominio/fitness.md` |
| 2 | **Loja** | `LOJA` | `docs/wiki/dominio/loja.md` | `../../wiki/dominio/loja.md` | `src/app/(app)/loja`, `src/app/api/loja`, `src/app/api/checkout`, `src/lib/shipping`, `src/app/admin/loja`, `src/components/plans` (apenas o que for de loja), `supabase/migration_loja.sql`, `supabase/migration_product_shipping.sql` | `docs/audit/dominio/loja.md` |
| 3 | **Cupons** | `CUP` | `docs/wiki/dominio/cupons.md` | `../../wiki/dominio/cupons.md` | `src/app/(app)/cupons`, `src/components/coupons`, `src/app/api/coupon`, `src/app/admin/cupons` | `docs/audit/dominio/cupons.md` |
| 4 | **Afiliados** | `AFI` | `docs/wiki/dominio/afiliados.md` | `../../wiki/dominio/afiliados.md` | `src/app/(app)/afiliados`, `src/components/affiliates`, `src/app/api/affiliate`, `src/app/admin/afiliados` | `docs/audit/dominio/afiliados.md` |
| 5 | **Consultoria** | `CONS` | `docs/wiki/dominio/consultoria.md` | `../../wiki/dominio/consultoria.md` | `src/app/(app)/consultoria`, `src/app/api/consultoria`, `src/app/admin/consultorias`, `supabase/migration_consultations_inapp.sql` | `docs/audit/dominio/consultoria.md` |
| 6 | **Chat** | `CHAT` | `docs/wiki/dominio/chat.md` | `../../wiki/dominio/chat.md` | `src/app/(app)/chat`, `src/app/admin/chat` | `docs/audit/dominio/chat.md` |
| 7 | **Kath Estética** | `ESTET` | `docs/wiki/dominio/kath-estetica.md` | `../../wiki/dominio/kath-estetica.md` | `src/app/(app)/kath-estetica`, `src/components/estetica`, `src/lib/estetica`, `src/app/api/estetica`, `src/app/admin/kath-estetica`, `supabase/migration_kath_estetica.sql` | `docs/audit/dominio/kath-estetica.md` |
| 8 | **Perfil, Onboarding & Planos** | `PERF` | `docs/wiki/dominio/perfil-onboarding-planos.md` | `../../wiki/dominio/perfil-onboarding-planos.md` | `src/app/(app)/perfil`, `src/app/onboarding`, `src/app/(app)/planos`, `src/app/(app)/dashboard`, `src/app/api/onboarding`, `src/components/plans`, `supabase/migration_phone.sql` | `docs/audit/dominio/perfil-onboarding-planos.md` |
| 9 | **Auth & Middleware** | `AUTH` | `docs/wiki/plataforma/auth.md` | `../../wiki/plataforma/auth.md` | `src/app/(auth)`, `src/middleware.ts`, `src/lib/auth-helpers.ts` | `docs/audit/plataforma/auth.md` |
| 10 | **Pagamentos (Asaas)** | `PAGTO` | `docs/wiki/plataforma/pagamentos-asaas.md` | `../../wiki/plataforma/pagamentos-asaas.md` | `src/lib/asaas`, `src/app/api/webhook`, `src/app/api/checkout` (pontos de integração com Asaas) | `docs/audit/plataforma/pagamentos-asaas.md` |
| 11 | **Push & PWA** | `PUSH` | `docs/wiki/plataforma/push-pwa.md` | `../../wiki/plataforma/push-pwa.md` | `src/lib/push`, `src/lib/notifications.ts`, `src/app/api/push`, `public/sw.js`, `public/manifest.json`, `src/app/admin/push`, `supabase/migration_notifications.sql` | `docs/audit/plataforma/push-pwa.md` |
| 12 | **Admin Core** | `ADM` | `docs/wiki/plataforma/admin-core.md` | `../../wiki/plataforma/admin-core.md` | `src/app/admin/page.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/dashboard`, `src/app/admin/assinantes`, `src/app/admin/actions.ts`, `src/components/admin`, `src/app/api/admin` | `docs/audit/plataforma/admin-core.md` |
| 13 | **Infra Compartilhada** | `INFRA` | `docs/wiki/plataforma/infra-compartilhada.md` | `../../wiki/plataforma/infra-compartilhada.md` | `src/lib/supabase`, `src/lib/env.ts`, `src/lib/rate-limit.ts`, `src/lib/api-error.ts`, `src/lib/validations.ts`, `src/lib/utils.ts`, `src/lib/youtube`, `supabase/schema.sql`, `supabase/migrations/`, `supabase/migration_audit_fixes.sql`, `supabase/migration_fixes.sql` | `docs/audit/plataforma/infra-compartilhada.md` |
| 14 | **Landing Pública** | `LAND` | `docs/wiki/plataforma/landing.md` | `../../wiki/plataforma/landing.md` | `src/app/(public)`, `src/components/landing`, `src/app/robots.ts`, `src/app/sitemap.ts` | `docs/audit/plataforma/landing.md` |

**Description curta de cada Agent:** "Auditar setor X — Fase B".

- [ ] **Step 2: Aguardar todos os 14 agentes**

Não passar ao próximo passo até receber retorno dos 14. Se algum falhar (erro, output vazio, fora do template), re-disparar somente o(s) agente(s) que falharam.

- [ ] **Step 3: Verificar existência dos 14 arquivos**

```bash
ls "C:/Users/erick/KATH-GUEDES/kathapp/docs/audit/dominio/" \
   "C:/Users/erick/KATH-GUEDES/kathapp/docs/audit/plataforma/"
```

Expected: 8 arquivos `.md` em `dominio/` e 6 em `plataforma/`. Total: 14.

---

## Task 4: Verificação contra critérios de aceitação

- [ ] **Step 1: Cada doc tem cabeçalho e seções obrigatórias**

```bash
cd "C:/Users/erick/KATH-GUEDES/kathapp/docs/audit"
for f in dominio/*.md plataforma/*.md; do
  echo "=== $f ==="
  grep -c '^# Auditoria' "$f"            # esperado: 1
  grep -c '^## Sumário' "$f"             # esperado: 1
  grep -c '^## Issues' "$f"              # esperado: 1
  grep -cE '^### `[A-Z]+-[0-9]+`' "$f"   # esperado: >= 1
done
```

Expected: cada arquivo retorna 1, 1, 1 e ≥1. Se algum tiver 0 numa das três primeiras: re-disparar.

- [ ] **Step 2: IDs únicos por setor e formato correto**

```bash
cd "C:/Users/erick/KATH-GUEDES/kathapp/docs/audit"
for f in dominio/*.md plataforma/*.md; do
  setor=$(basename "$f" .md)
  echo "=== $setor ==="
  ids=$(grep -oE '^### `[A-Z]+-[0-9]+`' "$f" | sort)
  total=$(echo "$ids" | wc -l)
  unique=$(echo "$ids" | sort -u | wc -l)
  echo "Total IDs: $total | Únicos: $unique"
  if [ "$total" -ne "$unique" ]; then
    echo "DUPLICATE IDs:"; echo "$ids" | uniq -d
  fi
done
```

Expected: total = unique em todos. Se houver duplicatas: corrigir manualmente ou re-disparar com instrução específica.

- [ ] **Step 3: Cada issue tem todos os 9 campos obrigatórios**

```bash
cd "C:/Users/erick/KATH-GUEDES/kathapp/docs/audit"
required=("Severidade" "Categoria" "Local" "Esforço" "Depende de" "Notes" "Descrição" "Impacto" "Correção sugerida")
for f in dominio/*.md plataforma/*.md; do
  for field in "${required[@]}"; do
    n=$(grep -c "\*\*${field}:\*\*" "$f")
    issues=$(grep -cE '^### `[A-Z]+-[0-9]+`' "$f")
    if [ "$n" -lt "$issues" ]; then
      echo "GAP em $f — campo '$field' aparece $n vezes mas há $issues issues"
    fi
  done
done
```

Expected: nenhuma linha "GAP". Se aparecer: re-disparar agente do setor com instrução pra preencher os campos faltantes.

- [ ] **Step 4: Toda observação da Fase A está classificada**

```bash
cd "C:/Users/erick/KATH-GUEDES/kathapp/docs/audit"
for f in dominio/*.md plataforma/*.md; do
  echo "=== $f ==="
  for tag in validado desatualizado refinado net-new; do
    c=$(grep -c "Notes:.*$tag" "$f")
    echo "  $tag: $c"
  done
done
```

Inspecionar visualmente: cada doc deve ter ao menos um `validado` (a Fase A tinha observações para todos os 14 setores). Se algum tiver 0 das tags `validado/desatualizado/refinado` somadas, o agente ignorou a Fase A.

- [ ] **Step 5: Severidade e Categoria com valores permitidos**

```bash
cd "C:/Users/erick/KATH-GUEDES/kathapp/docs/audit"
allowed_sev='Critical|High|Medium|Low'
allowed_cat='bug|security|data-integrity|performance|ux|a11y|dx|tech-debt'
for f in dominio/*.md plataforma/*.md; do
  bad_sev=$(grep -E '\*\*Severidade:\*\*' "$f" | grep -vE "($allowed_sev)" || true)
  bad_cat=$(grep -E '\*\*Categoria:\*\*' "$f" | grep -vE "($allowed_cat)" || true)
  if [ -n "$bad_sev" ]; then echo "BAD SEVERITY in $f:"; echo "$bad_sev"; fi
  if [ -n "$bad_cat" ]; then echo "BAD CATEGORY in $f:"; echo "$bad_cat"; fi
done
```

Expected: nenhum output. Se houver: corrigir manualmente (ajuste textual no doc).

- [ ] **Step 6: Reportar relatório de cobertura ao usuário**

Resumo de 5-10 linhas: 14 arquivos OK, total de issues, distribuição por severidade, top 3 setores com mais issues, gaps encontrados (se houver) e correções aplicadas.

---

## Task 5: Escrever `README.md` mestre + consolidar `ARCH-*`

**Files:**
- Create: `docs/audit/README.md`

- [ ] **Step 1: Coletar metadados de todos os docs**

Extrair de cada arquivo:
- Total de issues (do cabeçalho ou via grep `^### \``).
- Distribuição por severidade (do sumário do doc).
- Distribuição por categoria.
- Lista de IDs com título e severidade (para a tabela mestre).

```bash
cd "C:/Users/erick/KATH-GUEDES/kathapp/docs/audit"
for f in dominio/*.md plataforma/*.md; do
  echo "--- $f ---"
  awk '/^## Sumário/,/^## Issues/' "$f"
  grep -E '^### `[A-Z]+-[0-9]+`' "$f"
done
```

- [ ] **Step 2: Detectar padrões transversais (`ARCH-*`)**

Critério: um problema aparece em **3+ setores**. Heurísticas para detectar:
- Buscar palavras-chave recorrentes nos títulos das issues:
  - "sem Zod" / "validação" / "sem schema"
  - "RLS" / "policy"
  - "rate-limit" / "rate limit"
  - "type-cast" / "as unknown as any"
  - "hardcoded"
  - "sem testes"
  - "drift" / "migration"

```bash
cd "C:/Users/erick/KATH-GUEDES/kathapp/docs/audit"
echo "=== 'sem Zod' ==="; grep -rl -i "sem zod\|sem schema zod\|sem validation zod" dominio/ plataforma/ | wc -l
echo "=== 'as unknown as any' ==="; grep -rl "as unknown as any" dominio/ plataforma/ | wc -l
echo "=== 'sem testes' ==="; grep -rl -i "sem testes\|coverage\|sem teste" dominio/ plataforma/ | wc -l
echo "=== 'rate-limit' ==="; grep -rl -i "rate-limit\|rate limit" dominio/ plataforma/ | wc -l
echo "=== 'hardcoded' ==="; grep -rl -i "hardcoded\|hard-coded\|hard coded" dominio/ plataforma/ | wc -l
```

Para cada padrão com count ≥ 3 (em arquivos distintos), criar uma issue `ARCH-NNN` no master agregando os setores afetados.

- [ ] **Step 3: Escrever o README mestre**

```markdown
# Auditoria KathApp — Backlog Priorizado

> Gerado em 2026-04-28 como parte da **Fase B — Auditoria de Gaps/Bugs**. Próximas fases: C (Diagramas), D (Arquitetura).

## Sumário executivo

- **Total de issues:** <N>
- **Por severidade:** Critical <X> · High <Y> · Medium <Z> · Low <W>
- **Top 5 áreas com mais issues:**
  1. <Setor> — <N>
  2. ...
- **Top 5 issues `Critical`:**
  - [`<ID>`](dominio/setor.md#<id>) — <Título> (<Setor>)
  - ...

## Padrões arquiteturais (`ARCH-*`)

Issues que aparecem em 3+ setores. Tratamento global recomendado em vez de fix por setor.

### `ARCH-001` — <Título do padrão>

- **Severidade agregada:** High
- **Categoria:** dx | data-integrity | ...
- **Setores afetados:** Fitness, Loja, Cupons, Consultoria, ... (lista)
- **Issues correlatas locais:** `FIT-NNN`, `LOJA-NNN`, ...
- **Esforço:** L (refactor cross-setor)

**Descrição:**
<Padrão observado, com 2-3 exemplos concretos>

**Impacto:**
<Por que é um problema arquitetural, não só local>

**Correção sugerida:**
<Solução cross-cutting — ex: criar wrapper, helper, eslint rule, ...>

---

(repete para cada ARCH detectado na Step 2)

## Backlog (todas as issues)

| ID | Sev | Cat | Setor | Título | Esforço | Link |
|---|---|---|---|---|---|---|
| `FIT-001` | Critical | bug | Fitness | … | M | [→](dominio/fitness.md#fit-001) |
| ... |

Ordenação default: severidade desc (Critical → Low), depois setor, depois ID.

## Por categoria

(seções: bug · security · data-integrity · performance · ux · a11y · dx · tech-debt — cada uma com tabela filtrada)

## Por setor

| Setor | Doc | Total | Crit | High | Med | Low |
|---|---|---|---|---|---|---|
| Fitness | [dominio/fitness.md](dominio/fitness.md) | … | … | … | … | … |
| Loja | [dominio/loja.md](dominio/loja.md) | … | … | … | … | … |
| ... |

## Mapa de dependências

DAG textual: issues que bloqueiam outras.

- `FIT-003` bloqueia `FIT-007`, `FIT-009`
- `INFRA-005` bloqueia `LOJA-002`, `CONS-004`, `ESTET-008`
- ...

## Próximas fases

- **Fase C — Diagramas:** os fluxos da Wiki §8 viram diagramas mermaid.
- **Fase D — Arquitetura:** revisão estrutural usando wiki + auditoria como entrada.
- **Pós-Fase D:** abrir specs/plans específicos pra cada issue ou cluster ARCH.
```

Preencher placeholders `<...>` com os dados coletados na Step 1 e padrões da Step 2.

- [ ] **Step 4: Verificar links do master**

```bash
cd "C:/Users/erick/KATH-GUEDES/kathapp/docs/audit"
grep -oE '\((dominio|plataforma)/[a-z-]+\.md(#[a-z0-9-]+)?\)' README.md | tr -d '()' | while read p; do
  file="${p%%#*}"
  test -f "$file" && echo "OK $p" || echo "MISSING $p"
done
```

Expected: todas linhas começam com "OK".

---

## Task 6: Resolução do estado do git e commit final

O repo está em estado inicial sem commits e há um `.git/index.lock` órfão (decisão do usuário em Fase A: deixar git para depois). Resolver explicitamente antes de commit.

- [ ] **Step 1: Confirmar nenhum git/editor rodando para o lock**

```bash
tasklist 2>/dev/null | grep -iE "^git\.exe" || echo "no git processes"
```

VS Code rodando não impede remoção do lock — só processo `git.exe` ativo importa.

- [ ] **Step 2: Perguntar ao usuário antes de qualquer commit**

Como não há commits prévios, perguntar:
- (a) Initial commit gigante com tudo (bootstrap + Fase A + Fase B)
- (b) Initial commit de bootstrap (já staged) + commits separados Fase A e Fase B
- (c) Só Fase B agora, deixar Fase A e bootstrap para depois
- (d) Não commitar — entregar e parar

Aguardar resposta antes de prosseguir.

- [ ] **Step 3: Executar conforme escolha**

Para opção (b) recomendada — commit dedicado da Fase B:

```bash
cd "C:/Users/erick/KATH-GUEDES/kathapp"
rm -f .git/index.lock
git reset
git add docs/superpowers/specs/2026-04-28-fase-b-auditoria-design.md \
        docs/superpowers/plans/2026-04-28-fase-b-auditoria.md \
        docs/audit/
git commit -m "$(cat <<'EOF'
docs(audit): Fase B — auditoria completa do KathApp em 14 setores

Auditoria técnica produzida por 14 agentes em paralelo, validando as
~85 observações da Fase A e descobrindo issues novas nas 8 categorias
(bug, security, data-integrity, performance, ux, a11y, dx, tech-debt).
Cada issue segue schema completo: ID local por setor, severidade
(Critical/High/Medium/Low), esforço (S/M/L), dependências, correção
sugerida.

Master em docs/audit/README.md consolida backlog priorizado e
padrões arquiteturais transversais (ARCH-*). Próximas fases
(C: diagramas · D: arquitetura) terão specs separados.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Verificar commit**

```bash
git -C "C:/Users/erick/KATH-GUEDES/kathapp" log --oneline -3
git -C "C:/Users/erick/KATH-GUEDES/kathapp" status
```

Expected: log mostra o commit; status mostra apenas arquivos não-Fase-B ainda staged/untracked (que o usuário decidirá depois).

---

## Resumo de execução

- **Tasks 1, 4, 5, 6** rodam **sequencialmente** no orquestrador.
- **Task 3** é a única que paraleliza: 14 agentes em uma única mensagem.
- Tempo estimado: 1-3 min para Tasks 1, 4, 5, 6; 8-25 min para Task 3 (auditoria é mais profunda que Fase A).
- Custo de tokens: alto — auditoria exige leitura cuidadosa do código + dos testes existentes.
