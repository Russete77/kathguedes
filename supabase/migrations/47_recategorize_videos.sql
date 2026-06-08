-- ============================================================================
-- MIGRATION 47: recategorizar vídeos mal classificados (inferior/full/superior)
-- ============================================================================
--
-- Redistribui os vídeos que estavam em "inferior" (depósito), "full" e
-- "superior" para os grupamentos musculares corretos. Atualiza a categoria do
-- VÍDEO e re-sincroniza o exercício vinculado (SQL não dispara o sync do app).
--
-- As escolhas abaixo são um ponto de partida sensato — troque o destino de
-- qualquer linha se preferir outro grupamento. Categorias válidas de músculo:
-- gluteo, pernas, quadriceps, posterior, costas, ombro, biceps, triceps,
-- peito, abdomen, superior, inferior.
-- ============================================================================

begin;

-- ── full → músculo ──
update public.workout_videos set category = 'peito'      where id = '769c6693-06de-4c73-8c0f-aeee23dad253'; -- Crossover
update public.workout_videos set category = 'posterior'  where id = '49503e89-3257-4d3f-ac71-3cd9e994e0df'; -- Stiff - 01
update public.workout_videos set category = 'triceps'    where id = '8b1a00ec-b169-4246-8554-111aa7d03e6e'; -- Tríceps Testa + Rosca Martelo (combo de braço)

-- ── inferior → glúteo / quadríceps / posterior / pernas ──
update public.workout_videos set category = 'gluteo'     where id = '7e5a0188-e405-4e1a-9c9c-0226c3237213'; -- Afundo
update public.workout_videos set category = 'quadriceps' where id = '1bef4b76-b33d-4d07-a4dd-493bc0619a8b'; -- Agachamento Guiado
update public.workout_videos set category = 'quadriceps' where id = 'c295209e-d217-4a97-9ee3-49b88d4fd1de'; -- Agachamento na Barra Guiada
update public.workout_videos set category = 'quadriceps' where id = '57665948-0dc1-454a-8b9d-140de7dd7736'; -- Cadeira Extensora (biset)
update public.workout_videos set category = 'gluteo'     where id = '5adfda75-abbf-4b92-803e-2bc54ad82694'; -- Elevação Pélvica
update public.workout_videos set category = 'quadriceps' where id = '05e09d64-4858-418d-b7d3-e91c77fb0e72'; -- Leg Press - 01
update public.workout_videos set category = 'quadriceps' where id = 'f349ceca-c8db-414b-8985-40610df2bec0'; -- Leg Press - 02
update public.workout_videos set category = 'posterior'  where id = '503e791b-d60b-4e36-918f-d959b156ad1d'; -- Mesa Flexora - 02
update public.workout_videos set category = 'posterior'  where id = '3e097fba-bd7f-44ad-9a3f-89871a8f2c34'; -- Mesa Flexora (Drop set)
update public.workout_videos set category = 'pernas'     where id = '0516d7b5-b915-4228-beee-cab8fd17b66d'; -- Panturilha - 04 (sem categoria de panturrilha)
update public.workout_videos set category = 'pernas'     where id = '197c9a3a-4ca5-444a-8828-a27d8572efec'; -- Panturrilha - 04
update public.workout_videos set category = 'gluteo'     where id = 'ae0908b4-4a60-4c68-9939-50fbd5e34110'; -- Passadas (infinitas)
update public.workout_videos set category = 'posterior'  where id = '2a5b34d3-5aa7-4955-960c-0148d7c71ffc'; -- Stiff - 02

-- ── superior → costas / tríceps ──
update public.workout_videos set category = 'triceps'    where id = '36ec1a73-3366-4824-8f8d-61aba9a8af30'; -- Paralelas (dips; troque p/ 'peito' se preferir)
update public.workout_videos set category = 'costas'     where id = '800e5591-ca85-41be-9b09-ddf6ecc004f3'; -- Puxada Frontal - 01
update public.workout_videos set category = 'costas'     where id = '0bc96e42-3373-48f3-ac65-ad1c8973d197'; -- Puxada Frontal - 01 (duplicado — renomeie p/ "- 02")
update public.workout_videos set category = 'costas'     where id = '8b314ffe-68fd-4f87-880f-49210328c21e'; -- Remada Articulada
update public.workout_videos set category = 'costas'     where id = '43342962-06ca-4c68-990c-888bf1a8a93e'; -- Remada Curvada com Halteres

-- ── Re-sincroniza a categoria dos exercícios a partir do vídeo ──
update public.exercises e
set primary_category = wv.category
from public.workout_videos wv
where e.workout_video_id = wv.id
  and e.primary_category is distinct from wv.category;

commit;


-- ── Verificação (só leitura) ──
select primary_category, count(*) as qtd
from public.exercises
where is_active = true
group by primary_category
order by qtd desc;
