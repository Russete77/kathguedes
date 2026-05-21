# Setor: Consultoria

## 1. Visão geral

- **Propósito:** Oferecer consultoria fitness personalizada (treino + dieta) montada pela Kath Guedes diretamente no app, sem PDF — o assinante preenche uma anamnese de 7 etapas e o admin monta os planos estruturados (JSONB) renderizados nativamente pelo cliente. Ver cabeçalho da migration em `supabase/migration_consultations_inapp.sql:1-4`.
- **Quem usa:** Ambos — assinante VIP (preenche anamnese e visualiza plano em `src/app/(app)/consultoria/page.tsx`) e admin (cria consultoria, monta treino/dieta em `src/app/admin/consultorias/[id]/page.tsx`).
- **Status percebido:** production. Fluxo end-to-end funcional: criação manual + auto-criação por webhook Asaas (VIP), submissão de anamnese, edição de plano com templates hardcoded e DB, entrega com notificação push.

## 2. Rotas

| Path | Arquivo | Tipo | Descrição |
|---|---|---|---|
| `/consultoria` | `src/app/(app)/consultoria/page.tsx:30` | Page (Server) | Hub do assinante: estado conforme `status` da consultoria (sem consultoria, anamnese pendente, em progresso, plano entregue). Renderiza macros, treino e dieta. |
| `/consultoria/anamnese` | `src/app/(app)/consultoria/anamnese/page.tsx:9` | Page (Server) | Formulário de anamnese de 7 steps. Faz `redirect("/consultoria")` se não houver consultoria com `anamnesis is null` (`page.tsx:25-28`). |
| `/api/consultoria/anamnese` | `src/app/api/consultoria/anamnese/route.ts:11` | API Route (POST) | Persiste a anamnese e move `status` para `in_progress`. |
| `/admin/consultorias` | `src/app/admin/consultorias/page.tsx:7` | Page (Server) | Fila administrativa com filtro por status e modal de criação manual. |
| `/admin/consultorias/[id]` | `src/app/admin/consultorias/[id]/page.tsx:23` | Page (Server) | Detalhe + editor de plano (treino, dieta, macros, notas) + viewer da anamnese. |

## 3. Componentes

- **`ExerciseCard`** (`src/app/(app)/consultoria/exercise-card.tsx:35`) — card de exercício do plano entregue; com `youtube_id` mostra thumbnail clicável que abre player embed (suporta prefixo `short:` para vídeos verticais — `exercise-card.tsx:42-46`).
- **`AnamneseSummary`** (`src/app/(app)/consultoria/anamnese-summary.tsx:1`) — resumo collapsible da anamnese exibido junto ao plano entregue (`page.tsx:455-457`).
- **`AnamneseForm`** (`src/app/(app)/consultoria/anamnese/anamnese-form.tsx:72`) — formulário multi-step (7 etapas) com validação por step (`validateStep` em `anamnese-form.tsx:149-200`); submete via `POST /api/consultoria/anamnese` (`anamnese-form.tsx:261-265`).
- **`ConsultationForm`** (`src/app/admin/consultorias/consultation-form.tsx:21`) — dialog admin para criar consultoria manualmente (campos: `user_id`, `package_type`, `days_valid`).
- **`ConsultationQueue`** (`src/app/admin/consultorias/consultation-queue.tsx:42`) — tabela admin com filtro por status (`all`, `pending`, `in_progress`, `delivered`) e botão "Iniciar" para mover de `pending` → `in_progress` (`consultation-queue.tsx:122-129`).
- **`PlanEditor`** (`src/app/admin/consultorias/[id]/plan-editor.tsx:135`) — editor de plano com:
  - Templates hardcoded de treino (`plan-editor.tsx:167-373`): glúteo+pernas-4, upper/lower-4, full-body-3, ppl-6, hiit-3.
  - Templates hardcoded de dieta (`plan-editor.tsx:376` em diante): cutting-4, bulking-6, etc.
  - Templates DB lidos da tabela `plan_templates` (out-of-scope — ver Setor cross).
  - Cálculo automático de macros via Harris-Benedict (`plan-editor.tsx:97-133`) com multiplicador de atividade (`plan-editor.tsx:85-95`).
  - Botão "Salvar rascunho" e "Entregar" (`plan-editor.tsx:695-717`) — ao entregar, `status` vira `delivered` e dispara push.
