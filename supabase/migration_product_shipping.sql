-- ============================================
-- Migration: Adicionar peso e dimensões aos produtos + campos de pagamento aos pedidos
-- Run in: Supabase SQL Editor
-- ============================================

-- 1. Adicionar campos de peso e dimensões na tabela products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(6,2) DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS height_cm INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS width_cm INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS length_cm INTEGER DEFAULT 30;

-- 2. Adicionar campos de pagamento e envio na tabela orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS melhor_envio_order_id TEXT,
  ADD COLUMN IF NOT EXISTS shipping_label_url TEXT;

-- 3. Comentários descritivos
COMMENT ON COLUMN products.weight_kg IS 'Peso do produto em kg (para cálculo de frete)';
COMMENT ON COLUMN products.height_cm IS 'Altura do produto em cm (para cálculo de frete)';
COMMENT ON COLUMN products.width_cm IS 'Largura do produto em cm (para cálculo de frete)';
COMMENT ON COLUMN products.length_cm IS 'Comprimento do produto em cm (para cálculo de frete)';
COMMENT ON COLUMN orders.asaas_payment_id IS 'ID da cobrança no Asaas';
COMMENT ON COLUMN orders.melhor_envio_order_id IS 'ID do envio no Melhor Envio';
COMMENT ON COLUMN orders.shipping_label_url IS 'URL da etiqueta de envio';
