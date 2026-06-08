-- ============================================================================
-- Migration: adicionar CPF/CNPJ ao profile (2026-05-12)
-- ============================================================================
-- O Asaas exige `cpfCnpj` no customer para criar cobrancas PIX/boleto/cartao.
-- Coletamos no checkout (primeira vez) e persistimos pra proximas chamadas.
--
-- Idempotente.
-- ============================================================================

begin;

alter table public.profiles
  add column if not exists cpf text;

-- Index opcional para lookups raros por CPF (auditoria, suporte)
create index if not exists idx_profiles_cpf
  on public.profiles(cpf)
  where cpf is not null;

comment on column public.profiles.cpf is
  'CPF (somente digitos) ou CNPJ do usuario, usado em chamadas Asaas. Coletado no checkout.';

commit;
