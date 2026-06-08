-- ============================================
-- MIGRATION 32: plans_display_names
-- ============================================
--
-- Renomeia o nome de EXIBIÇÃO dos planos conforme decisão de produto da Kath
-- (25/05/26). Slug interno fica igual — só `name` e `asaas_description` mudam.
--
--   slug              name (antes)         name (depois)
--   start             Start                Treino
--   evolucao          Evolução             Performance
--   saude_completa    Saúde Completa       Saúde Completa  (mantém — ganha badge "🔥 MAIS ESCOLHIDO" na UI)
--   atleta            Atleta               Atleta          (mantém)
-- ============================================

begin;

update public.plans set
  name = 'Treino',
  asaas_description = 'Kath Treinos — Treino: Biblioteca completa de treinos'
where slug = 'start';

update public.plans set
  name = 'Performance',
  asaas_description = 'Kath Treinos — Performance: Treinos + Plano alimentar personalizado'
where slug = 'evolucao';

update public.plans set
  asaas_description = 'Kath Treinos — Saúde Completa: Treinador + Anamnese + Suplementação'
where slug = 'saude_completa';

update public.plans set
  asaas_description = 'Kath Treinos — Atleta: Preparação completa para competição (Bikini)'
where slug = 'atleta';

commit;
