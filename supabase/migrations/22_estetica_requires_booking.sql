-- ============================================================================
-- 22. KATH ESTÉTICA — Flag requires_booking nos serviços
-- ============================================================================
-- Lavagem Simples não precisa de agendamento — é walk-in only (cliente
-- chega na loja, admin registra via /admin/kath-estetica/atendimento).
-- Lavagem Detalhada e Vitrificação continuam exigindo agendamento via app
-- ou via loja (admin pode criar booking pelo admin).
--
-- Em vez de remover a Lavagem Simples do catálogo de bookings, adicionamos
-- uma flag para a UI decidir o que mostrar.
-- ============================================================================

alter table public.estetica_services
  add column if not exists requires_booking boolean not null default true;

-- Lavagem simples vira walk-in only
update public.estetica_services
   set requires_booking = false
 where slug = 'lavagem-simples';

create index if not exists idx_estetica_services_requires_booking
  on public.estetica_services(requires_booking) where is_active = true;
