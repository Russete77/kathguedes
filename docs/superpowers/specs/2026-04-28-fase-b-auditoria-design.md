# Fase B — Auditoria de Gaps/Bugs — Design

**Data:** 2026-04-28
**Projeto:** KathApp
**Fase:** B de 4 (A: Mapa ✅ · B: Auditoria · C: Diagramas · D: Arquitetura)
**Pré-requisito:** Fase A entregue em `docs/wiki/`.

---

## 1. Objetivo

Produzir uma **auditoria técnica profunda** do KathApp identificando bugs, gaps de segurança, problemas de integridade de dados, performance, UX, acessibilidade, DX e dívida técnica. Cada issue vem com **correção sugerida**, **severidade**, **esforço** e **dependências** entre issues, formando um backlog priorizado pronto para virar trabalho de fato.

A Fase B usa a wiki da Fase A como ponto de partida (re-validando as ~85 observações já capturadas), mas **investiga muito mais fundo** — race conditions, RLS gaps, coverage de testes, queries N+1, validações ausentes, secrets vazando, drift de migrations, etc.

## 2. Escopo

**Dentro:**
- Todos os 14 setores do KathApp (mesma partição da Fase A).
- 8 categorias: `bug`, `security`, `data-integrity`, `performance`, `ux`, `a11y`, `dx`, `tech-debt`.
- Validação das observações da Fase A: cada uma é confirmada, refinada ou marcada como obsoleta.
- Padrões arquiteturais transversais (issues que cruzam múltiplos setores).

**Fora:**
- Implementar correções → próximas sprints (após Fase D).
- Diagramas de fluxo → **Fase C**.
- Avaliação arquitetural macro (camadas, acoplamento) → **Fase D**.
- Sugestões de **novas features** — auditoria reporta apenas o que está quebrado/incompleto/arriscado.

## 3. Particionamento — Mesmos 14 Setores

Mesmos escopos da Fase A. Cada agente recebe abreviação para IDs:

### Domínio (8)
| Setor | Abrev. (ID prefix) | Output |
|---|---|---|
| Fitness | `FIT` | `docs/audit/dominio/fitness.md` |
| Loja | `LOJA` | `docs/audit/dominio/loja.md` |
| Cupons | `CUP` | `docs/audit/dominio/cupons.md` |
| Afiliados | `AFI` | `docs/audit/dominio/afiliados.md` |
| Consultoria | `CONS` | `docs/audit/dominio/consultoria.md` |
| Chat | `CHAT` | `docs/audit/dominio/chat.md` |
| Kath Estética | `ESTET` | `docs/audit/dominio/kath-estetica.md` |
| Perfil, Onboarding & Planos | `PERF` | `docs/audit/dominio/perfil-onboarding-planos.md` |

### Plataforma (6)
| Setor | Abrev. | Output |
|---|---|---|
| Auth & Middleware | `AUTH` | `docs/audit/plataforma/auth.md` |
| Pagamentos (Asaas) | `PAGTO` | `docs/audit/plataforma/pagamentos-asaas.md` |
| Push & PWA | `PUSH` | `docs/audit/plataforma/push-pwa.md` |
| Admin Core | `ADM` | `docs/audit/plataforma/admin-core.md` |
| Infra Compartilhada | `INFRA` | `docs/audit/plataforma/infra-compartilhada.md` |
| Landing Pública | `LAND` | `docs/audit/plataforma/landing.md` |

**Master:** `docs/audit/README.md` — escrito pelo orquestrador após os 14 agentes terminarem.

## 4. Schema de Cada Issue

Cada issue no doc de setor segue **exatamente** este formato (markdown):

