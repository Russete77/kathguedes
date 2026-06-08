# Módulo 2 — Banco de Dados & Segurança (PostgreSQL + Supabase RLS)

> Apostila técnica KathApp | Stack: Next.js 15 + TypeScript + Supabase Postgres + Clerk + Asaas + Vercel
> Versão: 2026-05-22

---

## Sumário do Módulo

1. [PostgreSQL Essencial Aplicado ao Projeto](#1-postgresql-essencial-aplicado-ao-projeto)
   - 1.1 Tipos de dado relevantes
   - 1.2 Índices: B-tree, índices parciais e compostos
   - 1.3 Constraints UNIQUE e CHECK
   - 1.4 Generated columns — `net_cents` em `revenue_streams`
   - 1.5 EXCLUDE constraint com GiST — o anti double-booking
2. [RLS (Row Level Security) a Fundo](#2-rls-row-level-security-a-fundo)
   - 2.1 O que é RLS e por que existe
   - 2.2 O padrão de 4 policies do projeto
   - 2.3 `to authenticated` vs `to anon` — e o bug silencioso
   - 2.4 `auth.jwt()->>'sub'` — a identidade do usuário no banco
   - 2.5 `USING` vs `WITH CHECK`
   - 2.6 Policy de gating por plano (`workouts_select_by_plan`)
3. [Triggers BEFORE UPDATE + Segurança por Role](#3-triggers-before-update--segurança-por-role)
   - 3.1 Como um trigger BEFORE UPDATE funciona
   - 3.2 `current_setting('role')` e `auth.jwt()->>'role'`
   - 3.3 O guard anti self-upgrade de plano (C1)
4. [Os Dois Clientes Supabase](#4-os-dois-clientes-supabase)
   - 4.1 `createServerSupabaseClient()` — RLS aplica
   - 4.2 `createAdminSupabaseClient()` — service_role
   - 4.3 Tabela de decisao
   - 4.4 Anti-pattern: admin client "para evitar RLS"
5. [Workflow de Migrations do Projeto](#5-workflow-de-migrations-do-projeto)
   - 5.1 Estrutura do repositório
   - 5.2 A sequência real de migrations
   - 5.3 Idempotência obrigatória
   - 5.4 Aplicação manual no painel Supabase
6. [RPCs Atomicas e Security Definer](#6-rpcs-atomicas-e-security-definer)
   - 6.1 Por que counters não podem ser SELECT-then-UPDATE
   - 6.2 `spend_wallet_cents` — FIFO com FOR UPDATE
   - 6.3 `credit_wallet_cents` — ON CONFLICT DO UPDATE
   - 6.4 `decrement_stock_batch` — atomicidade em lote
7. [Exercícios](#7-exercícios)

---

## 1. PostgreSQL Essencial Aplicado ao Projeto

### 1.1 Tipos de Dado Relevantes

O KathApp usa um subconjunto pequeno mas cuidadosamente escolhido de tipos:

| Tipo | Uso no projeto | Por que |
|------|---------------|---------|
| `uuid` | PKs de tabelas de negócio | Geração client-side, sem colisão, URL-safe |
| `text` | IDs do Clerk, placa, enums | `text` é tão eficiente quanto `varchar(n)` no Postgres |
| `int` | Valores monetários em centavos | Evita ponto flutuante; R$ 39,90 = `3990` |
| `numeric(10,2)` | `asaas_value` em `plans` | Representação exata para a API do Asaas |
| `numeric(5,2)` | Percentuais (`cashback_pct`) | Precisão de 2 casas sem IEEE 754 |
| `timestamptz` | Todas as colunas de tempo | Armazena em UTC, exibe no fuso do cliente |
| `jsonb` | `features` (plans), `items` (orders) | Indexável, schema-flexível para features futuras |
| `text[]` | `interests` em `profiles` | Array nativo, sem tabela pivot para lista simples |
| `tstzrange` | Range temporal de agendamentos | Tipo nativo para comparar intervalos com operadores |
| `boolean` | Flags de publicação, ativação | Sem magic strings; `NOT NULL DEFAULT false` |

**Dinheiro sempre em centavos.** Nunca armazene R$ 39,90 como `39.9` em `float`. Use `int` (3990 centavos). A conversao para exibição acontece na camada de UI com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.

### 1.2 Índices: B-tree, Parciais e Compostos

**Conceito.** O Postgres cria automaticamente um índice B-tree em cada coluna `PRIMARY KEY` e `UNIQUE`. Para os demais casos, você declara explicitamente com `CREATE INDEX`.

**Índice parcial** indexa apenas as linhas que satisfazem uma condição `WHERE`. Ocupa menos espaço e é usado automaticamente pelo planner quando a query tem a mesma condição.

**No KathApp**, o padrão é declarar índices parciais em colunas de status e flags booleanas:

```sql
-- supabase/schema.sql — índices de profiles
CREATE INDEX IF NOT EXISTS idx_profiles_plan_tier
  ON public.profiles(plan_tier);

-- Parcial: só perfis que ainda NÃO completaram onboarding
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding
  ON public.profiles(onboarding_completed)
  WHERE onboarding_completed = false;

-- supabase/schema.sql — índice de publicação de treinos
CREATE INDEX IF NOT EXISTS idx_workout_videos_published
  ON public.workout_videos(is_published, published_at DESC);
```

`idx_profiles_onboarding` só contém as linhas onde `onboarding_completed = false`. Quando a query de boas-vindas filtra exatamente essa condição, o Postgres usa esse índice em vez de varrer a tabela inteira. Depois que o usuário completa o onboarding, a linha some do índice — sem custo de manutenção.

**Índice em expressão:** o índice em `commission_allocations` usa `coalesce()` diretamente:

```sql
-- supabase/migration_modelo_financeiro.sql:145
CREATE UNIQUE INDEX IF NOT EXISTS uniq_commission_rule_dedup
  ON public.commission_rules(
    team_member_id,
    coalesce(applies_to_type, ''),
    coalesce(applies_to_category, ''),
    is_active
  );
```

Isso garante unicidade mesmo quando `applies_to_type` é `NULL` (regra genérica). Sem o `coalesce`, dois `NULL` seriam considerados diferentes pelo Postgres (NULL != NULL), e a constraint não funcionaria.

### 1.3 Constraints UNIQUE e CHECK

**CHECK** valida o valor de uma coluna no momento do INSERT ou UPDATE. Se a condição retornar `false`, o Postgres lança um erro antes de persistir.

```sql
-- supabase/schema.sql:56 — enum de planos via CHECK
plan_tier text NOT NULL DEFAULT 'free'
  CHECK (plan_tier IN ('free','acesso','plano1','plano2','plano3','atleta')),

-- supabase/schema.sql:100 — cashback nunca negativo e nunca > 100%
cashback_pct numeric(5,2) NOT NULL DEFAULT 0
  CHECK (cashback_pct BETWEEN 0 AND 100),

-- supabase/schema.sql:191 — custo nunca pode superar receita bruta
cost_cents int NOT NULL DEFAULT 0
  CHECK (cost_cents >= 0 AND cost_cents <= gross_cents),

-- supabase/migrations/19_estetica_walkin.sql:103 — formato de placa
CHECK (plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$')
```

**UNIQUE** garante que não existam duas linhas com o mesmo valor. O Postgres implementa UNIQUE como um índice B-tree implícito — a constraint e o índice são a mesma estrutura:

```sql
-- supabase/schema.sql:57 — um CPF/CNPJ no Asaas = um cliente
asaas_customer_id text UNIQUE,

-- supabase/migrations/19_estetica_walkin.sql:92 — placa identifica o veículo
plate text NOT NULL UNIQUE,
```

> **Armadilha — CHECK com enum em texto.** A constraint `CHECK (plan_tier IN (...))` é a única barreira de domínio no banco. Se você adicionar um novo tier de plano (ex.: `'premium'`), precisa fazer `ALTER TABLE profiles DROP CONSTRAINT ... ADD CONSTRAINT ...` em todas as tabelas que usam esse enum. Veja `supabase/migration_modelo_financeiro.sql:301–311` onde isso foi feito para sincronizar `workout_videos`, `affiliate_links` e `coupons`.

### 1.4 Generated Columns — `net_cents` em `revenue_streams`

**Conceito.** Uma coluna `GENERATED ALWAYS AS (expr) STORED` é computada pelo Postgres no momento do INSERT/UPDATE e armazenada fisicamente no disco. Você nunca escreve nela; o banco a mantém automaticamente. É diferente de uma view: a coluna existe de verdade, pode ser indexada e aparece no `SELECT *`.

**No KathApp**, `net_cents` em `revenue_streams` elimina o risco de inconsistência entre receita bruta e custo:

```sql
-- supabase/migration_modelo_financeiro.sql:193
gross_cents         int NOT NULL CHECK (gross_cents >= 0),
cost_cents          int NOT NULL DEFAULT 0
                    CHECK (cost_cents >= 0 AND cost_cents <= gross_cents),
net_cents           int GENERATED ALWAYS AS (gross_cents - cost_cents) STORED,
```

**Por que isso importa.** Sem a coluna gerada, o código precisaria calcular `net_cents = gross_cents - cost_cents` em toda query que o usa — inclusive dentro de `compute_commissions`, que distribui as comissões sobre o lucro líquido. Com a coluna gerada, basta referenciar `v_stream.net_cents` diretamente:

```sql
-- supabase/migration_modelo_financeiro.sql:579
v_amount := round(v_stream.net_cents * v_rule.pct / 100.0)::int;
```

Tente fazer `UPDATE revenue_streams SET net_cents = 5000` e o Postgres vai rejeitar com `ERROR: column "net_cents" can only be updated to DEFAULT`.

> **Armadilha — coluna gerada e índice.** Você pode criar índice em coluna gerada normalmente: `CREATE INDEX ON revenue_streams(net_cents)`. Mas não pode usá-la em outra coluna gerada (não há colunas geradas que referenciam outras colunas geradas no Postgres 15).

### 1.5 EXCLUDE Constraint com GiST — o Anti Double-Booking

**Conceito.** A constraint `EXCLUDE USING gist (expr WITH op)` é uma generalização de UNIQUE. Em vez de verificar igualdade (`=`), ela verifica um operador arbitrário — como `&&` (sobreposição de ranges). Se duas linhas satisfazem `expr_a && expr_b`, a constraint rejeita o INSERT.

Para comparar intervalos de tempo, o Postgres usa o tipo `tstzrange` (range de `timestamptz`) e o operador `&&` ("se sobrepoe").

**O problema.** A Kath Estética tem capacidade 1: só um serviço pode ocorrer ao mesmo tempo. A função `get_available_slots` checava disponibilidade via SELECT — mas dois requests concorrentes podiam passar na verificação ao mesmo tempo e criar dois agendamentos sobrepostos. Um trigger ou check de aplicação não resolve race condition; só uma constraint de banco resolve.

**A solução no KathApp** (`supabase/migrations/27_estetica_no_overlap.sql`):

```sql
-- migrations/27_estetica_no_overlap.sql:26-34
ALTER TABLE public.estetica_bookings
  DROP CONSTRAINT IF EXISTS no_overlapping_bookings;

ALTER TABLE public.estetica_bookings
  ADD CONSTRAINT no_overlapping_bookings
  EXCLUDE USING gist (
    tstzrange(scheduled_at, scheduled_at + make_interval(mins => duration_min)) WITH &&
  )
  WHERE (status IN ('pending', 'confirmed', 'in_progress'));
```

**Como funciona passo a passo:**

1. A expressão `tstzrange(scheduled_at, scheduled_at + make_interval(mins => duration_min))` converte cada booking em um intervalo de tempo: `[inicio, fim)`.
2. `WITH &&` especifica o operador de exclusão: "nao pode existir outra linha cujo intervalo se sobreponha ao desta".
3. `WHERE (status IN ('pending', 'confirmed', 'in_progress'))` limita a constraint apenas a agendamentos ativos — `canceled` e `done` não participam da verificação, e voce pode ter infinitos agendamentos cancelados no mesmo horário.
4. O índice GiST é criado automaticamente para suportar a constraint.

**O que acontece no INSERT:**
- Se o INSERT cria um booking que sobrepoem qualquer ativo existente, o Postgres lança `ERROR 23P01: exclusion constraint violation on table "estetica_bookings" constraint "no_overlapping_bookings"`.
- O código na Server Action captura esse código de erro e retorna a mensagem amigável ao usuário.

> **Armadilha — PRE-CHECK obrigatório.** A migration `27` deixa explícito: antes de `ADD CONSTRAINT`, você precisa verificar se ja existem overlaps ativos. Se existirem, o `ADD CONSTRAINT` falha. Veja a query de pre-check na migration (linhas 13–20) e execute antes de aplicar em produção.

> **Armadilha — extensao btree_gist.** Para usar `EXCLUDE USING gist` com tipos escalares (ex: adicionar um campo `studio_id int` no futuro), voce precisaria da extensão `btree_gist`. Para `tstzrange` puro, funciona com GiST nativo do Postgres.

---

## 2. RLS (Row Level Security) a Fundo

### 2.1 O que é RLS e por que existe

O Supabase expõe o banco de dados diretamente via API REST (PostgREST). Isso significa que qualquer cliente — incluindo o browser — pode fazer requisições SQL diretamente ao banco, desde que tenha a `anon key`. Sem RLS, qualquer usuário autenticado poderia ler ou modificar dados de outros usuários com uma query simples.

**Row Level Security** é um mecanismo nativo do PostgreSQL que aplica um filtro automático em toda query que toca uma tabela protegida. Pense como um `WHERE` invisível que o banco injeta em toda operação (SELECT, INSERT, UPDATE, DELETE), antes que qualquer dado seja lido ou escrito.

Para ativar:

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

**Após ativar, a tabela vira uma caixa fechada.** Por padrão (sem policies), nenhuma linha é acessível — nem o owner da tabela (salvo superusuário). Voce precisa criar policies que explicitamente concedem acesso.

### 2.2 O Padrão de 4 Policies do Projeto

Toda tabela de dados de usuário no KathApp segue este padrão:

```sql
-- 1. SELECT: usuario ve apenas o proprio dado
CREATE POLICY {tabela}_select_own ON public.{tabela}
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'sub') = user_id);

-- 2. INSERT: usuario insere apenas como ele mesmo
CREATE POLICY {tabela}_insert_own ON public.{tabela}
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->>'sub') = user_id);

-- 3. UPDATE: usuario edita apenas o proprio dado
CREATE POLICY {tabela}_update_own ON public.{tabela}
  FOR UPDATE TO authenticated
  USING  ((SELECT auth.jwt()->>'sub') = user_id)
  WITH CHECK ((SELECT auth.jwt()->>'sub') = user_id);

-- 4. Admin: service_role tem acesso total
CREATE POLICY {tabela}_admin ON public.{tabela}
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

Exemplo real em `consultations` (`supabase/schema.sql:229–244`):

```sql
CREATE POLICY consultations_select_own ON public.consultations
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'sub') = user_id);

CREATE POLICY consultations_insert_own ON public.consultations
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->>'sub') = user_id);

CREATE POLICY consultations_update_own ON public.consultations
  FOR UPDATE TO authenticated
  USING  ((SELECT auth.jwt()->>'sub') = user_id)
  WITH CHECK ((SELECT auth.jwt()->>'sub') = user_id);

CREATE POLICY consultations_admin ON public.consultations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### 2.3 `to authenticated` vs `to anon` — e o Bug Silencioso

**Conceito.** Toda conexao com o banco chega sob um role do PostgreSQL:

- `anon`: conexoes sem token de autenticacao (chave publica anon key, sem JWT)
- `authenticated`: conexoes com um JWT valido
- `service_role`: conexoes com a service key (bypass de RLS por default)

`TO authenticated` em uma policy significa que ela so se aplica quando o role atual é `authenticated`. Se o request chegar como `anon`, a policy nao existe para aquela conexao — e como RLS está ativa, o resultado é `0 linhas` (sem erro!).

**Por que retorna 0 linhas e nao um erro de permissao?**

O RLS não lança exceção por padrão. Ele simplesmente filtra as linhas que o usuário pode ver. Se nenhuma policy `USING` retorna `true` para a linha atual, ela é invisível — como se não existisse. Um cliente sem JWT fazendo `SELECT * FROM profiles` vai receber uma lista vazia, não um HTTP 403.

**Esse é um dos bugs mais difíceis de diagnosticar.** O desenvolvedor vê `[]` na resposta e pensa que a tabela está vazia ou que a query está errada, quando na verdade é o token que não está sendo enviado.

**No KathApp**, isso acontece se:
- O `createServerSupabaseClient()` é chamado antes do `auth()` estar disponível (ex: em um `layout.tsx` sem `export const dynamic = 'force-dynamic'`)
- O token Clerk expirou e o `getToken()` retornou `null`
- A variável `NEXT_PUBLIC_SUPABASE_ANON_KEY` está errada

> **Armadilha.** Nunca use `TO anon` em policies de dados sensíveis. O role `anon` é para conteúdo público sem autenticacao (ex: landing page). No KathApp, não há policies `TO anon` em nenhuma tabela de dados de usuario — a politica é: sem JWT, sem dados.

### 2.4 `auth.jwt()->>'sub'` — a Identidade do Usuario no Banco

**Conceito.** O Supabase expõe o JWT da requisição atual via a função `auth.jwt()`, que retorna o payload como `jsonb`. O claim `sub` (subject) é o identificador único do usuário — no caso do Clerk, o `user_id` no formato `user_2xyz...`.

```sql
-- Lê o JWT da sessão atual e extrai o campo 'sub'
SELECT auth.jwt()->>'sub';
-- Retorna: 'user_2abc123def456' (ou NULL se não autenticado)
```

**Por que o projeto usa `(SELECT auth.jwt()->>'sub')` e não `auth.jwt()->>'sub'` diretamente?**

O `SELECT` extra força o Postgres a executar a expressão uma única vez e reutilizar o resultado para todas as linhas da query. Sem ele, `auth.jwt()` seria chamada a cada linha avaliada — um custo desnecessário em tabelas grandes. É uma micro-otimização recomendada pela documentação do Supabase.

**Como o Supabase valida o JWT do Clerk?**

A integração é via JWKS (JSON Web Key Set). O Supabase é configurado com a URL do JWKS do Clerk (`https://<seu-clerk>.clerk.accounts.dev/.well-known/jwks.json`). Quando um request chega com um `Bearer token`, o Supabase:
1. Decodifica o header do JWT para encontrar o `kid` (key ID)
2. Busca a chave pública correspondente no JWKS
3. Verifica a assinatura do JWT
4. Se válido, disponibiliza o payload via `auth.jwt()`

Isso significa que **o Supabase nunca armazena senhas** — ele confia no Clerk como provedor de identidade.

### 2.5 `USING` vs `WITH CHECK`

A diferença é sutil mas crítica:

| Clausula | Aplicada em | O que faz |
|----------|-------------|-----------|
| `USING` | SELECT, UPDATE, DELETE | Filtra quais linhas o usuario pode VER/AFETAR |
| `WITH CHECK` | INSERT, UPDATE | Valida as linhas que o usuario quer ESCREVER |

Para `UPDATE`, você precisa de ambas:
- `USING` determina quais linhas o usuario pode selecionar para atualizar
- `WITH CHECK` valida que o dado resultante ainda respeita a regra

Sem `WITH CHECK` em um UPDATE, um usuario poderia: selecionar a propria linha (USING passa), e alterar o `user_id` para outro usuario (nada impede).

Exemplo real em `profiles` (`supabase/schema.sql:77–80`):

```sql
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING  ((SELECT auth.jwt()->>'sub') = id)      -- pode atualizar APENAS o proprio perfil
  WITH CHECK ((SELECT auth.jwt()->>'sub') = id); -- o id resultante ainda deve ser o proprio
```

### 2.6 Policy de Gating por Plano (`workouts_select_by_plan`)

Esta policy é a mais sofisticada do projeto. Ela implementa controle de acesso baseado no nível do plano do usuário:

```sql
-- supabase/schema.sql:187-194
CREATE POLICY workouts_select_by_plan ON public.workout_videos
  FOR SELECT TO authenticated
  USING (
    is_published = true
    AND public.plan_tier_level(
      (SELECT plan_tier FROM public.profiles WHERE id = (SELECT auth.jwt()->>'sub'))
    ) >= public.plan_tier_level(required_plan)
  );
```

**Como funciona:**

1. `(SELECT auth.jwt()->>'sub')` pega o user_id do JWT
2. `(SELECT plan_tier FROM public.profiles WHERE id = ...)` busca o plano atual do usuario
3. `public.plan_tier_level(tier)` converte o slug do plano para um nível numérico (0=free, 1=acesso, 2=plano1, etc.) via lookup na tabela `plans`
4. A comparação `>= plan_tier_level(required_plan)` garante que planos superiores têm acesso ao conteúdo de planos inferiores

**Fluxo de dados:** usuario com `plano2` (nivel 3) pode ver treinos com `required_plan = 'plano1'` (nivel 2), mas nao pode ver treinos com `required_plan = 'atleta'` (nivel 5).

A mesma logica se aplica a `affiliate_links` e `coupons` (`supabase/schema.sql:301–309` e `344–350`).

> **Armadilha — subquery em RLS pode ser lenta.** Toda vez que a policy é avaliada, ela faz um SELECT em `profiles` e outro em `plans`. Em uma query que retorna 100 treinos, isso são 100 pares de subqueries. O Postgres otimiza isso com o `(SELECT ...)` subquery (executado uma vez), mas o `plan_tier_level()` ainda faz um lookup em `plans` por chamada. Monitore o `EXPLAIN ANALYZE` de queries de listagem de treinos se o banco crescer.

---

## 3. Triggers BEFORE UPDATE + Segurança por Role

### 3.1 Como um Trigger BEFORE UPDATE Funciona

Um trigger `BEFORE UPDATE` é executado pelo Postgres antes que a linha seja efetivamente alterada. A funcao do trigger recebe duas variáveis especiais:
- `OLD`: a linha como estava antes da modificacao
- `NEW`: a linha como ficaria após a modificacao

A funcao pode:
- Retornar `NEW` (sem alteracao): deixa o UPDATE prosseguir normalmente
- Retornar um `NEW` modificado: o UPDATE acontece com os valores alterados pela funcao
- Lançar uma excecao (`RAISE EXCEPTION`): o UPDATE é abortado e a transacao é revertida

```sql
CREATE OR REPLACE FUNCTION minha_funcao()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.campo_sensivel IS DISTINCT FROM OLD.campo_sensivel THEN
    RAISE EXCEPTION 'nao pode alterar campo_sensivel'
      USING errcode = '42501'; -- insufficient_privilege
  END IF;
  RETURN NEW; -- prossegue
END;
$$;

CREATE TRIGGER meu_trigger
  BEFORE UPDATE ON public.minha_tabela
  FOR EACH ROW EXECUTE FUNCTION minha_funcao();
```

`IS DISTINCT FROM` é diferente de `!=` porque trata `NULL` corretamente: `NULL IS DISTINCT FROM NULL` retorna `false` (sao iguais), enquanto `NULL != NULL` retorna `NULL` (que é falsy).

### 3.2 `current_setting('role')` e `auth.jwt()->>'role'`

No Supabase com PostgREST, quando uma request chega com a service key, o PostgREST executa internamente `SET LOCAL role = 'service_role'`. Isso altera o role do Postgres apenas para aquela transacao.

O trigger pode detectar isso:

```sql
-- current_setting('role', true) retorna o role atual da transacao
-- O segundo argumento 'true' significa "nao lancar erro se nao definido"
current_setting('role', true) IN ('service_role', 'postgres')
```

Adicionalmente, o JWT pode conter o claim `role` com valor `'service_role'` quando a service key é usada:

```sql
coalesce(auth.jwt() ->> 'role', '') = 'service_role'
```

O trigger checa ambos para garantir que nenhum path de autenticacao fique descoberto.

### 3.3 O Guard Anti Self-Upgrade de Plano (C1)

**O problema.** A policy `profiles_update_own` permite que o usuario autenticado atualize o proprio perfil. Mas ela nao restringe quais colunas podem ser alteradas. Um usuario poderia fazer:

```sql
UPDATE profiles SET plan_tier = 'atleta', subscription_status = 'active'
WHERE id = 'user_meu_id';
```

E teria acesso ao plano premium de R$ 309,90 de graca. Todos os gates de conteúdo leem `plan_tier` — compromisso total do modelo de negócio.

**A solucao** (`supabase/migrations/25_profiles_guard_sensitive_columns.sql`):

```sql
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (webhook/admin/cron) passa livre
  IF current_setting('role', true) IN ('service_role', 'postgres')
     OR coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Bloqueia mudancas em colunas de assinatura/billing
  IF new.plan_tier             IS DISTINCT FROM old.plan_tier
     OR new.subscription_status   IS DISTINCT FROM old.subscription_status
     OR new.subscription_ends_at  IS DISTINCT FROM old.subscription_ends_at
     OR new.asaas_customer_id     IS DISTINCT FROM old.asaas_customer_id
     OR new.asaas_subscription_id IS DISTINCT FROM old.asaas_subscription_id THEN
    RAISE EXCEPTION 'profiles: subscription/billing columns are not user-editable'
      USING errcode = '42501'; -- insufficient_privilege
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_sensitive_columns();
```

**Por que `SECURITY DEFINER`?** A funcao precisa ler as variaveis de sessao (`current_setting`, `auth.jwt()`) com privilégio suficiente. `SECURITY DEFINER` faz a funcao executar com os privilégios de quem a criou (normalmente o superusuário do banco), nao com os privilégios do usuario que disparou o trigger.

**O webhook Asaas pode atualizar o plano?** Sim. O webhook usa `createAdminSupabaseClient()` que conecta com a service key. O PostgREST faz `SET LOCAL role = 'service_role'`, e `current_setting('role', true)` retorna `'service_role'` — o trigger passa direto no primeiro `IF` e retorna `NEW`.

**A migration 28** (`28_drop_redundant_c1_trigger.sql`) documenta uma situacao real de producao: o guard foi escrito duas vezes (uma implementacao redundante chegou a ser aplicada). A solucao foi re-afirmar a versao canonica (#25) e dropar a redundante, garantindo que o banco nunca ficasse desprotegido durante a transicao.

> **Armadilha — trigger nao substitui RLS.** O trigger so dispara em UPDATEs. Se o usuario conseguir fazer um INSERT direto com `plan_tier = 'atleta'`, o trigger nao seria chamado. Por isso a policy `profiles_insert_own` tambem existe — e o signup via Clerk cria o perfil via webhook (service_role), nao via INSERT direto do cliente.

---

## 4. Os Dois Clientes Supabase

### 4.1 `createServerSupabaseClient()` — RLS Aplica

```typescript
// src/lib/supabase/server.ts:11-21
export async function createServerSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      async accessToken() {
        return (await auth()).getToken();
      },
    }
  );
}
```

**O que acontece internamente:**
1. O cliente é criado com a `ANON_KEY` (chave publica, sem privilégios especiais)
2. A cada request ao Supabase, o SDK chama `accessToken()` para obter o JWT
3. O JWT é enviado no header `Authorization: Bearer <token>`
4. O PostgREST valida o JWT via JWKS do Clerk e seta o role como `authenticated`
5. O Supabase extrai `sub` do JWT e disponibiliza via `auth.jwt()`
6. As policies RLS são avaliadas normalmente

**Consequencia:** este cliente respeita todas as policies. O usuario so vê o que as policies permitem.

### 4.2 `createAdminSupabaseClient()` — service_role

```typescript
// src/lib/supabase/server.ts:29-36
export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("[supabase] Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  }
  return createClient<Database>(url, key);
}
```

**O que acontece internamente:**
1. O cliente é criado com a `SERVICE_ROLE_KEY` (chave privada, nunca exposta ao browser)
2. O PostgREST reconhece a service key e seta o role como `service_role`
3. `service_role` tem permissao implicita de bypass de RLS no Supabase
4. Todas as policies são ignoradas — o cliente vê e escreve tudo

**Nota:** a funcao é sincrona (`function`, nao `async function`) porque nao precisa esperar um token JWT — a service key é estatica e ja está na variavel de ambiente.

### 4.3 Tabela de Decisao

| Caso de uso | Cliente correto | Por que |
|------------|-----------------|---------|
| Server Component lendo dados do usuario logado | `createServerSupabaseClient()` | RLS garante isolamento |
| Server Action do usuario (ex: enviar mensagem) | `createServerSupabaseClient()` | Usuario so acessa o proprio dado |
| Webhook Asaas recebendo pagamento confirmado | `createAdminSupabaseClient()` | Precisa escrever em `profiles.plan_tier` (bloqueado por RLS) |
| Server Action de admin apos `requireAdmin()` | `createAdminSupabaseClient()` | Admin opera sobre dados de qualquer usuario |
| Cron de expiracao de creditos de wallet | `createAdminSupabaseClient()` | Processo de sistema, nao usuario |
| API publica sem autenticacao | Nenhum (retornar erro 401 antes) | Nunca expor dados sem auth |

### 4.4 Anti-Pattern: Admin Client "Para Evitar RLS"

**O cenario.** Um desenvolvedor tenta listar treinos no painel admin e recebe `[]`. Ele verifica e vê que a policy `workouts_select_by_plan` exige que o usuario tenha plano suficiente. O admin nao tem plano (é um perfil especial). Solucao rapida: usar `createAdminSupabaseClient()`.

**Por que isso é errado.**

Primeiro, mascara o problema real: a policy deveria ter uma clausula para admins. A correcao correta é adicionar um check de admin na policy ou criar uma policy separada `FOR ALL TO service_role`.

Segundo, create surface de ataque: qualquer rota que use admin client incorretamente pode vazar dados de todos os usuarios se houver um bug de filtro. Com RLS, o pior caso de um bug de filtro é o usuario ver os proprios dados duas vezes.

Terceiro, viola o principio do menor privilegio: a funcao esta pedindo acesso total quando so precisa de acesso elevado para aquela operacao especifica.

**O padrão correto para admin:**

```typescript
// Em uma Server Action de admin — CORRETO
import { requireAdmin } from '@/lib/auth-helpers';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

export async function listAllWorkoutsAction() {
  await requireAdmin(); // lanca erro se nao for admin
  const supabase = createAdminSupabaseClient(); // agora sim, com justificativa
  return supabase.from('workout_videos').select('*');
}
```

```typescript
// Em uma rota normal — INCORRETO (anti-pattern proibido)
export async function getUserWorkoutsAction() {
  const supabase = createAdminSupabaseClient(); // ERRADO — bypassa RLS sem necessidade
  const { userId } = await auth();
  return supabase.from('workout_videos')
    .select('*')
    .eq('user_id', userId); // filtro manual fragil — esquecer = vazar tudo
}
```

> **Armadilha — filtro manual fragil.** Quando voce bypassa RLS e filtra manualmente (`.eq('user_id', userId)`), um bug de logica (ex: esquecer o filtro em uma nova query) vaza dados de todos os usuarios. Com RLS, esquecer o filtro ainda retorna apenas os dados do usuario logado — o banco garante o isolamento.

---

## 5. Workflow de Migrations do Projeto

### 5.1 Estrutura do Repositório

O projeto tem dois tipos de arquivo SQL, com papeis diferentes:

```
supabase/
├── schema.sql                    # Snapshot consolidado — bootstrap de ambiente novo
├── migration_*.sql               # Migrations achatadas (legado — nao numerar mais)
└── migrations/
    ├── 19_estetica_walkin.sql
    ├── 20_estetica_pricing_matrix.sql
    ├── 21_estetica_bookings_prepay.sql
    ├── 22_estetica_requires_booking.sql
    ├── 23_wellness_reminders.sql
    ├── 24_estetica_bookings_admin_created.sql
    ├── 25_profiles_guard_sensitive_columns.sql
    ├── 26_revenue_idempotency.sql
    ├── 27_estetica_no_overlap.sql
    └── 28_drop_redundant_c1_trigger.sql
```

**`schema.sql`** é um snapshot do estado completo do banco em um ponto no tempo (2026-05-11). Serve para criar um ambiente do zero (dev, staging). Ele **nao é atualizado a cada feature** — ficou dessincronizado a partir da migration 19. Para ambientes novos, aplique `schema.sql` primeiro, depois as migrations `19` em diante.

**`migration_*.sql`** (sem numero) sao o padrao legado. Foram aplicadas em producao antes do sistema de numeracao existir. Nao crie mais arquivos nesse padrao.

**`migrations/NN_*.sql`** (com numero) sao o padrao canônico atual. Cada arquivo é uma unidade atomica e idempotente. O numero de dois digitos garante ordenacao lexicografica correta.

### 5.2 A Sequencia Real de Migrations

Para recriar o banco do zero em 2026-05-22:

```
1. schema.sql                          — base completa ate migration 18
2. migration_*.sql (legado, em ordem cronologica por data do arquivo)
   └─ migration_modelo_financeiro.sql  — wallet, revenue_streams, RPCs
   └─ migration_security_hardening.sql — RLS em webhook_events, indexes
   └─ ... (demais arquivos legado)
3. migrations/19_estetica_walkin.sql
4. migrations/20_estetica_pricing_matrix.sql
5. migrations/21_estetica_bookings_prepay.sql
6. migrations/22_estetica_requires_booking.sql
7. migrations/23_wellness_reminders.sql
8. migrations/24_estetica_bookings_admin_created.sql
9. migrations/25_profiles_guard_sensitive_columns.sql
10. migrations/26_revenue_idempotency.sql
11. migrations/27_estetica_no_overlap.sql
12. migrations/28_drop_redundant_c1_trigger.sql
```

> **Nota importante.** Nao ha `supabase db` CLI configurado para aplicar migrations automaticamente. A aplicacao é manual via SQL Editor no painel Supabase. Esse é um trade-off consciente do projeto: simplicidade operacional em troca de rastreabilidade via git.

### 5.3 Idempotência Obrigatória

Toda migration do projeto deve ser idempotente: rodada duas vezes, produz o mesmo resultado sem erros. As tecnicas usadas:

```sql
-- Tabelas
CREATE TABLE IF NOT EXISTS public.minha_tabela (...);

-- Colunas
ALTER TABLE public.minha_tabela ADD COLUMN IF NOT EXISTS nova_coluna text;

-- Funcoes e triggers
CREATE OR REPLACE FUNCTION public.minha_funcao() ...;
DROP TRIGGER IF EXISTS meu_trigger ON public.minha_tabela;
CREATE TRIGGER meu_trigger ...;

-- Policies (nao tem IF NOT EXISTS — por isso sempre DROP IF EXISTS antes)
DROP POLICY IF EXISTS minha_policy ON public.minha_tabela;
CREATE POLICY minha_policy ON public.minha_tabela ...;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meu_index ON public.minha_tabela(coluna);
CREATE UNIQUE INDEX IF NOT EXISTS uq_meu_index ON public.minha_tabela(coluna);

-- Constraints com logica condicional
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'minha_constraint'
      AND conrelid = 'public.minha_tabela'::regclass
  ) THEN
    ALTER TABLE public.minha_tabela ADD CONSTRAINT minha_constraint ...;
  END IF;
END $$;

-- Seeds
INSERT INTO public.minha_tabela (slug, ...) VALUES ('valor', ...)
  ON CONFLICT (slug) DO NOTHING;
```

**Por que idempotência importa.** Em producao, migrations sao aplicadas manualmente. Um erro de rede, uma interrupcao, uma re-execucao por engano — sem idempotência, a migration deixa o banco em estado inconsistente e a segunda execucao falha com erros confusos.

### 5.4 Aplicação Manual no Painel Supabase

O workflow do time:

1. Desenvolvedor cria `supabase/migrations/NN_descricao.sql`
2. Testa localmente (copiar/colar no SQL Editor de um banco de dev)
3. Abre PR — revisao de codigo inclui revisao do SQL
4. Merge no main
5. Aplicar manualmente no painel Supabase de producao (SQL Editor > New query > colar > Run)
6. Confirmar que nao houve erro e que os dados estao corretos

> **Armadilha — PRE-CHECK em constraints.** Algumas migrations requerem pre-verificacao antes de executar (ex: a migration 27 com o EXCLUDE constraint). Leia os comentarios no topo de cada migration — eles documentam queries de pre-check quando necessario.

---

## 6. RPCs Atomicas e Security Definer

### 6.1 Por que Counters Nao Podem Ser SELECT-then-UPDATE

**O problema da race condition.**

```sql
-- Thread A                    -- Thread B (concorrente)
SELECT views_count FROM workout_videos WHERE id = $1;  -- retorna 100
                               SELECT views_count FROM workout_videos WHERE id = $1; -- retorna 100
UPDATE workout_videos SET views_count = 101 WHERE id = $1;
                               UPDATE workout_videos SET views_count = 101 WHERE id = $1;
-- Resultado: 101 (deveria ser 102)
```

Dois usuarios assistem ao mesmo video simultaneamente. O contador fica incorreto. Em sistemas de alta concorrência (351K seguidores), isso é inevitavel.

**A solucao:** operacao atomica direta no banco.

```sql
-- Atomico: o banco garante que o incremento é sequencial
UPDATE workout_videos
  SET views_count = views_count + 1
  WHERE id = $1;
```

O Postgres executa `views_count + 1` dentro de uma lock no nivel da linha — nao ha janela para race condition. Esse é o padrao `update set col = col + 1` exigido pelo CLAUDE.md.

### 6.2 `spend_wallet_cents` — FIFO com FOR UPDATE

A funcao de debito de wallet é o exemplo mais sofisticado de atomicidade no projeto (`supabase/migration_modelo_financeiro.sql:447`):

```sql
CREATE OR REPLACE FUNCTION public.spend_wallet_cents(
  p_user_id text,
  p_amount_cents int,
  p_revenue_stream_id uuid DEFAULT NULL
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_remaining int := p_amount_cents;
  v_credit record;
  v_used_total int := 0;
BEGIN
  IF p_amount_cents <= 0 THEN RETURN 0; END IF;

  -- FOR UPDATE: bloqueia as linhas selecionadas ate o fim da transacao
  -- Garante que dois debitos concorrentes nao consumam o mesmo credito
  FOR v_credit IN
    SELECT id, amount_cents
    FROM public.wallet_credits
    WHERE user_id = p_user_id
      AND used_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY expires_at ASC NULLS LAST, created_at ASC  -- FIFO: expira primeiro
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    -- ... logica de debito ...
  END LOOP;

  -- Atualiza o resumo de saldo de forma atomica (ON CONFLICT = upsert)
  INSERT INTO public.wallet_balance (user_id, spent_total_cents, active_cents)
  VALUES (p_user_id, v_used_total, -v_used_total)
  ON CONFLICT (user_id) DO UPDATE
    SET spent_total_cents = wallet_balance.spent_total_cents + v_used_total,
        active_cents      = wallet_balance.active_cents - v_used_total,
        updated_at        = now();

  RETURN v_used_total;
END;
$$;
```

**`FOR UPDATE`** adquire um lock de linha em cada `wallet_credit` selecionado. Se outra transacao tentar selecionar a mesma linha `FOR UPDATE`, ela bloqueia ate a primeira transacao terminar (commit ou rollback). Isso garante que dois debitos concorrentes nao consumam o mesmo credito.

**Ordem FIFO com prioridade de expiracao:** `ORDER BY expires_at ASC NULLS LAST, created_at ASC` consume primeiro os creditos que vencem mais cedo (evitando expiracao desperdicada), e entre creditos de mesmo prazo, o mais antigo primeiro.

**`ON CONFLICT DO UPDATE`** no `wallet_balance` é um upsert atomico. Se a linha de saldo nao existe (primeiro uso da wallet), ela é criada. Se ja existe, os totais sao somados atomicamente — sem SELECT previa, sem race condition.

### 6.3 `credit_wallet_cents` — ON CONFLICT DO UPDATE

```sql
-- supabase/migration_modelo_financeiro.sql:506
CREATE OR REPLACE FUNCTION public.credit_wallet_cents(
  p_user_id text,
  p_amount_cents int,
  p_source_stream_id uuid,
  p_validity_days int DEFAULT 120
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_amount_cents <= 0 THEN RETURN; END IF;

  -- Insere o credito com validade
  INSERT INTO public.wallet_credits
    (user_id, source_revenue_stream_id, amount_cents, expires_at)
  VALUES
    (p_user_id, p_source_stream_id, p_amount_cents,
     now() + (p_validity_days || ' days')::interval);

  -- Atualiza o resumo de saldo atomicamente
  INSERT INTO public.wallet_balance (user_id, active_cents, earned_total_cents)
  VALUES (p_user_id, p_amount_cents, p_amount_cents)
  ON CONFLICT (user_id) DO UPDATE
    SET active_cents       = wallet_balance.active_cents + p_amount_cents,
        earned_total_cents = wallet_balance.earned_total_cents + p_amount_cents,
        updated_at         = now();
END;
$$;
```

O padrao `INSERT ... ON CONFLICT DO UPDATE SET col = tabela.col + valor` é o counter atomico para tabelas de resumo. A coluna `tabela.col` referencia o valor atual da linha existente — o Postgres garante que a leitura e a escrita acontecem na mesma operacao atomica.

### 6.4 `decrement_stock_batch` — Atomicidade em Lote

```sql
-- supabase/migration_modelo_financeiro.sql:609
CREATE OR REPLACE FUNCTION public.decrement_stock_batch(p_items jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item record;
BEGIN
  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity int)
  LOOP
    UPDATE public.products
      SET stock = stock - v_item.quantity
      WHERE id = v_item.product_id AND stock >= v_item.quantity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'out_of_stock_or_invalid: %', v_item.product_id;
    END IF;
  END LOOP;
END;
$$;
```

**Tres garantias em uma unica funcao:**

1. **Atomicidade:** o `FOR` loop roda dentro de uma transacao. Se qualquer produto estiver sem estoque, a excecao reverte todos os decrementos anteriores no mesmo lote.

2. **Verificacao de estoque embutida:** `WHERE stock >= v_item.quantity` garante que o estoque nao fica negativo — sem SELECT previa, sem race condition. Se nao houver linhas afetadas (`NOT FOUND`), a excecao é lancada.

3. **JSON como input:** `jsonb_to_recordset(p_items)` converte um array JSON de objetos `{product_id, quantity}` em rows do Postgres. Isso permite decrementar N produtos em uma unica chamada RPC.

**Como é chamada no TypeScript:**

```typescript
await supabase.rpc('decrement_stock_batch', {
  p_items: JSON.stringify(
    cartItems.map(item => ({
      product_id: item.productId,
      quantity: item.quantity,
    }))
  ),
});
```

> **Armadilha — `SECURITY DEFINER` e search_path.** Funcoes `SECURITY DEFINER` executam com os privilégios do criador, nao do chamador. Isso significa que elas podem acessar tabelas que o usuario normal nao poderia. Para evitar injection via `search_path`, declare sempre `SET search_path = public` na funcao (como faz `guard_profile_sensitive_columns`). Funcoes sem essa declaracao sao vul­ner­aveis a ataques de schema injection.

---

## 7. Exercicios

### Exercicio 1 — Entendendo RLS com JWT

Dado o seguinte cenario: um usuario com `plan_tier = 'free'` faz uma query `SELECT * FROM workout_videos` usando `createServerSupabaseClient()`.

a) Quais colunas da policy `workouts_select_by_plan` sao avaliadas?
b) O que `public.plan_tier_level('free')` retorna? (dica: leia `schema.sql:150`)
c) Um treino com `required_plan = 'plano1'` aparece no resultado? Por que?
d) O que aconteceria se o mesmo usuario tentasse a query sem estar autenticado (JWT nulo)?

