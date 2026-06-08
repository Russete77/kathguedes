-- ============================================================================
-- MIGRATION 43: plans_cycles — modelo semestral/anual (fim do mensal)
-- ============================================================================
--
-- Decisão de produto (Kath, 29/05/26): acabar com cobrança mensal. Agora cada
-- plano é cobrado SÓ em ciclo semestral (6 meses à vista) ou anual (12 meses à
-- vista), com preço/mês menor. Mantém os 4 tiers atuais (start/evolucao/
-- saude_completa/atleta) — só muda como o preço é cobrado.
--
-- Preços (valor cheio à vista por ciclo) — total = preço/mês × meses:
--   Tier             /mês sem.  total sem.   /mês anual  total anual
--   start (Treino)    31,90      191,40       25,90        310,80
--   evolucao (Perf.)  59,90      359,40       49,90        598,80
--   saude_completa    79,90      479,40       64,90        778,80
--   atleta           249,90    1.499,40      199,90      2.398,80
--
-- Pagamento (definição de produto):
--   - PIX/BOLETO  → assinatura recorrente Asaas (cycle SEMIANNUALLY/YEARLY),
--                   valor cheio à vista a cada ciclo, renova sozinho.
--   - CARTÃO      → cobrança parcelada (installmentCount 6/12), NÃO recorrente.
--
-- Reset: app em produção-teste, sem público. Zera as assinaturas de teste.
-- ============================================================================

begin;

-- ── 0. Desabilita guard de colunas sensíveis (igual migration 31) ──
-- trg_guard_profile_sensitive bloqueia UPDATE de plan_tier/subscription_status
-- fora de service_role. O SQL Editor roda como supabase_admin e bate na trava.
alter table public.profiles disable trigger trg_guard_profile_sensitive;

-- ── 1. Novas colunas de preço por ciclo na tabela plans ──
-- Guardamos o /mês (display) e o total à vista (cobrança real) em centavos,
-- mais o valor numérico em reais que vai direto pro Asaas.
alter table public.plans
  add column if not exists monthly_semestral_cents int,
  add column if not exists total_semestral_cents   int,
  add column if not exists monthly_anual_cents      int,
  add column if not exists total_anual_cents        int,
  add column if not exists asaas_value_semestral    numeric(10,2),
  add column if not exists asaas_value_anual         numeric(10,2);

-- ── 2. Preços por tier ──
update public.plans set
  monthly_semestral_cents = 3190,  total_semestral_cents = 19140,
  monthly_anual_cents     = 2590,  total_anual_cents     = 31080,
  asaas_value_semestral   = 191.40, asaas_value_anual     = 310.80,
  price_cents = 2590, asaas_value = 25.90
where slug = 'start';

update public.plans set
  monthly_semestral_cents = 5990,  total_semestral_cents = 35940,
  monthly_anual_cents     = 4990,  total_anual_cents     = 59880,
  asaas_value_semestral   = 359.40, asaas_value_anual     = 598.80,
  price_cents = 4990, asaas_value = 49.90
where slug = 'evolucao';

update public.plans set
  monthly_semestral_cents = 7990,  total_semestral_cents = 47940,
  monthly_anual_cents     = 6490,  total_anual_cents     = 77880,
  asaas_value_semestral   = 479.40, asaas_value_anual     = 778.80,
  price_cents = 6490, asaas_value = 64.90
where slug = 'saude_completa';

update public.plans set
  monthly_semestral_cents = 24990, total_semestral_cents = 149940,
  monthly_anual_cents     = 19990, total_anual_cents     = 239880,
  asaas_value_semestral   = 1499.40, asaas_value_anual    = 2398.80,
  price_cents = 19990, asaas_value = 199.90
where slug = 'atleta';

-- ── 3. NOT NULL nas colunas de ciclo (após preencher) ──
alter table public.plans
  alter column monthly_semestral_cents set not null,
  alter column total_semestral_cents   set not null,
  alter column monthly_anual_cents      set not null,
  alter column total_anual_cents        set not null,
  alter column asaas_value_semestral    set not null,
  alter column asaas_value_anual         set not null;

-- ── 4. profiles: ciclo de cobrança da assinatura ativa ──
alter table public.profiles
  add column if not exists billing_cycle text
    check (billing_cycle in ('semestral', 'anual'));

-- ── 5. Reset das assinaturas de teste ──
-- Mantém as contas; zera assinatura para todos reassinarem no novo modelo.
update public.profiles set
  plan_tier            = 'start',
  subscription_status  = 'canceled',
  subscription_ends_at = null,
  billing_cycle        = null,
  asaas_subscription_id = null
where subscription_status <> 'canceled'
   or asaas_subscription_id is not null;

-- ── 6. Reabilita o guard ──
alter table public.profiles enable trigger trg_guard_profile_sensitive;

commit;