```markdown
### `<ID>` — <Título curto e específico>

- **Severidade:** Critical | High | Medium | Low
- **Categoria:** bug | security | data-integrity | performance | ux | a11y | dx | tech-debt
- **Local:** `arquivo:linha` (vários se relevante)
- **Esforço:** S | M | L
- **Depende de:** `<ID>`, `<ID>` (ou "—")
- **Notes:** validado | desatualizado | refinado | net-new (relação com Fase A)

**Descrição:**
<O que foi encontrado, com referências ao código>

**Impacto:**
<O que pode dar errado ou já está dando — concreto, não vago>

**Correção sugerida:**
<1-3 frases com a abordagem proposta. Cite arquivo/função quando útil.>
```

**Exemplo concreto** (não escrever este exemplo no doc real):

```markdown
### `CHAT-001` — `is_read` nunca é setado para true

- **Severidade:** High
- **Categoria:** bug
- **Local:** `src/app/(app)/chat/page.tsx`, `src/app/admin/chat/admin-chat-inbox.tsx`
- **Esforço:** M
- **Depende de:** —
- **Notes:** validado (Fase A obs §9 #1)

**Descrição:**
A flag `messages.is_read` é gravada como `false` no insert e nenhuma rotina (Server Action, trigger ou useEffect ao abrir thread) marca como `true`. O índice `idx_messages_user_is_read` foi criado para suportar essa query mas não é exercitado.

**Impacto:**
Badge de não-lidas na inbox admin (`admin-chat-inbox.tsx:60-63`) infla indefinidamente. Métricas de engajamento de chat ficam corrompidas.

**Correção sugerida:**
Adicionar Server Action `markAsRead(threadUserId)` que faz `UPDATE messages SET is_read=true WHERE user_id=? AND is_from_kath != <viewer_role>`. Chamar no `useEffect` de cada componente de chat ao montar a thread. Considerar trigger Postgres alternativo.
```

## 5. Categorias de Issues (definições)

| Categoria | O que entra |
|---|---|
| `bug` | Comportamento incorreto detectável no código (lógica errada, erro silenciado, off-by-one) |
| `security` | RLS gap, auth ausente, secret vazando, injection, CSRF, exposição de dados sensíveis |
| `data-integrity` | Race conditions, ausência de constraints/indexes, idempotência, transações faltando |
| `performance` | N+1, queries não-paralelas, índices ausentes, re-renders, bundles inflados |
| `ux` | Fluxo quebrado, sem feedback, validação só no client, mensagens de erro genéricas, estados confusos |
| `a11y` | Semântica HTML, ARIA, contraste, navegação por teclado, foco perdido |
| `dx` | Tipagem fraca, testes ausentes, validação sem Zod, padrões inconsistentes, casts `as unknown as any` |
| `tech-debt` | Dead code, hardcoded values, TODO/FIXME, duplicação, drift de migrations |

## 6. Severidade (4 níveis com critérios objetivos)

| Nível | Critério |
|---|---|
| **Critical** | Exploit de segurança, perda de dados, crash em produção, pagamento quebrado, vazamento de PII, RLS bypass |
| **High** | Feature quebrada, RLS gap com dados sensíveis, data integrity em risco, perf impactando todos os usuários |
| **Medium** | UX prejudicada, validação ausente abusável, perf impactando parte dos usuários, bug com workaround viável |
| **Low** | Cosmético, DX, testes ausentes sem risco imediato, hardcoded sem impacto operacional, tech-debt isolado |

## 7. Esforço (3 níveis)

| Nível | Critério |
|---|---|
| **S** | 0-2h, 1 arquivo, mudança pontual |
| **M** | meio-dia a 2 dias, múltiplos arquivos, requer testes |
| **L** | 3+ dias, refactor / nova infra / migration / coordenação cross-setor |

## 8. Padrões Arquiteturais Transversais

Quando um mesmo problema aparece em **3 ou mais setores** (ex: "ausência de Zod em writes"), **NÃO duplicar** uma issue por setor. Em vez disso:

- Cada agente de setor pode mencionar o problema em **1 issue local de baixa severidade** apontando "ver `ARCH-XXX` no master para tratamento global".
- O orquestrador, ao escrever o master, consolida em **issues `ARCH-XXX`** com severity/effort agregados e lista de setores afetados.
- Isso evita inflar o backlog com 14 cópias de "missing Zod" — vira uma única issue arquitetural com contexto.

