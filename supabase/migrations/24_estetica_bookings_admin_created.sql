-- ============================================================================
-- 24. KATH ESTÉTICA — Bookings criados pelo admin (sem conta no app)
-- ============================================================================
-- Permite que o admin crie agendamentos para clientes que não têm conta
-- Clerk (ligaram por telefone, WhatsApp, ou apareceram na loja). Dois ajustes:
--
--   1. user_id vira nullable. Cliente sem conta = user_id null + dados
--      desnormalizados em customer_name/customer_phone (que já existiam).
--   2. created_by_admin: Clerk userId do admin que criou. Quando preenchido,
--      sinaliza "agendamento criado pela loja" e libera fluxo offline (sem
--      Asaas, pagamento gerenciado pelo admin).
--
-- Compat: bookings antigos continuam funcionando (user_id preenchido,
-- created_by_admin null = criado pelo cliente via app).
-- ============================================================================

alter table public.estetica_bookings
  alter column user_id drop not null;

alter table public.estetica_bookings
  add column if not exists created_by_admin text;

-- A policy estetica_bookings_select_own usa `(select auth.jwt()->>'sub') = user_id`.
-- Quando user_id é null, a comparação `null = sub` retorna null (não true),
-- então o cliente nunca vê bookings de outros nem os criados pela loja.
-- Apenas o service_role (admin via createAdminSupabaseClient) vê todos.

create index if not exists idx_estetica_bookings_admin_created
  on public.estetica_bookings(created_by_admin, created_at desc)
  where created_by_admin is not null;