---

### Exercicio 2 — Desenhando a Policy Correta

A tabela `notifications` (hipotetica) tem as colunas `id uuid`, `user_id text`, `body text`, `is_read boolean`, `created_at timestamptz`. Regras:

- Um usuario pode VER apenas as proprias notificacoes
- Um usuario pode marcar como lida (UPDATE) apenas a propria notificacao
- Um usuario NAO pode criar notificacoes (so o sistema cria)
- Admins (service_role) tem acesso total

Escreva as 3 policies necessarias (select_own, update_own, admin) seguindo o padrao do projeto. Lembre-se de incluir `WITH CHECK` onde necessario.

---

### Exercicio 3 — Analisando o Trigger de Seguranca

Leia `supabase/migrations/25_profiles_guard_sensitive_columns.sql` e responda:

a) Se o webhook Asaas fizer `UPDATE profiles SET plan_tier = 'plano2' WHERE id = 'user_abc'` usando a service key, o trigger vai bloquear? Por que?
b) Se um usuario logado fizer `UPDATE profiles SET full_name = 'Novo Nome' WHERE id = 'user_abc'` usando a anon key com JWT valido, o trigger vai bloquear? Por que?
c) Adicione ao trigger a protecao da coluna `cpf` (que nao deve ser editavel pelo usuario apos o primeiro preenchimento). Escreva apenas o bloco `IF` adicional necessario.
d) Por que o trigger usa `IS DISTINCT FROM` em vez de `<>`?