- **`AnamneseViewer`** (`src/app/admin/consultorias/[id]/anamnese-viewer.tsx:1`) — visualização da anamnese pela Kath/admin no detalhe da consultoria.

## 4. Server Actions / API Routes

| Endpoint/Action | Método | Input | Output | Quem chama |
|---|---|---|---|---|
| `POST /api/consultoria/anamnese` | POST | `{ consultationId: string, anamnesis: Record<string, unknown> }` (`route.ts:17`) | `{ ok: true }` ou erro 400/401/404/500 | `AnamneseForm.handleSubmit` (`anamnese-form.tsx:261`) |
| `getConsultations(status?)` | Server Action | `status?: string` | `consultations[*] + profiles!inner(full_name)` ordenado por `created_at` desc | `AdminConsultoriasPage` (`page.tsx:9`) — definida em `src/app/admin/actions.ts:456` |
| `updateConsultationPlan(id, payload)` | Server Action | `id: string`, payload validado por `updateConsultationSchema` | void; revalida `/admin/consultorias`; envia push se `status === "delivered"` (`actions.ts:489-504`) | `PlanEditor.handleSave` (`plan-editor.tsx:695-707`) — definida em `src/app/admin/actions.ts:472` |
| `updateConsultationStatus(id, status)` | Server Action | `id: string`, `status: string` | void; revalida `/admin/consultorias` | `ConsultationQueue` botão Iniciar (`consultation-queue.tsx:126`) — definida em `src/app/admin/actions.ts:509` |
| `createConsultation(formData)` | Server Action | `FormData { user_id, package_type, days_valid }` | void; cria registro com `status: pending`, calcula `valid_until = hoje + days_valid` (`actions.ts:540-548`); envia push para o assinante (`actions.ts:553-558`) | `ConsultationForm.handleSubmit` (`consultation-form.tsx:28`) — definida em `src/app/admin/actions.ts:532` |
| `getProfilesList()` | Server Action | — | `profiles[id, full_name, plan_tier]` ordenado por nome | `AdminConsultoriasPage` (`page.tsx:10`) — definida em `src/app/admin/actions.ts:522` |

Todas as Server Actions admin chamam `requireAdmin()` no início (ex.: `actions.ts:457`, `476`, `510`, `533`).

## 5. Modelo de dados

### Tabela `consultations` (`supabase/schema.sql:128-145` + `supabase/migration_consultations_inapp.sql`)

Definição original em `schema.sql:128`; a migration `migration_consultations_inapp.sql` removeu colunas legadas de PDF (`workout_plan_url`, `diet_plan_url`) e adicionou as colunas estruturadas atuais.

- `id`: `uuid` PK default `gen_random_uuid()` — identificador da consultoria.
- `user_id`: `text NOT NULL` — FK para `profiles.id` (Clerk `sub`).
- `package_type`: `text NOT NULL` — check em `('mensal', 'trimestral', 'premium', 'assessoria')` (`schema.sql:131-132`). Labels exibidas em `consultation-queue.tsx:35-40`.
- `status`: `text NOT NULL DEFAULT 'pending'` — check em `('pending', 'in_progress', 'delivered', 'expired')` (`schema.sql:133-134`).
- `anamnesis`: `jsonb` — payload completo do formulário (28+ campos; ver seção 7 e tipos em `src/app/admin/consultorias/[id]/anamnese-viewer.tsx:10-50`).
- `workout_plan`: `jsonb` — formato `{ weeks: [{ name, days: [{ name, exercises: [{ name, sets, reps, rest, notes?, youtube_id? }] }] }] }` (documentado em `migration_consultations_inapp.sql:11` e tipado em `page.tsx:189-204`).
- `diet_plan`: `jsonb` — formato `{ meals: [{ name, time, foods: [{ name, quantity, unit, calories, protein, carbs, fat }] }] }` (`migration_consultations_inapp.sql:15` e `page.tsx:206-212`).
- `daily_calories`, `daily_protein`, `daily_carbs`, `daily_fat`: `int` — totais diários de macros calculáveis via Harris-Benedict no `PlanEditor` (`plan-editor.tsx:97-133`).
- `notes_admin`: `text` — observações internas da Kath (não visíveis ao assinante).
- `valid_until`: `timestamptz NOT NULL` — fim da validade (calculado em `createConsultation` como `hoje + days_valid`, `actions.ts:540-541`).
- `created_at`: `timestamptz NOT NULL DEFAULT now()`.

