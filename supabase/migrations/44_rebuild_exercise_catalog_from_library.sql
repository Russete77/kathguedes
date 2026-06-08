-- ============================================================================
-- MIGRATION 44: Reconstruir o catálogo de exercícios a partir da Biblioteca
-- ============================================================================
--
-- Decisão de produto (Kath, 2026-06): a BIBLIOTECA DE VÍDEOS (workout_videos) é
-- a FONTE ÚNICA do catálogo de exercícios. Cada vídeo publicado vira UM
-- exercício, já vinculado (workout_video_id), com nome = título do vídeo e
-- categoria = categoria do vídeo. Assim:
--   - todo exercício escolhido num plano já traz o vídeo de execução (resolve os
--     pontos 1 e 6: "aluno não acessa vídeo" / "página de exercícios sem vídeo");
--   - os grupamentos refletem exatamente como os vídeos foram categorizados
--     (resolve 2/3/4: quadríceps/posterior/superior/Stiff no lugar certo);
--   - não existe "Full Body" no catálogo a menos que haja vídeo de full body (5).
--
-- Os ~48 exercícios do SEED (migration 34) eram placeholders SEM vídeo. Este
-- script os APAGA (hard delete, conforme decidido) e cria o catálogo do zero a
-- partir dos vídeos publicados.
--
-- SEGURANÇA: planos antigos (consultations.workout_plan / plan_templates) guardam
-- nome/séries/reps INLINE no JSONB — apagar linhas de `exercises` NÃO quebra
-- nenhum plano já montado. O campo exercise_id no JSONB é só rastreabilidade.
--
-- A sincronização CONTÍNUA (publicar/editar/despublicar/apagar vídeo mantém o
-- exercício em dia) é feita em código: src/app/admin/actions.ts →
-- syncExerciseForWorkout(). Este script é o BACKFILL inicial.
--
-- COMO RODAR: cole no SQL Editor do projeto kathapp (auplhaxwaecsppqizxej) e
-- execute. É idempotente — pode rodar de novo sem duplicar.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- PARTE 0 — DIAGNÓSTICO (rode primeiro, só leitura, pra conferir o cenário)
-- ────────────────────────────────────────────────────────────────────────────
-- Quantos exercícios existem hoje, quantos têm vídeo, e quantos vídeos publicados:
select
  (select count(*) from public.exercises)                                          as exercicios_total,
  (select count(*) from public.exercises where workout_video_id is not null)       as exercicios_com_video,
  (select count(*) from public.exercises where workout_video_id is null)           as exercicios_sem_video_serao_apagados,
  (select count(*) from public.workout_videos where is_published)                  as videos_publicados;

-- Prévia: quais vídeos publicados ainda NÃO têm exercício e serão criados:
select wv.id, wv.title, wv.category
from public.workout_videos wv
where wv.is_published
  and not exists (
    select 1 from public.exercises e where e.workout_video_id = wv.id
  )
order by wv.category, wv.title;

-- TÍTULOS DUPLICADOS entre vídeos publicados: cada título vira UM exercício
-- (nome é único). Os vídeos extras com o mesmo título ficam SEM exercício.
-- Se quiser que cada um seja um exercício separado, renomeie os títulos antes.
select lower(btrim(title)) as titulo, count(*) as qtd_videos,
       array_agg(id) as video_ids
from public.workout_videos
where is_published
group by lower(btrim(title))
having count(*) > 1
order by qtd_videos desc, titulo;


-- ────────────────────────────────────────────────────────────────────────────
-- PARTE 1 + 2 — LIMPEZA E RECONSTRUÇÃO (transação única)
-- ────────────────────────────────────────────────────────────────────────────
begin;

-- 1) Apaga TODOS os exercícios sem vídeo vinculado (os placeholders do seed).
--    Mantém intactos os que já estavam corretamente vinculados a um vídeo.
delete from public.exercises
where workout_video_id is null;

-- 2) Cria um exercício para cada VÍDEO PUBLICADO que ainda não tem um.
--    Nome = título do vídeo · categoria = categoria do vídeo · já vinculado.
--    Defaults conservadores (3×10-12, 60s) — a Kath refina depois se quiser.
--
--    IMPORTANTE: como `exercises.name` é UNIQUE e pode haver VÍDEOS PUBLICADOS
--    COM TÍTULO REPETIDO, desduplicamos por título (DISTINCT ON) — escolhemos
--    1 vídeo por título (o de menor sort_order / mais antigo). Sem isso, o
--    INSERT tentaria gravar dois exercícios com o mesmo nome e o Postgres
--    aborta com "ON CONFLICT DO UPDATE command cannot affect row a second time".
--    Vídeos com título duplicado que ficarem de fora aparecem na PARTE 0.
insert into public.exercises
  (name, primary_category, secondary_groups, equipment,
   default_sets, default_reps, default_rest, workout_video_id, is_active, sort_order)
