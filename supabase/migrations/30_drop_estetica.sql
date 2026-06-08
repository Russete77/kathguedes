-- ============================================
-- MIGRATION 30: drop_estetica
-- ============================================
--
-- Remove TUDO de estética do schema do app fitness (kathapp).
-- Estética virou app próprio (repo kath-estetica) com Supabase próprio.
--
-- Histórico de origem: migrations 19, 20, 21, 22, 24, 27.
-- Snapshot do estado anterior: tag git `v2.0-before-split` (commit ff66e1a).
--
-- IRREVERSÍVEL. Se precisar restaurar, ver branch git archive/full-app-pre-split.
-- ============================================

begin;

-- ============================================
-- 1. Drop RLS policies em storage.objects (buckets estética)
-- ============================================
drop policy if exists estetica_portfolio_read_public on storage.objects;
drop policy if exists estetica_portfolio_write_admin on storage.objects;
drop policy if exists estetica_portfolio_update_admin on storage.objects;
drop policy if exists estetica_portfolio_delete_admin on storage.objects;
drop policy if exists estetica_loyalty_read_own on storage.objects;
drop policy if exists estetica_loyalty_insert_own on storage.objects;
drop policy if exists estetica_loyalty_delete_own on storage.objects;
drop policy if exists estetica_loyalty_admin on storage.objects;
drop policy if exists moto_photos_read_admin on storage.objects;
drop policy if exists moto_photos_write_admin on storage.objects;
drop policy if exists plate_photos_read_admin on storage.objects;
drop policy if exists plate_photos_write_admin on storage.objects;

-- ============================================
-- 2. Storage buckets — DELETAR MANUALMENTE
-- ============================================
-- Supabase tem trigger `storage.protect_delete` que bloqueia DELETE direto
-- em storage.objects/storage.buckets (forca uso da Storage API).
-- Como estetica nunca foi pra producao, os buckets devem estar vazios.
--
-- Apos rodar esta migration, va no Supabase Dashboard > Storage e delete
-- manualmente os 4 buckets (com confirmacao):
--   - estetica-portfolio
--   - estetica-loyalty
--   - moto-photos
--   - plate-photos
--
-- Ou via supabase-js (em um script Node fora desta migration):
--   await supabase.storage.emptyBucket('estetica-portfolio')
--   await supabase.storage.deleteBucket('estetica-portfolio')
--   (repetir para os outros 3)

-- ============================================
-- 3. Drop RPCs específicas de estética
-- ============================================
drop function if exists public.check_loyalty_eligibility(text);
drop function if exists public.check_loyalty_eligibility(uuid);
drop function if exists public.get_available_slots(date, int);
drop function if exists public.get_available_slots(date, integer);

-- ============================================
-- 4. Drop tabelas estetica_* (CASCADE pra triggers, FKs e dependências)
-- Ordem: filhas antes de mães onde possível, CASCADE limpa o resto.
-- ============================================
drop table if exists public.estetica_loyalty_photos cascade;
drop table if exists public.estetica_walkin_services cascade;
drop table if exists public.estetica_bookings cascade;
drop table if exists public.estetica_portfolio cascade;
drop table if exists public.estetica_service_prices cascade;
drop table if exists public.estetica_payment_rules cascade;
drop table if exists public.estetica_services cascade;
drop table if exists public.estetica_vehicles cascade;
drop table if exists public.estetica_customers cascade;
drop table if exists public.estetica_vehicle_types cascade;
drop table if exists public.estetica_slots_blocked cascade;
drop table if exists public.estetica_schedule cascade;

-- ============================================
-- 5. plans: dropar coluna estetica_discount_pct + remover chave estetica_book_all do JSONB features
-- ============================================
alter table public.plans drop column if exists estetica_discount_pct;
update public.plans set features = features - 'estetica_book_all' where features ? 'estetica_book_all';

-- ============================================
-- 6. revenue_streams: remover 'estetica' do CHECK de type
-- Estratégia: drop e recria a constraint sem 'estetica'.
-- Pré: já não deve existir nenhum row com type='estetica' (estetica não foi em prod).
-- ============================================
do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.revenue_streams where type = 'estetica';
  if v_count > 0 then
    raise exception 'revenue_streams tem % rows com type=estetica — apague/migre antes de aplicar', v_count;
  end if;
end $$;

alter table public.revenue_streams drop constraint if exists revenue_streams_type_check;
alter table public.revenue_streams add constraint revenue_streams_type_check
  check (type in ('mensalidade','loja','afiliado_externo'));

-- Também o reference_type — remover 'booking' (só estética usava)
do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.revenue_streams where reference_type = 'booking';
  if v_count > 0 then
    raise exception 'revenue_streams tem % rows com reference_type=booking — apague/migre antes', v_count;
  end if;
end $$;

alter table public.revenue_streams drop constraint if exists revenue_streams_reference_type_check;
alter table public.revenue_streams add constraint revenue_streams_reference_type_check
  check (reference_type in ('subscription','order','affiliate_payout'));

-- ============================================
-- 7. commission_rules: remover 'estetica' do CHECK de applies_to_type
-- ============================================
alter table public.commission_rules drop constraint if exists commission_rules_applies_to_type_check;
alter table public.commission_rules add constraint commission_rules_applies_to_type_check
  check (applies_to_type is null or applies_to_type in ('mensalidade','loja','afiliado_externo'));

-- E remover quaisquer rules existentes que apontem pra 'estetica'
delete from public.commission_rules where applies_to_type = 'estetica';

-- ============================================
-- 8. coupons: remover 'moto' do CHECK de module
-- ============================================
do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.coupons where module = 'moto';
  if v_count > 0 then
    raise notice 'coupons tem % rows com module=moto — convertendo para geral', v_count;
    update public.coupons set module = 'geral' where module = 'moto';
  end if;
end $$;

alter table public.coupons drop constraint if exists coupons_module_check;
alter table public.coupons add constraint coupons_module_check
  check (module in ('fitness','geral'));

-- ============================================
-- 9. products: remover 'moto' do CHECK de module
-- ============================================
do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.products where module = 'moto';
  if v_count > 0 then
    raise notice 'products tem % rows com module=moto — convertendo para geral', v_count;
    update public.products set module = 'geral' where module = 'moto';
  end if;
end $$;

alter table public.products drop constraint if exists products_module_check;
alter table public.products add constraint products_module_check
  check (module in ('fitness','geral'));

-- ============================================
-- 10. affiliate_links: remover 'moto' do CHECK de module (se houver)
-- ============================================
do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.affiliate_links where module = 'moto';
  if v_count > 0 then
    raise notice 'affiliate_links tem % rows com module=moto — apagando', v_count;
    delete from public.affiliate_links where module = 'moto';
  end if;
end $$;

alter table public.affiliate_links drop constraint if exists affiliate_links_module_check;
alter table public.affiliate_links add constraint affiliate_links_module_check
  check (module in ('fitness'));

commit;