**Índices** (`schema.sql:555-570`):
- `idx_consultations_user` em `(user_id)`.
- `idx_consultations_status` em `(status)`.
- `idx_consultations_anamnesis` em `((anamnesis is not null))` — partial index para acelerar o filtro "anamnese pendente".

**RLS** (`schema.sql:147-173`):
- `consultations_select_own` — `SELECT` autenticado: `auth.jwt()->>'sub' = user_id`.
- `consultations_insert_own` — `INSERT` autenticado com check no mesmo predicate (assinante pode comprar consultoria via cliente, embora na prática a criação aconteça via Server Action admin / webhook).
- `consultations_update_own` — `UPDATE` autenticado (assinante atualiza a anamnese; entretanto a rota `POST /api/consultoria/anamnese` usa client admin/service_role — `route.ts:25`).
- `consultations_admin` — `ALL` para `service_role` (admin via `createAdminSupabaseClient`).

## 6. Integrações externas

- **Clerk (auth):** validação de `userId` em `route.ts:12` e em `consultoria/page.tsx:31`. Detalhes do subsistema documentados pelo setor de plataforma "Auth/Clerk".
- **Supabase (DB):** acesso via `createServerSupabaseClient` (RLS por usuário em `consultoria/page.tsx:32`) e `createAdminSupabaseClient` (bypass RLS via service_role em `route.ts:25` e em todas as Server Actions admin). Documentação dos clients/RLS globais é responsabilidade do setor "Supabase/Infra".
- **Asaas (pagamentos):** o webhook `src/app/api/webhook/asaas/route.ts:107-149` cria automaticamente uma consultoria `package_type: "mensal"` quando um pagamento VIP é confirmado e dispara push de boas-vindas. Detalhes do webhook são documentados pelo setor "Pagamentos/Asaas".
- **Web Push (VAPID):** `notifyUser` é chamado em `actions.ts:497-503` (entrega), `actions.ts:553-558` (criação manual) e em `webhook/asaas/route.ts:147-150` (auto-criação VIP). Documentação do subsistema em "Push/Notifications".
- **YouTube (embed):** `ExerciseCard` (`exercise-card.tsx:42-46`) consome `youtube_id` (`hqdefault.jpg` thumbnail + iframe embed). Suporta marcador `short:` para Shorts. Sem chamada de API — apenas URLs públicas.

## 7. Validações

- **`updateConsultationSchema`** (`src/lib/validations.ts:71-80`) — schema Zod usado por `updateConsultationPlan`. Campos opcionais: `workout_plan: z.unknown()`, `diet_plan: z.unknown()`, `daily_calories/protein/carbs/fat: z.coerce.number().int().min(0)`, `status: z.enum(["pending","in_progress","delivered","expired"])`, `notes_admin: z.string().max(5000)`. Schemas/treino/dieta dentro de `workout_plan`/`diet_plan` são `z.unknown()` (validação estrutural delegada ao TS no client).
- **Validação inline da anamnese** (`anamnese-form.tsx:149-200`) — `validateStep` exige campos por etapa antes de avançar (ex.: step 1 = nome/data/sexo/peso/altura; step 3 = frequência/duração/local/equipamentos≥1/horário; step 5 = lesões/gravidez/menstruação/sono).
- **Validação inline da API** (`route.ts:18-23`) — apenas verifica presença de `consultationId` e `anamnesis`; não valida estrutura interna da anamnese.

## 8. Fluxos principais

### Fluxo: VIP compra → consultoria automática
1. Asaas confirma pagamento via webhook `/api/webhook/asaas` (out-of-scope).
2. Webhook ativa plano VIP e checa se há consultoria ativa em `pending|in_progress` (`webhook/asaas/route.ts:125-127`).
3. Se não houver, insere `consultations { package_type: "mensal", status: "pending", valid_until: ... }` (`route.ts:138-144`).
4. Dispara push "Sua consultoria está disponível!" linkando para `/consultoria/anamnese` (`route.ts:146-149`).
5. Assinante abre `/consultoria` — como `consultation.anamnesis` é `null` e `status === "pending"`, vê CTA "Preencher anamnese" (`consultoria/page.tsx:96-121`).