select distinct on (wv.title)
  wv.title,
  wv.category,
  '{}'::text[],
  '{}'::text[],
  3,
  '10-12',
  60,
  wv.id,
  true,
  coalesce(wv.sort_order, 0)
from public.workout_videos wv
where wv.is_published
  and not exists (
    select 1 from public.exercises e where e.workout_video_id = wv.id
  )
order by wv.title, coalesce(wv.sort_order, 0), wv.id
on conflict (name) do update
  set workout_video_id = excluded.workout_video_id,
      primary_category = excluded.primary_category,
      is_active        = true;

-- 3) Garante que exercícios vinculados a vídeos DESPUBLICADOS fiquem inativos
--    (não aparecem nos pickers, mas o registro é preservado).
update public.exercises e
set is_active = false
from public.workout_videos wv
where e.workout_video_id = wv.id
  and wv.is_published = false
  and e.is_active = true;

commit;


-- ────────────────────────────────────────────────────────────────────────────
-- PARTE 3 — (OPCIONAL) Backfill de vídeo nos PLANOS JÁ ENTREGUES
-- ────────────────────────────────────────────────────────────────────────────
-- Planos de consultoria já entregues guardam os exercícios com youtube_id vazio.
-- Este bloco percorre consultations.workout_plan e, para cada exercício SEM
-- youtube_id, tenta achar um vídeo da biblioteca cujo título BATE com o nome do
-- exercício (igual, ignorando caixa) e preenche o youtube_id. Conservador: só
-- preenche em correspondência forte, nunca sobrescreve um youtube_id existente.
--
-- Rode separadamente, depois de conferir a PARTE 0. Se não quiser mexer em
-- planos antigos, simplesmente NÃO rode este bloco.
do $$
declare
  c            record;
  plan         jsonb;
  new_weeks    jsonb := '[]'::jsonb;
  wk           jsonb;
  new_days     jsonb;
  dy           jsonb;
  new_exs      jsonb;
  ex           jsonb;
  vid          text;
  touched      boolean;
begin
  for c in
    select id, workout_plan
    from public.consultations
    where workout_plan is not null
      and jsonb_typeof(workout_plan->'weeks') = 'array'
  loop
    plan := c.workout_plan;
    new_weeks := '[]'::jsonb;
    touched := false;

    for wk in select * from jsonb_array_elements(plan->'weeks')
    loop
      new_days := '[]'::jsonb;
      for dy in select * from jsonb_array_elements(coalesce(wk->'days', '[]'::jsonb))
      loop
        new_exs := '[]'::jsonb;
        for ex in select * from jsonb_array_elements(coalesce(dy->'exercises', '[]'::jsonb))
        loop
          -- Só tenta se não houver youtube_id preenchido e houver nome.
          if coalesce(ex->>'youtube_id', '') = '' and coalesce(ex->>'name', '') <> '' then
            select wv.youtube_id into vid
            from public.workout_videos wv
            where wv.is_published
              and lower(btrim(wv.title)) = lower(btrim(ex->>'name'))
            limit 1;
            if vid is not null then
              ex := jsonb_set(ex, '{youtube_id}', to_jsonb(vid), true);
              touched := true;
            end if;
          end if;
          new_exs := new_exs || ex;
        end loop;
        new_days := new_days || jsonb_set(dy, '{exercises}', new_exs, true);
      end loop;
      new_weeks := new_weeks || jsonb_set(wk, '{days}', new_days, true);
    end loop;

    if touched then
      update public.consultations
      set workout_plan = jsonb_set(plan, '{weeks}', new_weeks, true)
      where id = c.id;
    end if;
  end loop;
end $$;


-- ────────────────────────────────────────────────────────────────────────────
-- PARTE 4 — VERIFICAÇÃO (rode no fim, só leitura)
-- ────────────────────────────────────────────────────────────────────────────
-- Todo exercício ativo deve ter vídeo; contagem por grupamento:
select primary_category, count(*) as qtd
from public.exercises
where is_active = true
group by primary_category
order by qtd desc;

-- Sanidade: nenhum exercício ATIVO pode estar sem vídeo (deve voltar 0 linhas):
select id, name
from public.exercises
where is_active = true and workout_video_id is null;
