# Setor: Fitness

## 1. Visão geral
- **Propósito:** Biblioteca de treinos em vídeo (embed do YouTube), com registro de execução por usuário, sistema de streak (sequência de dias), desafio semanal de 7 dias e calculadora de macros (TDEE / Harris-Benedict). Treinos são publicados pela admin (Kath) com gating por plano (`free` / `start` / `pro` / `vip`).
- **Quem usa:** Usuário final autenticado (consome treinos, registra logs, vê streak, desafio e calculadora) e admin (publica/edita/despublica treinos em `/admin/treinos`).
- **Status percebido:** production. Fluxos completos de listagem, detalhe, registro de conclusão, streak, admin CRUD e calculadora estão implementados; desafio é um stub que mapeia diretamente os 7 últimos treinos publicados (ver Observações).

## 2. Rotas
| Path | Arquivo | Tipo | Descrição |
|---|---|---|---|
| `/fitness` | `src/app/(app)/fitness/page.tsx:25` | RSC (App) | Lista treinos publicados, filtra por `cat`/`lvl` via query string, exibe `StreakBadge` do usuário. |
| `/fitness/[id]` | `src/app/(app)/fitness/[id]/page.tsx:40` | RSC (App) | Detalhe do treino: player adaptável (16:9 ou Shorts 9:16), badges, equipamentos, dica da Kath, cronômetro de descanso, treinos relacionados, botão "Completar". |
| `/desafio` | `src/app/(app)/desafio/page.tsx:15` | RSC (App) | Desafio "7 DIAS DE GLÚTEO" com progresso baseado em dias distintos com `workout_logs` nos últimos 7 dias. |
| `/calculadora` | `src/app/(app)/calculadora/page.tsx:16` | RSC + client child | Página estática que monta `<MacroCalculator />` (cálculo 100% client-side, sem persistência). |
| `/admin/treinos` | `src/app/admin/treinos/page.tsx:7` | RSC (Admin) | CRUD admin de treinos: lista, criar, editar, toggle publicado, deletar. |
| `/api/workout/complete` | `src/app/api/workout/complete/route.ts:9` | Route Handler `POST` | Registra `workout_logs` e atualiza streak/`last_workout_at` no `profiles`. |

## 3. Componentes
- **`WorkoutCard`** (`src/components/fitness/workout-card.tsx:33`) — card-link da grade `/fitness`. Renderiza thumbnail do YouTube (`hqdefault.jpg`), badge de categoria, badge de plano (se `required_plan !== "free"`), título, duração, nível e contador de views.
- **`WorkoutFilters`** (`src/components/fitness/workout-filters.tsx:23`) — chips client-side de categoria (`cat`) e nível (`lvl`); usa `useRouter`/`useSearchParams` e faz `router.push("/fitness?...")`. Atenção: a lista de categorias do filtro tem apenas 6 valores (`gluteo`, `pernas`, `superior`, `hiit`, `full`, `viagem`) enquanto o backend aceita 17 (ver Observações).
- **`StreakBadge`** (`src/components/fitness/streak-badge.tsx:9`) — badge com ícone de chama e contador de dias consecutivos; cor pink quando `streak > 0`, cinza em zero.
- **`VideoPlayer`** (`src/components/fitness/video-player.tsx:16`) — `<iframe>` para `youtube.com/embed/<id>`; alterna `aspect-video` vs `aspect-[9/16] max-w-[360px]` baseado em `is_short`. Tem fallback para link externo em caso de erro.
- **`RestTimer`** (`src/components/fitness/rest-timer.tsx:10`) — cronômetro de descanso com presets de 30/45/60/90/120 s, barra de progresso, vibração ao terminar (`navigator.vibrate`). Estado puramente local (não persiste).
- **`CompleteWorkoutButton`** (`src/app/(app)/fitness/[id]/complete-button.tsx:13`) — botão client que chama `POST /api/workout/complete` e exibe toast (sonner) com `streak` retornado.
- **`MacroCalculator`** (`src/app/(app)/calculadora/macro-calculator.tsx:74`) — formulário client-only de cálculo de calorias e macros (Harris-Benedict + multiplicador de atividade + meta). Sem persistência.
- **`WorkoutForm`** (`src/app/admin/treinos/workout-form.tsx:23`) — dialog de criação de treino (admin). Submete `FormData` para `createWorkout`.
- **`WorkoutEdit`** (`src/app/admin/treinos/workout-edit.tsx:28`) — dialog de edição (admin). Submete `FormData` para `updateWorkout`.
- **`WorkoutList`** (`src/app/admin/treinos/workout-list.tsx:48`) — tabela admin com ações inline (edit, toggle publish, delete) chamando server actions.

