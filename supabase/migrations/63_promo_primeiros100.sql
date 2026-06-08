begin;

update public.promo_codes
   set slug     = 'PRIMEIROS100',
       max_uses = 100,
       description = replace(description, '20 clientes', '100 clientes')
 where slug = 'PRIMEIROS20';

commit;
