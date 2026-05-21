-- ============================================
-- Migration: Correções da Auditoria CTO (29/03/2026)
-- Run in: Supabase SQL Editor
-- ============================================
-- INCLUI: migration_product_shipping.sql + onboarding_completed + shipping_cost fields
-- Se já executou migration_product_shipping.sql, as colunas com IF NOT EXISTS serão ignoradas.

-- ── 1. Produtos: peso e dimensões para cálculo de frete ──
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(6,2) DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS height_cm INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS width_cm INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS length_cm INTEGER DEFAULT 30;

COMMENT ON COLUMN products.weight_kg IS 'Peso do produto em kg (para cálculo de frete)';
COMMENT ON COLUMN products.height_cm IS 'Altura em cm (frete)';
COMMENT ON COLUMN products.width_cm IS 'Largura em cm (frete)';
COMMENT ON COLUMN products.length_cm IS 'Comprimento em cm (frete)';

-- ── 2. Pedidos: campos de pagamento, envio e frete ──
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS melhor_envio_order_id TEXT,
  ADD COLUMN IF NOT EXISTS shipping_label_url TEXT,
  ADD COLUMN IF NOT EXISTS shipping_cost_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_method TEXT,
  ADD COLUMN IF NOT EXISTS estimated_delivery TEXT;

COMMENT ON COLUMN orders.asaas_payment_id IS 'ID da cobrança PIX no Asaas';
COMMENT ON COLUMN orders.melhor_envio_order_id IS 'ID do envio no Melhor Envio';
COMMENT ON COLUMN orders.shipping_label_url IS 'URL da etiqueta de envio';
COMMENT ON COLUMN orders.shipping_cost_cents IS 'Custo do frete em centavos';
COMMENT ON COLUMN orders.shipping_method IS 'Método de envio selecionado (PAC, SEDEX, etc)';
COMMENT ON COLUMN orders.estimated_delivery IS 'Previsão de entrega';

-- ── 3. Profiles: flag de onboarding completo ──
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

COMMENT ON COLUMN profiles.onboarding_completed IS 'Se o usuário completou o onboarding (telefone + interesses)';

-- Marcar como completo todos os profiles que já têm telefone preenchido
UPDATE profiles SET onboarding_completed = true WHERE phone IS NOT NULL AND phone != '';

-- ── 4. Índices úteis ──
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_asaas_payment ON orders(asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON profiles(onboarding_completed) WHERE onboarding_completed = false;

-- ── 5. Verificação ──
-- Rode esta query depois para confirmar:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name IN ('products', 'orders', 'profiles')
-- AND column_name IN ('weight_kg', 'height_cm', 'width_cm', 'length_cm',
--                      'asaas_payment_id', 'melhor_envio_order_id', 'shipping_label_url',
--                      'shipping_cost_cents', 'shipping_method', 'estimated_delivery',
--                      'onboarding_completed')
-- ORDER BY table_name, column_name;
