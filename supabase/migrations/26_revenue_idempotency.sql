-- ============================================================================
-- 26_revenue_idempotency.sql
--
-- R-A (CTO audit 2026-05-22): o webhook Asaas grava a linha de idempotência
-- ANTES de processar. Se um handler falha transitoriamente (ex.: compute_commissions
-- ou crédito de cashback), o 5xx faz o Asaas reentregar — mas a linha de idempotência
-- já existe e o evento é pulado, deixando o pagamento "pago mas não processado por
-- completo".
--
-- A correção no código passa a LIBERAR o claim de idempotência em caso de falha,
-- para que o Asaas reprocesse. Para que reprocessar seja SEGURO (sem duplicar
-- dinheiro), esta migration garante unicidade de revenue_stream por pagamento Asaas.
-- A checagem de cashback por stream (creditWalletCents) e o on-conflict de
-- compute_commissions completam a idempotência no lado do código.
--
-- O índice antigo idx_revenue_streams_asaas (NÃO único) é substituído por um único.
-- Streams sem asaas_payment_id (ex.: quitação presencial do restante) ficam de fora
-- do índice parcial e não são afetados.
--
-- Idempotente: drop if exists + create unique index if not exists.
-- ============================================================================

drop index if exists public.idx_revenue_streams_asaas;

create unique index if not exists uq_revenue_streams_asaas_payment
  on public.revenue_streams(asaas_payment_id)
  where asaas_payment_id is not null;
