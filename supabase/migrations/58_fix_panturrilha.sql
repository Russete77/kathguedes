-- 58_fix_panturrilha.sql
-- Limpeza do "Panturilha - 04": corrige o typo do título (faltava um R) e remove
-- o secundário redundante ['panturrilha'] (igual à categoria primária).

begin;

update public.workout_videos set title = 'Panturrilha - 04'
 where title = 'Panturilha - 04';

update public.exercises set name = 'Panturrilha - 04'
 where name = 'Panturilha - 04';

-- tira secundário igual à primária (qualquer caso, não só panturrilha)
update public.exercises
   set secondary_groups = array_remove(secondary_groups, primary_category)
 where primary_category = any(secondary_groups);

commit;