### Fluxo: Admin cria consultoria manualmente
1. Admin abre `/admin/consultorias` e clica "Nova Consultoria" (`ConsultationForm`).
2. Seleciona assinante, pacote e dias de validade; submete o form action `createConsultation` (`actions.ts:532`).
3. Server Action insere com `status: "pending"`, calcula `valid_until` (`actions.ts:540-548`) e envia push para o usuário (`actions.ts:553-558`).
4. `revalidatePath("/admin/consultorias")` atualiza a fila.

### Fluxo: Assinante preenche anamnese
1. `/consultoria/anamnese` busca consultoria ativa com `anamnesis is null` (`anamnese/page.tsx:15-23`); se não existir, redirect para `/consultoria`.
2. `AnamneseForm` exibe 7 steps (Dados pessoais → Objetivo → Treino → Alimentação → Saúde → Estilo de vida → Observações).
3. `validateStep` bloqueia avanço sem campos obrigatórios.
4. Submit constrói payload com 28+ campos + `submittedAt: ISO` (`anamnese-form.tsx:205-259`) e faz `POST /api/consultoria/anamnese`.
5. API atualiza `consultations.anamnesis = body.anamnesis` e `status = "in_progress"` (`route.ts:40-46`); router faz push para `/consultoria` que renderiza tela "PLANO SENDO MONTADO" (`consultoria/page.tsx:140-181`).

### Fluxo: Admin monta plano e entrega
1. Admin abre `/admin/consultorias/[id]`; página carrega consultoria + templates DB de treino e dieta em paralelo (`page.tsx:28-46`).
2. `AnamneseViewer` exibe ficha; `PlanEditor` carrega estado inicial.
3. Admin pode aplicar template hardcoded ou DB (`plan-editor.tsx:applyWorkoutTemplate` ~`:580-616`, `applyDietTemplate` ~`:618-642`).
4. Botão "Aplicar cálculo automático" usa `applyMacroCalculation` (`plan-editor.tsx:644-669`) com Harris-Benedict; multiplicador depende de `trainingLevel`/`weeklyFrequency` (`plan-editor.tsx:85-95`); proteína fixada em 1.8 g/kg, gordura 25% das kcal (`plan-editor.tsx:122-125`).
5. "Salvar rascunho" → `updateConsultationPlan(id, payload sem status)`. "Entregar" → mesmo payload com `status: "delivered"` (`plan-editor.tsx:695-707`).
6. Server Action valida com `updateConsultationSchema` (`actions.ts:479`) e, se `delivered`, dispara push "Seu plano está pronto!" linkando para `/consultoria` (`actions.ts:489-504`).

### Fluxo: Visualização do plano entregue
1. `/consultoria` carrega consultoria ativa (`consultoria/page.tsx:42-49`).
2. Branch `delivered` (`page.tsx:183` em diante) renderiza:
   - Card "MACROS DIÁRIOS" se `daily_calories > 0` (`page.tsx:254-306`).
   - Loop por `workout_plan.weeks[].days[]` com cards por exercício via `ExerciseCard` (`page.tsx:311-359`).
   - Loop por `diet_plan.meals[]` agregando `totalCals`/`totalProtein`/carbs/fat por refeição (`page.tsx:364-452`).
   - `AnamneseSummary` collapsible se `anamnesis` existir.
   - Selo de validade com `valid_until` formatado pt-BR (`page.tsx:460-470`).

## 9. Observações (notas para Fase B — não auditar agora)

