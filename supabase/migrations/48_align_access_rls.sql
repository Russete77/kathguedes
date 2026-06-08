-- 48_align_access_rls.sql
-- Alinha a RLS de catálogo gateado por plano ao gate REAL do código:
--   acesso = is_free_preview/is_public_preview
--            OR ( assinatura ativa (status='active' OU ends_at futuro)
--                 AND nível do plano >= required_plan )
--
-- Antes, as policies workouts_select_by_plan / affiliates_select_by_plan /
-- coupons_select_by_plan gateavam SÓ por tier e ignoravam subscription_status
-- e is_free_preview. Como todo profile nasce plan_tier='start' e todo conteúdo
-- nasce required_plan='start', um usuário 'canceled' conseguia LER tudo de
-- 'start' diretamente via PostgREST. O fix da migration 41 foi feito só no
-- código (que usa admin client); a RLS continuava furada. Esta migration fecha.
--
-- Idempotente (drop policy if exists + create).

-- ── workout_videos ──
drop policy if exists workouts_select_by_plan on public.workout_videos;
create policy workouts_select_by_plan on public.workout_videos
  for select to authenticated
  using (
    is_published = true
    and (
      coalesce(is_free_preview, false) = true
      or (
        (
          (select subscription_status from public.profiles
             where id = (select auth.jwt()->>'sub')) = 'active'
          or (select subscription_ends_at from public.profiles
                where id = (select auth.jwt()->>'sub')) > now()
        )
        and public.plan_tier_level(
          (select plan_tier from public.profiles where id = (select auth.jwt()->>'sub'))
        ) >= public.plan_tier_level(required_plan)
      )
    )
  );

-- ── affiliate_links (sem coluna de preview) ──
drop policy if exists affiliates_select_by_plan on public.affiliate_links;
create policy affiliates_select_by_plan on public.affiliate_links
  for select to authenticated
  using (
    is_active = true
    and (
      (select subscription_status from public.profiles
         where id = (select auth.jwt()->>'sub')) = 'active'
      or (select subscription_ends_at from public.profiles
            where id = (select auth.jwt()->>'sub')) > now()
    )
    and public.plan_tier_level(
      (select plan_tier from public.profiles where id = (select auth.jwt()->>'sub'))
    ) >= public.plan_tier_level(required_plan)
  );

-- ── coupons (mantém is_public_preview como bypass público) ──
drop policy if exists coupons_select_by_plan on public.coupons;
create policy coupons_select_by_plan on public.coupons
  for select to authenticated
  using (
    is_active = true
    and valid_until > now()
    and (
      coalesce(is_public_preview, false) = true
      or (
        (
          (select subscription_status from public.profiles
             where id = (select auth.jwt()->>'sub')) = 'active'
          or (select subscription_ends_at from public.profiles
                where id = (select auth.jwt()->>'sub')) > now()
        )
        and public.plan_tier_level(
          (select plan_tier from public.profiles where id = (select auth.jwt()->>'sub'))
        ) >= public.plan_tier_level(required_plan)
      )
    )
  );
