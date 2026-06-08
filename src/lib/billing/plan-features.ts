// Fonte ÚNICA das listas de features exibidas nos cards de plano — usada tanto na
// landing pública (src/app/(public)/page.tsx) quanto na página in-app de planos
// (src/app/(app)/planos/plans-grid.tsx). Mantém as duas telas sincronizadas.
//
// Texto de copy definido pela Kath (25/05/26). O JSONB `plan.features` no banco
// continua sendo a fonte de verdade para GATES de código/RLS; estas strings são
// apenas apresentação (marketing) e não devem ser usadas para liberar acesso.
export const PLAN_FEATURE_LISTS: Record<string, string[]> = {
  start: [
    "Biblioteca completa de treinos",
    "Treinos para academia",
    "Treinos por objetivo",
    "Novos treinos adicionados regularmente",
    "Registro de evolução",
    "Calculadora de macros",
    "Cupons exclusivos",
    "Cashback na loja",
  ],
  evolucao: [
    "Tudo do plano Treino",
    "Plano alimentar personalizado",
    "Estratégia nutricional baseada na avaliação inicial",
    "Calculadora avançada de macros",
    "Controle de peso e medidas",
    "Registro fotográfico da evolução",
    "Conteúdos exclusivos sobre emagrecimento e hipertrofia",
    "Cashback ampliado",
  ],
  saude_completa: [
    "Tudo do plano Performance",
    "Suporte do treinador pelo aplicativo",
    "Orientação nutricional personalizada",
    "Plano alimentar baseado na anamnese",
    "Ajustes periódicos de treino",
    "Ajustes periódicos da alimentação",
    "Plano de suplementação personalizado",
    "Chat prioritário",
    "Revisão mensal",
    "Notificações de hidratação",
    "Motivação diária",
    "Registro de antes e depois",
    "Grupo VIP exclusivo",
    "Conteúdos premium",
  ],
  atleta: [
    "Tudo do plano Saúde Completa",
    "Avaliação semanal de evolução",
    "Ajustes semanais de treino e estratégia",
    "Acompanhamento direto com treinador",
    "Suporte diário via WhatsApp",
    "Análise de fotos e feedback técnico",
    "Estratégia nutricional individualizada",
    "Estratégia de suplementação personalizada",
    "Planejamento completo para competição",
    "Estratégia de Peak Week",
    "Prioridade máxima no atendimento",
    "Orientação para apresentação e palco",
    "Grupo exclusivo de atletas",
  ],
};