- **Validação fraca da anamnese na API:** `route.ts:20` apenas checa presença de chaves; não há schema Zod para o payload de anamnese (28+ campos chegam como `Record<string, unknown>`). Risco de gravar dados malformados em `jsonb`.
- **Cast `as unknown as any`:** em `actions.ts:483` no `update(...)`. TODO: tipar corretamente.
- **`workout_plan` modelo só usa `weeks[0]`:** o `PlanEditor` sempre escreve `{ weeks: [{ name: "Semana 1", days }] }` (`plan-editor.tsx:699`) e o renderer itera `workoutPlan.weeks` (`page.tsx:311`), mas não há UI para múltiplas semanas — esquema preparado, feature stub.
- **Sem expiração automática:** `status: "expired"` existe no enum mas nenhum job/cron observado dentro do escopo move consultorias vencidas (`valid_until` no passado) para esse estado.
- **Templates hardcoded duplicados em DB:** `plan-editor.tsx:167-373` mantém cinco templates de treino + dietas hardcoded como fallback enquanto `plan_templates` na DB já é consultada (`[id]/page.tsx:34-46`). TODO: migrar tudo para DB.
- **Mismatch de campos anamnese:** `AnamneseForm` salva `equipments` (plural) e `mealFrequency` (`anamnese-form.tsx:225, 229`) enquanto `AnamneseViewer`/`AnamneseSummary` esperam `equipment` (singular) e `mealsPerDay` (`anamnese-viewer.tsx:28, 31`; `anamnese-summary.tsx:32, 34`). Possível bug latente ao exibir alguns campos.
- **`getActivityMultiplier` com strings inconsistentes:** espera `"Sedentário"`, `"Leve"`, `"Moderado"`, `"Intenso"`, `"Muito intenso"` (`plan-editor.tsx:88-92`), mas `trainingLevels` no formulário usa `"Nunca treinei"`, `"Iniciante < 6 meses"`, etc. (`anamnese-form.tsx:28-34`). O fallback recai sempre em `1.55`.

## 10. Referências

- **Arquivos-chave:**
  - `src/app/(app)/consultoria/page.tsx:30` — hub do assinante (4 estados conforme `status`).
  - `src/app/(app)/consultoria/exercise-card.tsx:35` — card de exercício com player YouTube.
  - `src/app/(app)/consultoria/anamnese-summary.tsx:1` — resumo da anamnese collapsible.
  - `src/app/(app)/consultoria/anamnese/page.tsx:9` — wrapper da anamnese.
  - `src/app/(app)/consultoria/anamnese/anamnese-form.tsx:72` — formulário 7 steps (1145 linhas).
  - `src/app/api/consultoria/anamnese/route.ts:11` — POST anamnese.
  - `src/app/admin/consultorias/page.tsx:7` — fila admin.
  - `src/app/admin/consultorias/consultation-form.tsx:21` — modal criação.
  - `src/app/admin/consultorias/consultation-queue.tsx:42` — tabela com filtros.
  - `src/app/admin/consultorias/[id]/page.tsx:23` — detalhe + editor.
  - `src/app/admin/consultorias/[id]/plan-editor.tsx:135` — editor de plano (1002 linhas).
  - `src/app/admin/consultorias/[id]/anamnese-viewer.tsx:1` — viewer admin.
  - `src/app/admin/actions.ts:456-561` — Server Actions de consultoria.
  - `src/lib/validations.ts:71-80` — `updateConsultationSchema`.

- **Migrations:**
  - `supabase/schema.sql:125-173` — definição original de `consultations` + RLS.
  - `supabase/schema.sql:555-570` — índices.
  - `supabase/migration_consultations_inapp.sql` — drop de `workout_plan_url`/`diet_plan_url`, add de `workout_plan`/`diet_plan` (jsonb), `daily_calories`/`protein`/`carbs`/`fat`.
  - `supabase/migrations/20260101000000_initial_schema.sql` — versão consolidada (referência cruzada — out-of-scope).

- **Setores cruzados:**
  - `../plataforma/auth-clerk.md` — autenticação `auth()` usada nas pages e na API route.
  - `../plataforma/supabase.md` — `createServerSupabaseClient`/`createAdminSupabaseClient`, RLS global, types `Json`.
  - `../plataforma/pagamentos-asaas.md` — webhook que auto-cria consultoria VIP em `src/app/api/webhook/asaas/route.ts:107-149`.
  - `../plataforma/push-notifications.md` — `notifyUser` em `src/lib/notifications.ts` chamado em criação, entrega e webhook.
  - `./templates.md` (ou similar) — tabela `plan_templates` consumida em `[id]/page.tsx:34-46` (templates de treino/dieta reutilizáveis).
  - `./planos.md` (ou similar) — `profiles.plan_tier` (free/vip) consultado em `consultoria/page.tsx:34-40` para gating do CTA.
  - `../dominio/admin.md` — `requireAdmin()` e layout admin em `src/app/admin/layout.tsx`.
