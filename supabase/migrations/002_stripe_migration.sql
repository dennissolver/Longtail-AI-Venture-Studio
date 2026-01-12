-- ============================================
-- LONGTAIL AI VENTURES - STRIPE INTEGRATION
-- Run this in Supabase SQL Editor
-- ============================================

-- Add Stripe columns to ventures table (if not exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ventures' AND column_name = 'stripe_secret_key') THEN
    ALTER TABLE ventures ADD COLUMN stripe_secret_key TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ventures' AND column_name = 'stripe_webhook_secret') THEN
    ALTER TABLE ventures ADD COLUMN stripe_webhook_secret TEXT;
  END IF;
END $$;

-- ============================================
-- PLANS TABLE (Stripe Products)
-- ============================================
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  stripe_product_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  features JSONB DEFAULT '[]',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if they exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plans' AND column_name = 'display_order') THEN
    ALTER TABLE plans ADD COLUMN display_order INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plans' AND column_name = 'updated_at') THEN
    ALTER TABLE plans ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================
-- PRICES TABLE (Stripe Prices)
-- ============================================
CREATE TABLE IF NOT EXISTS prices (
  id TEXT PRIMARY KEY,
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  plan_id TEXT REFERENCES plans(id) ON DELETE CASCADE,
  stripe_price_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  interval TEXT DEFAULT 'month', -- month, year, one_time
  interval_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prices' AND column_name = 'is_default') THEN
    ALTER TABLE prices ADD COLUMN is_default BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prices' AND column_name = 'updated_at') THEN
    ALTER TABLE prices ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================
-- SUBSCRIPTIONS TABLE (Stripe Subscriptions)
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  price_id TEXT REFERENCES prices(id),
  status TEXT NOT NULL, -- active, trialing, canceled, past_due, etc.
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'trial_start') THEN
    ALTER TABLE subscriptions ADD COLUMN trial_start TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'trial_end') THEN
    ALTER TABLE subscriptions ADD COLUMN trial_end TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_plans_venture ON plans(venture_id);
CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(is_active);

CREATE INDEX IF NOT EXISTS idx_prices_venture ON prices(venture_id);
CREATE INDEX IF NOT EXISTS idx_prices_plan ON prices(plan_id);
CREATE INDEX IF NOT EXISTS idx_prices_active ON prices(is_active);

CREATE INDEX IF NOT EXISTS idx_subscriptions_venture ON subscriptions(venture_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(stripe_customer_id);

-- ============================================
-- VENTURE STRIPE SUMMARY VIEW
-- ============================================
DROP VIEW IF EXISTS venture_stripe_summary;

CREATE VIEW venture_stripe_summary AS
SELECT 
  v.id as venture_id,
  v.slug,
  v.name,
  v.stripe_secret_key IS NOT NULL as stripe_configured,
  (SELECT COUNT(*) FROM plans p WHERE p.venture_id = v.id AND p.is_active = true) as active_plans,
  (SELECT COUNT(*) FROM prices pr WHERE pr.venture_id = v.id AND pr.is_active = true) as active_prices,
  (SELECT MIN(pr.amount) FROM prices pr WHERE pr.venture_id = v.id AND pr.is_active = true AND pr.interval = 'month') as lowest_monthly_price,
  (SELECT COUNT(*) FROM subscriptions s WHERE s.venture_id = v.id AND s.status = 'active') as active_subscriptions,
  (SELECT COUNT(*) FROM subscriptions s WHERE s.venture_id = v.id AND s.status = 'trialing') as trialing_subscriptions,
  (SELECT COALESCE(SUM(pr.amount), 0) 
   FROM subscriptions s 
   JOIN prices pr ON s.price_id = pr.id 
   WHERE s.venture_id = v.id AND s.status = 'active' AND pr.interval = 'month'
  ) as mrr_from_monthly,
  (SELECT COALESCE(SUM(pr.amount / 12), 0) 
   FROM subscriptions s 
   JOIN prices pr ON s.price_id = pr.id 
   WHERE s.venture_id = v.id AND s.status = 'active' AND pr.interval = 'year'
  ) as mrr_from_yearly
FROM ventures v;

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plans_updated_at ON plans;
CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS prices_updated_at ON prices;
CREATE TRIGGER prices_updated_at
  BEFORE UPDATE ON prices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ENABLE RLS (if not already enabled)
-- ============================================
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for authenticated users - adjust as needed)
DO $$ 
BEGIN
  -- Plans policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plans' AND policyname = 'plans_select') THEN
    CREATE POLICY plans_select ON plans FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plans' AND policyname = 'plans_insert') THEN
    CREATE POLICY plans_insert ON plans FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plans' AND policyname = 'plans_update') THEN
    CREATE POLICY plans_update ON plans FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plans' AND policyname = 'plans_delete') THEN
    CREATE POLICY plans_delete ON plans FOR DELETE USING (true);
  END IF;

  -- Prices policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prices' AND policyname = 'prices_select') THEN
    CREATE POLICY prices_select ON prices FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prices' AND policyname = 'prices_insert') THEN
    CREATE POLICY prices_insert ON prices FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prices' AND policyname = 'prices_update') THEN
    CREATE POLICY prices_update ON prices FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prices' AND policyname = 'prices_delete') THEN
    CREATE POLICY prices_delete ON prices FOR DELETE USING (true);
  END IF;

  -- Subscriptions policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'subscriptions_select') THEN
    CREATE POLICY subscriptions_select ON subscriptions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'subscriptions_insert') THEN
    CREATE POLICY subscriptions_insert ON subscriptions FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'subscriptions_update') THEN
    CREATE POLICY subscriptions_update ON subscriptions FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'subscriptions_delete') THEN
    CREATE POLICY subscriptions_delete ON subscriptions FOR DELETE USING (true);
  END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Uncomment to verify setup:

-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name IN ('ventures', 'plans', 'prices', 'subscriptions')
-- ORDER BY table_name, ordinal_position;

-- SELECT * FROM venture_stripe_summary;

SELECT 'Migration complete!' as status;
