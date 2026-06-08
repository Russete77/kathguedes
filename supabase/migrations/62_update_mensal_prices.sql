begin;

update public.plans set monthly_mensal_cents = 12900, asaas_value_mensal = 129.00 where slug = 'start';
update public.plans set monthly_mensal_cents = 14900, asaas_value_mensal = 149.00 where slug = 'evolucao';
update public.plans set monthly_mensal_cents = 16900, asaas_value_mensal = 169.00 where slug = 'saude_completa';
update public.plans set monthly_mensal_cents = 34990, asaas_value_mensal = 349.90 where slug = 'atleta';

commit;