## 4. Server Actions / API Routes
| Endpoint/Action | Método | Input | Output | Quem chama |
|---|---|---|---|---|
| `getWorkouts()` | Server Action | (nenhum; exige admin) | `workout_videos[]` ordenado por `published_at desc` | `src/app/admin/treinos/page.tsx:8` |
| `createWorkout(formData)` | Server Action | `FormData` validado por `createWorkoutSchema` | void; `revalidatePath("/admin/treinos")`; dispara `notifyByPlan(...)` se `is_published` | `WorkoutForm` (`workout-form.tsx:30`) |
| `updateWorkout(id, formData)` | Server Action | `id: string`, `FormData` (sem revalidação de schema; lê campos diretos) | void; `revalidatePath("/admin/treinos")` | `WorkoutEdit` (`workout-edit.tsx:35`) |
| `toggleWorkoutPublished(id, published)` | Server Action | `id: string`, `published: boolean` | void; atualiza `is_published` e `published_at` | `WorkoutList` (`workout-list.tsx:125`) |
| `deleteWorkout(id)` | Server Action | `id: string` | void; remove a linha | `WorkoutList` (`workout-list.tsx:140`) |
| `POST /api/workout/complete` | API Route | `{ workoutId: string }` JSON; auth Clerk | `{ completed: true, streak: number }` ou `{ error }` 400/401/500 | `CompleteWorkoutButton` (`complete-button.tsx:20`) |

Detalhes da API route (`src/app/api/workout/complete/route.ts`):
- Linhas 10-13: exige `userId` via `auth()` do Clerk; 401 se ausente.
- Linhas 27-30: insere `workout_logs { user_id, workout_id }` (trigger `on_workout_log_insert` no schema incrementa `views_count` em `workout_videos`).
- Linhas 36-63: lê `profiles.workout_streak` e `profiles.last_workout_at`; calcula novo streak — `< 24h` mantém, `< 48h` incrementa, caso contrário reseta para `1`.
- Linhas 66-72: persiste `workout_streak` e `last_workout_at` em `profiles`.
- Usa `createAdminSupabaseClient()` (service_role) — ignora RLS de propósito porque o user_id já vem do Clerk.

Todas as server actions admin passam por `requireAdmin()` (`src/app/admin/actions.ts:19`) que valida `sessionClaims.metadata.role === "admin"` (Clerk).

## 5. Modelo de dados

