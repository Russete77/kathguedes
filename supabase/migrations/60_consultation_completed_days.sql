-- 60_consultation_completed_days.sql
-- Marca quais dias do plano o aluno já concluiu, pra: (1) mostrar ✓ na página
-- da consultoria e (2) avançar pro próximo dia da sequência programada.
-- Guardamos as chaves dos dias concluídos (ex.: "w0d1" = semana 0, dia 1).

begin;

alter table public.consultations
  add column if not exists completed_days jsonb not null default '[]'::jsonb;

commit;
