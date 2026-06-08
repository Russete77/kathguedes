-- 54_exercise_per_video.sql
-- Um exercício por VÍDEO (não por nome).
--
-- Problema: dois vídeos do mesmo movimento em níveis diferentes (ex.: "Cadeira
-- Extensora - 03" iniciante e intermediário) têm o MESMO título. Como
-- exercises.name era UNIQUE, só o primeiro virava exercício e o segundo era
-- pulado — por isso a biblioteca tinha mais vídeos que o catálogo.
--
-- Solução: nome deixa de ser único; o catálogo passa a ter 1 exercício por
-- vídeo (workout_video_id), e ganha a coluna `level` (vinda do vídeo) pra
-- diferenciar os homônimos no admin e no seletor da consultoria.
--
-- Aplicar DEPOIS da migration 53.

begin;

-- 1. Nome deixa de ser único.
alter table public.exercises drop constraint if exists exercises_name_key;

-- 2. Nível no catálogo (espelha workout_videos.level).
alter table public.exercises add column if not exists level text;

-- 3. Popula o nível dos exercícios já vinculados a um vídeo.
update public.exercises e
   set level = w.level
  from public.workout_videos w
 where e.workout_video_id = w.id
   and e.level is distinct from w.level;

-- 4. Cria exercício para todo vídeo publicado de GRUPAMENTO que ainda não tem
--    (inclui os homônimos por nível que antes eram pulados).
insert into public.exercises
  (name, primary_category, level, workout_video_id, is_active)
select w.title, w.category, w.level, w.id, true
from public.workout_videos w
where w.is_published = true
  and w.category not in (
    'full','hiit','cardio','funcional','alongamento','aquecimento','viagem','competicao'
  )
  and not exists (
    select 1 from public.exercises e where e.workout_video_id = w.id
  );

commit;
