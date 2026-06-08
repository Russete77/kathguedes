-- ============================================================================
-- MIGRATION 46: limpar exercícios de categorias de FORMATO + diagnóstico
-- ============================================================================
--
-- Depois do rebuild (migration 44), o catálogo passou a espelhar a biblioteca.
-- Mas vídeos de FORMATO (Full Body, HIIT, Cardio, Funcional, Alongamento…) são
-- treinos inteiros, não exercícios únicos — não deviam virar item do catálogo
-- nem criar aba/grupamento. Esta migration os desativa.
--
-- (O código já foi ajustado: src/constants/categories.ts → isExerciseCategory()
--  e syncExerciseForWorkout() não criam mais exercício pra essas categorias.)
--
-- Depois disso, o ponto que sobra é DADO: seus vídeos estão mal categorizados
-- (posterior=0, quadriceps=1, gluteo=4, inferior=12 como "depósito"). A PARTE B
-- lista os títulos por categoria pra você recategorizar em /admin/treinos — ao
-- salvar a nova categoria do vídeo, o exercício re-sincroniza sozinho.
-- ============================================================================

begin;

-- A) Desativa exercícios de categorias de formato (somem dos pickers/grupamentos).
update public.exercises
set is_active = false
where primary_category in (
    'full', 'hiit', 'cardio', 'funcional',
    'alongamento', 'aquecimento', 'viagem', 'competicao'
  )
  and is_active = true;

commit;


-- ────────────────────────────────────────────────────────────────────────────
-- PARTE B — DIAGNÓSTICO (só leitura): recategorizar os vídeos
-- ────────────────────────────────────────────────────────────────────────────
-- Contagem por categoria depois da limpeza (ativos):
select primary_category, count(*) as qtd
from public.exercises
where is_active = true
group by primary_category
order by qtd desc;

-- Lista os vídeos do "depósito" inferior + os full, pra você redistribuir
-- entre gluteo / quadriceps / posterior / panturrilha etc. (edite em /admin/treinos):
select category, title, id
from public.workout_videos
where is_published
  and category in ('inferior', 'full', 'superior')
order by category, title;

-- (Opcional) TODOS os vídeos publicados por categoria, visão geral:
-- select category, title, id
-- from public.workout_videos
-- where is_published
-- order by category, title;