### Tabela `workout_videos` (`supabase/schema.sql:86` + `supabase/migration_workout_v2.sql`)
- `id`: uuid PK — gerado por `gen_random_uuid()`.
- `title`: text NOT NULL — título exibido em UI.
- `description`: text — descrição opcional exibida na página de detalhe.
- `youtube_id`: text NOT NULL — ID extraído de URL via `extractYoutubeId()` (`src/lib/youtube/embed.ts`).
- `category`: text NOT NULL CHECK — após `migration_workout_v2.sql:9-14` aceita 17 valores: `gluteo, pernas, costas, ombro, biceps, triceps, peito, abdomen, superior, hiit, cardio, funcional, full, alongamento, aquecimento, viagem, competicao`.
- `level`: text NOT NULL CHECK — `iniciante | intermediario | avancado`.
- `duration_minutes`: int NOT NULL — duração declarada pelo admin (1-300, ver Validações).
- `required_plan`: text NOT NULL DEFAULT `'free'` CHECK — `free | start | pro | vip`. Filtragem por `plan_tier_level()` na RLS.
- `thumbnail_url`: text — não usado em UI atual; thumb é montada de `https://img.youtube.com/vi/<id>/hqdefault.jpg` (`workout-card.tsx:54`).
- `views_count`: int NOT NULL DEFAULT `0` — incrementado pelo trigger `on_workout_log_insert` (`schema.sql:592-595`).
- `is_published`: boolean NOT NULL DEFAULT `false`.
- `published_at`: timestamptz — set/cleared por `createWorkout`/`toggleWorkoutPublished`.
- `is_short`: boolean NOT NULL DEFAULT `false` — adicionado em `migration_workout_v2.sql:17`. Controla aspect ratio do `VideoPlayer`.
- `notes`: text — "Dica da Kath" exibida em destaque na página de detalhe; adicionado em `migration_workout_v2.sql:20`.
- `equipment`: text[] — lista de equipamentos exibida como badges; adicionado em `migration_workout_v2.sql:23`. **Não é gravado pelos formulários admin atuais** (ver Observações).
- **Índices:** `idx_workout_videos_category`, `idx_workout_videos_published(is_published, published_at desc)` (`schema.sql:553-554`).
- **RLS:**
  - `workouts_select_by_plan` (`schema.sql:107-115`): authenticated vê apenas `is_published = true` E `plan_tier_level(profiles.plan_tier) >= plan_tier_level(required_plan)`.
  - `workouts_admin` (`schema.sql:118-122`): service_role acesso total (server actions admin usam `createAdminSupabaseClient`).

### Tabela `workout_logs` (`supabase/schema.sql:179`)
- `id`: uuid PK.
- `user_id`: text NOT NULL DEFAULT `(auth.jwt()->>'sub')` — FK em `profiles(id)`.
- `workout_id`: uuid NOT NULL — FK em `workout_videos(id)`.
- `completed_at`: timestamptz NOT NULL DEFAULT `now()`.
- `duration_actual`: int — campo previsto mas não escrito pelo flow atual (`/api/workout/complete` insere apenas `user_id` e `workout_id`).
- **Índices:** `idx_workout_logs_user`, `idx_workout_logs_completed` (`schema.sql:557-558`).
- **Trigger:** `on_workout_log_insert AFTER INSERT` chama `increment_views()` que faz `update workout_videos set views_count = views_count + 1` (`schema.sql:579-595`).
- **RLS:**
  - `logs_select_own` (`schema.sql:190-193`): user vê apenas `user_id = auth.jwt()->>'sub'`.
  - `logs_insert_own` (`schema.sql:196-199`): user insere apenas com seu `user_id`.
  - `logs_admin` (`schema.sql:202-206`): service_role acesso total.

### Campos consumidos em `profiles` (tabela é dona do setor "Plataforma/Auth")
O setor Fitness lê e escreve dois campos de `profiles` documentados pelo setor responsável:
- `workout_streak` (lido em `/fitness/page.tsx:43-45` e atualizado em `/api/workout/complete` linhas 67-72).
- `last_workout_at` (mesma origem; usado na lógica de streak linhas 45-62).

Detalhes completos de `profiles` (incluindo `plan_tier`) ficam em `../plataforma/auth.md` (responsabilidade do agente de Plataforma).

