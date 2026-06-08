-- 59_exercise_equipment.sql
-- Pré-preenche o equipamento dos exercícios pelos termos EXPLÍCITOS no título.
-- Conservador: só marca quando o nome deixa claro. Os ambíguos (ex.: Rosca
-- Bíceps, Búlgaro, Afundo, Elevação Pélvica) ficam vazios pra Sidney marcar no
-- admin (/admin/exercises), porque o nome não revela o equipamento com certeza.
--
-- Ordem: do mais genérico pro mais específico (a última regra que casar vence).

begin;

-- Máquinas dedicadas
update public.exercises set equipment = array['máquina']
 where name ilike '%máquina%' or name ilike '%maquina%'
    or name ilike '%cadeira%' or name ilike '%leg press%'
    or name ilike '%mesa flexora%' or name ilike '%hack%'
    or name ilike '%voador%' or name ilike '%remador%';

-- Polia / cabo
update public.exercises set equipment = array['polia']
 where name ilike '%cabo%' or name ilike '%corda%'
    or name ilike '%crossover%' or name ilike '%pulldown%'
    or name ilike '%pull down%' or name ilike '%puxada%'
    or name ilike '%face pull%' or name ilike '%facepull%';

-- Halteres
update public.exercises set equipment = array['halteres']
 where name ilike '%halteres%' or name ilike '%alteres%'
    or name ilike '%martelo%' or name ilike '%arnold%'
    or name ilike '%coice%';

-- Smith (sobrepõe os anteriores quando o título cita Smith)
update public.exercises set equipment = array['smith']
 where name ilike '%smith%';

-- Barra
update public.exercises set equipment = array['barra']
 where name ilike '%barra%' or name ilike '%supino reto%'
    or name ilike '%stiff%';

-- Peso corporal
update public.exercises set equipment = array['peso corporal']
 where name ilike '%paralelas%';

commit;