## 9. Validação das Observações da Fase A

Cada agente recebe a §9 (Observações) do doc da wiki do seu setor como **input obrigatório**. Para cada observação:

- **`validado`** — confirmada ainda válida → vira issue formal com schema completo.
- **`desatualizado`** — verificou que já foi corrigida ou nunca existiu → registra como issue de severidade `Low`/categoria `tech-debt` com `notes: desatualizado` (pra rastreabilidade), descrevendo o que mudou.
- **`refinado`** — encontrou algo correlato mas com escopo/severidade diferente → vira issue com a versão refinada e `notes: refinado`.
- **`net-new`** — não estava na Fase A, foi descoberto agora → issue normal com `notes: net-new`.

## 10. Estratégia de Execução

- **14 agentes em paralelo** (`general-purpose`), um por setor, em **uma única mensagem do orquestrador**.
- Cada agente:
  1. Lê o doc da wiki do seu setor (`docs/wiki/<area>/<setor>.md`) — input.
  2. Re-investiga o código do setor com mindset de auditor.
  3. Para cada observação da Fase A: classifica como validado/desatualizado/refinado.
  4. Procura issues novas nas 8 categorias.
  5. Lê os testes existentes (`*.test.ts(x)`) — issues `dx` de coverage só fazem sentido sabendo o que JÁ está testado.
  6. Escreve **um único** arquivo markdown no path do setor, com **todas** as issues do setor seguindo o schema da Seção 4.
  7. **Read-only** no código de produção. Nada de Edit/Write fora do doc de auditoria.

- Após os 14 entregarem, o orquestrador:
  - Detecta padrões transversais (issues equivalentes em 3+ setores) → cria seção `Padrões arquiteturais (ARCH-*)` no master.
  - Consolida tudo no `docs/audit/README.md` com tabela mestre ordenável (por severidade default).

## 11. Estrutura do Master `docs/audit/README.md`

Escrito pelo orquestrador depois dos 14 agentes:

```markdown
# Auditoria KathApp — Backlog Priorizado

## Sumário executivo
- Total de issues: <N>
- Por severidade: Critical X · High Y · Medium Z · Low W
- Top 5 áreas com mais issues
- Top 5 issues `Critical` (com link para o doc do setor)

## Padrões arquiteturais (ARCH-*)
Issues transversais (3+ setores).

## Backlog (todas as issues)
Tabela: ID | Sev | Cat | Setor | Título | Esforço | Link

Ordenação default: severity desc, então setor.

## Por categoria
Filtro: bug, security, data-integrity, performance, ux, a11y, dx, tech-debt.

## Por setor
Link para cada doc do setor com contagem.

## Mapa de dependências
Issues que bloqueiam outras (DAG textual).
```

## 12. Critérios de Aceitação

- [ ] 14 docs em `docs/audit/dominio/` e `docs/audit/plataforma/`.
- [ ] Cada doc tem pelo menos cabeçalho `# Auditoria — <Setor>`, contagens (severidade × categoria) e lista de issues seguindo o schema da Seção 4.
- [ ] Toda observação da Fase A está classificada como validado/desatualizado/refinado em pelo menos um doc.
- [ ] IDs únicos por setor (`<ABBREV>-001`, `-002`, ...).
- [ ] Cada issue tem todos os 9 campos do schema (não-aplicáveis = `—`).
- [ ] `docs/audit/README.md` existe com sumário, ARCH-*, backlog mestre e dependências.
- [ ] Nenhum código de produção foi modificado.

## 13. Próximas Fases

- **Fase C — Diagramas:** transforma os fluxos de cada setor (Wiki §8) em diagramas mermaid. Spec separado.
- **Fase D — Arquitetura:** revisão estrutural usando wiki + auditoria como entrada. Spec separado.
- **Pós-Fase D:** trabalho de fato — selecionar issues do backlog, abrir specs/plans específicos pra cada uma.
