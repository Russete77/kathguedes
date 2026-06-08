-- 51_drop_dup_order_index.sql
-- Remove índice duplicado em orders(asaas_payment_id).
-- idx_orders_asaas_payment e idx_orders_asaas_payment_id são idênticos
-- (mesma coluna, mesmo WHERE parcial). Mantemos o _id e dropamos o outro.

drop index if exists public.idx_orders_asaas_payment;
