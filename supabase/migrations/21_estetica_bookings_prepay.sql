-- ============================================================================
-- 21. KATH ESTÉTICA — Suporte a sinal (prepay) e tipo de moto em bookings
-- ============================================================================
-- Necessário para o fluxo de agendamento via app integrar com a matriz de
-- preços (migration 20) e com as regras de pagamento, em particular a
-- vitrificação que exige sinal de 50% via Asaas + restante presencial.
--
-- Convenção semântica das colunas:
--   prepay_cents = quanto o cliente paga via app (Asaas). 0 = sem sinal.
--   remaining_cents = quanto resta cobrar presencialmente. 0 quando quitado.
--   prepay_paid_at = quando o webhook confirmou o sinal.
--   paid_at = quando a quitação TOTAL aconteceu (sinal == total OR admin
--             marcou done com remaining = 0).
--
-- Todas as colunas têm default 0 / null para não invalidar bookings existentes.
-- ============================================================================

alter table public.estetica_bookings
  add column if not exists vehicle_type_id uuid references public.estetica_vehicle_types(id) on delete set null;

alter table public.estetica_bookings
  add column if not exists prepay_cents int not null default 0 check (prepay_cents >= 0);

alter table public.estetica_bookings
  add column if not exists remaining_cents int not null default 0 check (remaining_cents >= 0);

alter table public.estetica_bookings
  add column if not exists prepay_paid_at timestamptz;

create index if not exists idx_estetica_bookings_vehicle_type
  on public.estetica_bookings(vehicle_type_id) where vehicle_type_id is not null;

create index if not exists idx_estetica_bookings_prepay_pending
  on public.estetica_bookings(user_id, prepay_paid_at)
  where prepay_cents > 0 and prepay_paid_at is null;

-- Backfill: bookings existentes têm prepay_cents = 0 e remaining_cents = 0.
-- Quando o pagamento histórico (paid_at not null) cobre integral, está OK.
-- Para bookings antigas em status 'pending' com total_cents > 0, deixamos
-- remaining_cents zerado — o admin sabe pelo histórico que o valor segue na
-- coluna total_cents. Não vale tocar em produção via UPDATE em massa.
