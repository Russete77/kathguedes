-- ============================================================
-- KathApp Migration Fixes — Março 2026
-- Rodar no Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Campos faltantes no schema ──

-- profiles: campo phone usado no onboarding
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- workout_videos: campos usados no admin
ALTER TABLE workout_videos ADD COLUMN IF NOT EXISTS is_short BOOLEAN DEFAULT false;
ALTER TABLE workout_videos ADD COLUMN IF NOT EXISTS notes TEXT;

-- orders: campos para pagamento e logística
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost_cents INT DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_label_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery TEXT;

-- ── 2. RPC atômico para decrement de estoque ──
-- Evita race condition: usa UPDATE com WHERE stock >= quantity

CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_quantity INT)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET stock = stock - p_quantity
  WHERE id = p_product_id AND stock >= p_quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estoque insuficiente para o produto %', p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_stock(p_product_id UUID, p_quantity INT)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET stock = stock + p_quantity
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Índices faltantes ──

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_is_read ON messages (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders (user_id, status);

-- ── 4. Tabela de idempotency para webhooks ──

CREATE TABLE IF NOT EXISTS webhook_events (
  payment_id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now()
);

-- ── 5. Tabela moto_events (agenda) ──

CREATE TABLE IF NOT EXISTS moto_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  location_url TEXT,
  image_url TEXT,
  max_participants INT,
  current_participants INT DEFAULT 0,
  required_plan TEXT DEFAULT 'free' CHECK (required_plan IN ('free', 'start', 'pro', 'vip')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE moto_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active events"
  ON moto_events FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Service role full access on moto_events"
  ON moto_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_moto_events_date ON moto_events (event_date DESC);

-- ── 6. Tabela challenges (desafios) ──

CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('streak', 'volume', 'custom')),
  target_value INT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  reward_text TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_value INT DEFAULT 0,
  completed_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read challenges"
  ON challenges FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Service role full access on challenges"
  ON challenges FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users manage own participation"
  ON challenge_participants FOR SELECT TO authenticated
  USING (user_id = (auth.jwt()->>'sub'));

CREATE POLICY "Users join challenges"
  ON challenge_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = (auth.jwt()->>'sub'));

CREATE POLICY "Users update own progress"
  ON challenge_participants FOR UPDATE TO authenticated
  USING (user_id = (auth.jwt()->>'sub'));

CREATE POLICY "Service role full access on challenge_participants"
  ON challenge_participants FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Done!
SELECT 'Migration applied successfully!' AS status;
