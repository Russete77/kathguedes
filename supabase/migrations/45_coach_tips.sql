-- ============================================================================
-- MIGRATION 45: coach_tips — dicas do profissional no vídeo
-- ============================================================================
--
-- Guarda as "dicas da Kath" de cada vídeo da biblioteca: o texto que ela fala
-- durante a execução ("na subida contrai o glúteo", "não trava o joelho"...),
-- pra complementar os detalhes do exercício e aparecer pro aluno.
--
-- Origem (coach_tips_source):
--   'caption' → extraído automaticamente da legenda do YouTube e resumido por IA
--   'whisper' → transcrito do áudio por STT (evolução futura)
--   'manual'  → digitado/editado à mão no admin (rede de segurança, sempre confiável)
--
-- workout_videos é a fonte única; o aluno vê via join por youtube_id, então as
-- dicas ficam sempre frescas mesmo em planos já entregues.
-- ============================================================================

begin;

alter table public.workout_videos
  add column if not exists coach_tips             text,
  add column if not exists coach_tips_source      text,
  add column if not exists coach_tips_updated_at  timestamptz;

alter table public.workout_videos
  drop constraint if exists workout_videos_coach_tips_source_check;

alter table public.workout_videos
  add constraint workout_videos_coach_tips_source_check
  check (coach_tips_source is null or coach_tips_source in ('caption', 'whisper', 'manual'));

commit;
