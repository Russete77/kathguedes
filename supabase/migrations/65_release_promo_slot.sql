-- ============================================================================
-- MIGRATION 65: release_promo_slot — estorna um slot consumido por claim_promo_slot
-- ============================================================================
-- claim_promo_slot incrementa uses_count atomicamente ANTES de a cobranca ser
-- criada no Asaas. Se a cobranca falhar (cartao recusado, 4xx) ou se a promo de
-- valor fixo nao se aplicar a forma de pagamento, o slot precisa ser devolvido
-- para nao vazar (ex.: promo PRIMEIROS100). Decremento atomico, nunca < 0.
-- ============================================================================

begin;

create or replace function public.release_promo_slot(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.promo_codes
     set uses_count = greatest(uses_count - 1, 0),
         updated_at = now()
   where id = p_id;
$$;

comment on function public.release_promo_slot(uuid) is
  'Estorna um slot consumido por claim_promo_slot (decremento atomico, >= 0).';

commit;
