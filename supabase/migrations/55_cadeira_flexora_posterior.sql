-- 55_cadeira_flexora_posterior.sql
-- "Cadeira Flexora" é trabalho de POSTERIOR de coxa (hamstrings). Estava
-- categorizada como 'inferior' (genérico) e por isso não aparecia na aba
-- "Posterior de coxa". Recategoriza o(s) vídeo(s) e o(s) exercício(s).
--
-- (Continua aparecendo em "Inferiores" também, pois posterior está no
--  guarda-chuva de inferiores.)

begin;

update public.workout_videos
   set category = 'posterior'
 where title ilike 'cadeira flexora%'
   and category = 'inferior';

update public.exercises
   set primary_category = 'posterior'
 where name ilike 'cadeira flexora%'
   and primary_category = 'inferior';

commit;
