-- 56_fix_inferior_generico.sql
-- Zera os vídeos que estavam na "categoria" genérica 'inferior' — pelo modelo,
-- inferior/superior NÃO são categoria (são divisão derivada do músculo). Cada
-- vídeo passa a ter o músculo específico. Depois disto não há vídeo em
-- 'inferior' nem 'superior'.
--
-- Mapeamento (por id, conforme dump de 2026-06-02):
--   Cadeira Extensora - 03 (iniciante e intermediário) → quadriceps
--   Leg Press - 03                                      → quadriceps
--   Panturilha - 04                                     → panturrilha

begin;

update public.workout_videos set category = 'quadriceps'
 where id in (
   '9b9d5e89-911a-4388-912a-c7f061ebdfd0', -- Cadeira Extensora - 03 (iniciante)
   '334cfa80-9c67-4f68-a3c7-0249e45ea6f4', -- Cadeira Extensora - 03 (intermediário)
   'be2c3824-1ea7-4339-997a-a88a17251bce'  -- Leg Press - 03
 );

update public.workout_videos set category = 'panturrilha'
 where id = '0516d7b5-b915-4228-beee-cab8fd17b66d'; -- Panturilha - 04

-- Re-sincroniza o catálogo de exercícios pela categoria do vídeo.
update public.exercises e
   set primary_category = w.category
  from public.workout_videos w
 where e.workout_video_id = w.id
   and e.primary_category is distinct from w.category;

commit;
