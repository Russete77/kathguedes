-- 57_exercise_secondary_groups.sql
-- Preenche os grupos secundários (subcategorias) dos exercícios compostos, pra
-- aparecerem em mais de uma aba de músculo (ex.: Leg Press em Quadríceps E
-- Glúteo). NÃO altera a categoria primária nem a divisão Inferior/Superior.
-- Exercícios isolados (rosca, elevação lateral, crossover, panturrilha, cadeira
-- extensora/flexora/abdutora, abdominal) ficam sem secundário (uniarticulares).

begin;

-- ── Inferiores compostos ──
update public.exercises set secondary_groups = array['gluteo']
 where primary_category = 'quadriceps'
   and (name ilike 'agachamento%' or name ilike 'leg press%'
        or name ilike 'afundo%' or name ilike 'passada%');

update public.exercises set secondary_groups = array['quadriceps']
 where name ilike 'búlgaro%' or name ilike 'bulgaro%';

update public.exercises set secondary_groups = array['posterior']
 where name ilike 'elevação pélvica%' or name ilike 'elevacao pelvica%';

update public.exercises set secondary_groups = array['gluteo']
 where name ilike 'stiff%';

-- ── Superiores compostos ──
update public.exercises set secondary_groups = array['biceps']
 where primary_category = 'costas'
   and (name ilike 'remada%' or name ilike 'puxada%'
        or name ilike 'pulldown%' or name ilike 'pull down%'
        or name ilike 'serrote%');

update public.exercises set secondary_groups = array['ombro']
 where name ilike 'face pull%' or name ilike 'facepull%';

update public.exercises set secondary_groups = array['triceps','ombro']
 where name ilike 'supino%';

update public.exercises set secondary_groups = array['triceps']
 where name ilike 'desenvolvimento%';

update public.exercises set secondary_groups = array['peito']
 where name ilike 'paralelas%';

update public.exercises set secondary_groups = array['costas']
 where name ilike 'crucífixo invertido%' or name ilike 'crucifixo invertido%'
    or name ilike 'voador invertido%';

commit;