## 6. Integrações externas
- **YouTube (embed público):** thumbnails em `https://img.youtube.com/vi/<id>/{hqdefault,mqdefault}.jpg` (`workout-card.tsx:54`, `[id]/page.tsx:186`, `workout-list.tsx:83`) e player em `https://www.youtube.com/embed/<id>?rel=0&modestbranding=1&playsinline=1` (`video-player.tsx:48`). Não há chamada à YouTube Data API neste setor; helper `extractYoutubeId()` em `src/lib/youtube/embed.ts` parseia URL/ID. Detalhes do helper são responsabilidade do setor "Plataforma/Util" — ver `../plataforma/youtube.md`.
- **Clerk:** todas as server actions admin e o `POST /api/workout/complete` autenticam via `auth()` do `@clerk/nextjs/server`. Detalhes do subsistema em `../plataforma/auth.md`.
- **Supabase:** acesso via `createServerSupabaseClient()` (RLS) e `createAdminSupabaseClient()` (service_role). Detalhes em `../plataforma/supabase.md`.
- **Web Push (VAPID):** `createWorkout` chama `notifyByPlan(...)` quando publica um treino (`actions.ts:65-71`) — disparo de "Novo treino disponível!" para todos do plano. Detalhes do subsistema em `../plataforma/notifications.md`.

## 7. Validações
- **`createWorkoutSchema`** (`src/lib/validations.ts:7-22`) — schema Zod usado por `createWorkout`. Campos: `title (1-200)`, `description (≤2000 nullable)`, `youtube_id (1-500)`, `category` (enum 17 valores idêntico ao CHECK do banco), `level` (3 valores), `duration_minutes` (int 1-300, coerced), `required_plan` (`planTierSchema` default `free`), `is_published` (bool coerced), `is_short` (bool coerced), `notes (≤2000 nullable)`. **O setor Fitness é o dono lógico deste schema.**
- **`updateWorkout`** (`actions.ts:77-98`): **não usa `createWorkoutSchema`**. Lê campos brutos de `FormData` com casts (`as string`, `Number(...)`); confia no CHECK constraint do banco. Inconsistência apontada em Observações.
- **`POST /api/workout/complete`** (`route.ts:14-22`): validação inline manual — exige `body.workoutId` truthy; retorna 400 se ausente. Não usa Zod.
- **`MacroCalculator`** (`macro-calculator.tsx:80-89`): validação inline simples — `if (!weight || !height || !age) return;`. Sem schema Zod (cálculo é puramente client-side, descartável).

## 8. Fluxos principais

### Fluxo: Listar e filtrar treinos
1. Usuário acessa `/fitness?cat=gluteo&lvl=iniciante`.
2. `FitnessPage` cria cliente Supabase autenticado (`createServerSupabaseClient`) e a RLS `workouts_select_by_plan` aplica filtro automático por `plan_tier` (`/fitness/page.tsx:27-39`).
3. Filtros adicionais (`category`, `level`) são aplicados como `eq` quando presentes nas query params (linhas 36-37).
4. Em paralelo, busca `profiles.workout_streak` para o `StreakBadge` (linhas 42-45).
5. Renderiza grade de `WorkoutCard`. `WorkoutFilters` (client) faz `router.push` ao alternar chip.

### Fluxo: Assistir e completar treino
1. Usuário clica em um card → `/fitness/<id>`.
2. `WorkoutPage` usa `createAdminSupabaseClient()` (bypass RLS) e busca o treino por `id` + `is_published = true` (`[id]/page.tsx:43-50`); `notFound()` se inexistente.
3. Busca até 3 treinos relacionados da mesma categoria (linhas 55-62) e checa se o usuário já tem `workout_logs` hoje (linhas 65-74) → controla estado inicial do `CompleteWorkoutButton`.
4. Renderiza `VideoPlayer` (16:9 ou 9:16 conforme `is_short`), badges, equipamentos, dica, `RestTimer` e relacionados.
5. Ao clicar "Completar Treino", `CompleteWorkoutButton` faz `POST /api/workout/complete` com `{ workoutId }` (`complete-button.tsx:20-25`).
6. Route handler insere `workout_logs` (trigger DB incrementa `views_count`), recalcula streak e atualiza `profiles.workout_streak` + `last_workout_at` (`route.ts:27-72`).
7. Resposta `{ completed: true, streak }` aciona toast "Treino concluído! +1 dia no streak · N dias consecutivos".

