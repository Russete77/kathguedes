-- ============================================================================
-- 27_estetica_no_overlap.sql
--
-- Double-booking (CTO audit 2026-05-22): `get_available_slots` é só checagem de
-- leitura — dois POSTs concorrentes (ou um booking criado pelo admin, que ignora
-- disponibilidade) podem reservar o mesmo horário. A capacidade do estúdio é 1
-- (o RPC considera overlap entre TODOS os serviços), então proibimos no DB
-- qualquer sobreposição temporal entre bookings ativos. O DB passa a ser a fonte
-- de verdade contra colisão; os inserts (user e admin) tratam o 23P01.
--
-- PRÉ-CHECK (rode ANTES; o ADD CONSTRAINT falha se já houver overlaps ativos):
--
--   select a.id, b.id, a.scheduled_at, b.scheduled_at
--   from public.estetica_bookings a
--   join public.estetica_bookings b
--     on a.id < b.id
--    and a.status in ('pending','confirmed','in_progress')
--    and b.status in ('pending','confirmed','in_progress')
--    and tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_min))
--     && tstzrange(b.scheduled_at, b.scheduled_at + make_interval(mins => b.duration_min));
--
-- Se retornar linhas, cancele/reagende uma das colisões antes de prosseguir.
-- Idempotente: drop constraint if exists + add.
-- ============================================================================

alter table public.estetica_bookings
  drop constraint if exists no_overlapping_bookings;

alter table public.estetica_bookings
  add constraint no_overlapping_bookings
  exclude using gist (
    tstzrange(scheduled_at, scheduled_at + make_interval(mins => duration_min)) with &&
  )
  where (status in ('pending', 'confirmed', 'in_progress'));
