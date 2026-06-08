-- ============================================================================
-- MIGRATION 39: workout_likes (like de treino + dúvida via chat)
-- ============================================================================
--
-- Adiciona a feature de "curtir" um treino e a possibilidade do user mandar
-- uma dúvida sobre o treino para o chat VIP. O like é simétrico (1 por user).
--
-- Modelo:
--   workout_likes — (user_id, workout_id) PK + created_at
--   workout_videos.likes_count — counter denormalizado (atualizado via RPC atômico)
--
-- O contador denormalizado evita COUNT(*) toda vez que a UI quiser exibir
-- "X likes" — pattern usado no resto do schema (views_count, clicks_count).
-- ============================================================================

begin;

-- 1. Tabela workout_likes
create table if not exists public.workout_likes (
  user_id    text not null references public.profiles(id) on delete cascade,
  workout_id uuid not null references public.workout_videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, workout_id)
);

create index if not exists idx_workout_likes_workout
  on public.workout_likes (workout_id);

-- 2. Coluna counter no workout_videos
alter table public.workout_videos
  add column if not exists likes_count int not null default 0;

-- 3. RLS
alter table public.workout_likes enable row level security;

drop policy if exists workout_likes_select_own on public.workout_likes;
create policy workout_likes_select_own on public.workout_likes
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists workout_likes_insert_own on public.workout_likes;
create policy workout_likes_insert_own on public.workout_likes
  for insert to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists workout_likes_delete_own on public.workout_likes;
create policy workout_likes_delete_own on public.workout_likes
  for delete to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists workout_likes_admin on public.workout_likes;
create policy workout_likes_admin on public.workout_likes
  for all to service_role using (true) with check (true);

-- 4. RPC atômico toggle_workout_like — retorna o novo estado (liked: boolean) + counter
create or replace function public.toggle_workout_like(p_workout_id uuid)
returns table(liked boolean, likes_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_existed boolean;
  v_count int;
begin
  v_user_id := coalesce(
    (current_setting('request.jwt.claims', true)::jsonb)->>'sub',
    'service_role'
  );
  if v_user_id is null or v_user_id = '' then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  -- Tenta inserir; se já existe, deleta (toggle).
  insert into public.workout_likes (user_id, workout_id)
  values (v_user_id, p_workout_id)
  on conflict (user_id, workout_id) do nothing;

  -- Se inseriu, count vai aumentar. Se não inseriu (já tinha), vamos deletar.
  get diagnostics v_existed = row_count;
  v_existed := not (v_existed > 0); -- v_existed = true se já estava curtido antes do insert

  if v_existed then
    delete from public.workout_likes
     where user_id = v_user_id and workout_id = p_workout_id;
    update public.workout_videos
       set likes_count = greatest(likes_count - 1, 0)
     where id = p_workout_id
     returning likes_count into v_count;
    return query select false, coalesce(v_count, 0);
  else
    update public.workout_videos
       set likes_count = likes_count + 1
     where id = p_workout_id
     returning likes_count into v_count;
    return query select true, coalesce(v_count, 0);
  end if;
end;
$$;

commit;