### Fluxo: Desafio 7 dias
1. Usuário acessa `/desafio`.
2. Busca os 7 treinos publicados mais recentes (`desafio/page.tsx:20-26`) — não há tabela própria de "desafio", os cards de dia mapeiam diretamente esses 7 vídeos.
3. Para o usuário autenticado, busca `workout_logs` dos últimos 7 dias e conta dias distintos via `Set(toDateString)` (linhas 30-46), capando em 7.
4. Renderiza barra de progresso `completedDays/7` e cards onde `dayIdx < completedDays` é "feito", `=== completedDays` é "hoje" (com botão treinar) e `>` é "trancado".

### Fluxo: Calcular macros
1. Usuário acessa `/calculadora`.
2. `MacroCalculator` (client) coleta sexo, meta, atividade, peso/altura/idade.
3. Submit calcula BMR (Harris-Benedict ramo masculino/feminino, `macro-calculator.tsx:48-55`), TDEE = BMR × atividade, `calories = TDEE × {0.8, 1.0, 1.15}` por meta.
4. Macros: `protein = peso × 2`, `fat = (calories × 0.25)/9`, `carbs = (calories − protein·4 − fat·9)/4` (linhas 66-69).
5. Renderiza calorias-alvo + 3 `MacroBar` (proteína, carbo, gordura) com percentuais. Resultado existe apenas em estado React; nada é persistido.

### Fluxo: Admin publica treino
1. Admin acessa `/admin/treinos` (passa por `requireAdmin()`).
2. Clica "Novo Treino" → `WorkoutForm` abre dialog.
3. Submit chama server action `createWorkout(formData)` que valida com `createWorkoutSchema`, normaliza `youtube_id` via `extractYoutubeId()`, insere com `published_at = now()` se publicado e dispara `notifyByPlan` para o tier alvo (`actions.ts:43-75`).
4. `revalidatePath("/admin/treinos")` força refresh da lista.

## 9. Observações (notas para Fase B — não auditar agora)
- **`updateWorkout` não valida com Zod** (`src/app/admin/actions.ts:77-98`): lê campos brutos de `FormData` com `as string` e `Number(...)`. Schemas Zod existem (`createWorkoutSchema`) — deveria ter `updateWorkoutSchema` ou reaproveitar via `.partial()`.
- **`equipment: text[]` existe no banco mas não tem UI**: a coluna foi adicionada em `migration_workout_v2.sql:23` e é lida em `[id]/page.tsx:77`, mas nenhum form admin (`workout-form.tsx`, `workout-edit.tsx`) permite escrever; só existirá conteúdo se editado direto no banco.
- **`duration_actual` em `workout_logs` não é populado**: `POST /api/workout/complete` insere só `user_id`/`workout_id`; coluna fica sempre NULL.
- **Lista de categorias divergente entre filtros e backend**: `WorkoutFilters` (`workout-filters.tsx:6-14`) só oferece 6 das 17 categorias suportadas pelo CHECK e pelo schema Zod. Categorias como `costas`, `ombro`, `biceps`, `triceps`, `peito`, `abdomen`, `cardio`, `funcional`, `alongamento`, `aquecimento`, `competicao` não são filtráveis pela UI. Mesmo problema no `categoryLabels` de `workout-card.tsx:18-25` (faltam labels para 11 categorias — fallback é o slug cru).
- **`/desafio` é um stub**: não há tabela `challenges` nem entidade própria; os "dias" do desafio mapeiam os 7 últimos treinos publicados independentemente da categoria, contradizendo o título hardcoded "7 DIAS DE GLÚTEO" (`desafio/page.tsx:62-65`).
- **Streak calc baseia-se em janela de horas (24/48), não em datas calendáricas** (`route.ts:51-62`). Treinar às 23:00 e às 22:00 do dia seguinte (`diffHours = 23h`) mantém o streak no mesmo dia em vez de incrementar; treinar duas vezes em 23h conta uma só. Edge case: timezone do servidor afeta o cálculo.
- **`already completed today` usa `single()` sem `maybeSingle()`** (`[id]/page.tsx:67-74`): se houver mais de 1 log no mesmo dia/treino o select retorna erro silencioso (cai em `!!todayLog === false`). Prática frágil.
- **`thumbnail_url` está no schema mas nunca é usado** — UI sempre monta URL de `img.youtube.com/vi/<id>/...`. Coluna pode ser removida.
- **`MacroCalculator` não persiste**: usuário recalcula a cada visita; sem integração com `consultations.daily_*` (que existe no schema). Potencial sincronização futura.
- **`createWorkout` revalida apenas `/admin/treinos`** mas não `/fitness` ou `/desafio` — usuários só veem novos treinos após cache expirar ou navegação revalidante.
- **TODOs/FIXMEs explícitos:** nenhum comentário `TODO`/`FIXME` foi encontrado nos arquivos do escopo.