---

### Exercicio 4 — EXCLUDE Constraint e Casos de Borda

Considere a constraint `no_overlapping_bookings` em `estetica_bookings`.

a) Um booking com `status = 'canceled'` impede um novo booking no mesmo horario? Por que?
b) Dois bookings com `scheduled_at = '2026-06-01 10:00'` e `duration_min = 60` — o segundo é rejeitado? Qual erro o Postgres lanca?
c) Um booking das 10h00 (60 min) e outro das 10h59 (30 min) — ha sobreposicao? Calcule o range de cada um e use o operador `&&`.
d) Por que a migration 27 inclui um PRE-CHECK antes de `ADD CONSTRAINT`? O que aconteceria sem ele?

---

### Exercicio 5 — Atomicidade e Race Conditions

Analise o seguinte codigo TypeScript (incorreto):

```typescript
// INCORRETO — nao use em producao
async function incrementAffiliateClicks(linkId: string) {
  const supabase = await createServerSupabaseClient();

  // Passo 1: busca o valor atual
  const { data } = await supabase
    .from('affiliate_links')
    .select('clicks_count')
    .eq('id', linkId)
    .single();

  // Passo 2: incrementa e salva
  await supabase
    .from('affiliate_links')
    .update({ clicks_count: data!.clicks_count + 1 })
    .eq('id', linkId);
}
```

a) Qual é o problema desse codigo sob concorrência? Descreva o cenario de race condition.
b) Reescreva usando uma query SQL atomica via `.rpc()` ou `.update()` sem o SELECT previo.
c) Por que o CLAUDE.md proibe o padrao SELECT-then-UPDATE para contadores?
d) A funcao `decrement_stock_batch` usa `stock = stock - v_item.quantity` no `UPDATE`. Como isso resolve o mesmo problema?

---

*Fim do Módulo 2. Próximo: Módulo 3 — Pagamentos (Asaas) & Modelo Financeiro.*