## 10. Referências
- **Arquivos-chave:**
  - `src/app/(app)/fitness/page.tsx:25` — listagem.
  - `src/app/(app)/fitness/loading.tsx:1` — skeleton da grade.
  - `src/app/(app)/fitness/[id]/page.tsx:40` — detalhe.
  - `src/app/(app)/fitness/[id]/complete-button.tsx:13` — botão completar.
  - `src/app/(app)/desafio/page.tsx:15` — desafio 7 dias.
  - `src/app/(app)/calculadora/page.tsx:16` — landing calc.
  - `src/app/(app)/calculadora/macro-calculator.tsx:74` — calculadora.
  - `src/components/fitness/workout-card.tsx:33`
  - `src/components/fitness/workout-filters.tsx:23`
  - `src/components/fitness/streak-badge.tsx:9`
  - `src/components/fitness/video-player.tsx:16`
  - `src/components/fitness/rest-timer.tsx:10`
  - `src/app/api/workout/complete/route.ts:9`
  - `src/app/admin/treinos/page.tsx:7`
  - `src/app/admin/treinos/workout-form.tsx:23`
  - `src/app/admin/treinos/workout-edit.tsx:28`
  - `src/app/admin/treinos/workout-list.tsx:48`
  - `src/app/admin/actions.ts:32-123` — server actions admin de treinos.
  - `src/lib/validations.ts:7-22` — `createWorkoutSchema`.
- **Migrations:**
  - `supabase/schema.sql:86-122` — definição base de `workout_videos` + RLS.
  - `supabase/schema.sql:179-206` — definição de `workout_logs` + RLS.
  - `supabase/schema.sql:577-595` — função `increment_views()` e trigger `on_workout_log_insert`.
  - `supabase/schema.sql:553-558` — índices.
  - `supabase/migration_workout_v2.sql` — expansão de categorias (17), `is_short`, `notes`, `equipment`.
- **Setores cruzados:**
  - `../plataforma/auth.md` — Clerk, `requireAdmin()`, `profiles.plan_tier`, `profiles.workout_streak`, `profiles.last_workout_at`.
  - `../plataforma/supabase.md` — `createServerSupabaseClient`, `createAdminSupabaseClient`, função SQL `plan_tier_level()`.
  - `../plataforma/notifications.md` — `notifyByPlan` consumido em `createWorkout`.
  - `../plataforma/youtube.md` — helper `extractYoutubeId` em `src/lib/youtube/embed.ts`.
  - `../plataforma/validations.md` — `parseFormData`, `planTierSchema` (compartilhados em `lib/validations.ts`).
  - `../dominio/consultorias.md` — tabela `consultations` consome `daily_calories/protein/carbs/fat` (relacionado conceitualmente à calculadora de macros, mas sem ligação no código).
