-- ============================================
-- LONGTAIL AI VENTURES - DATABASE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SUPERADMIN TABLE
-- ============================================
CREATE TABLE superadmins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert superadmin
INSERT INTO superadmins (email) VALUES ('dennis@corporateaisolutions.com');

-- ============================================
-- VENTURES TABLE
-- ============================================
CREATE TABLE ventures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tagline TEXT,
  description TEXT,
  url TEXT,
  github_repo TEXT,
  github_url TEXT,
  logo_url TEXT,
  tech_stack TEXT[] DEFAULT '{}',
  tam TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'exited', 'archived')),
  target_arr DECIMAL(12,2) DEFAULT 1000000.00,
  is_public BOOLEAN DEFAULT false,
  vercel_project_id TEXT,
  supabase_project_id TEXT,
  stripe_account_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SIGNUPS TABLE
-- ============================================
CREATE TABLE signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venture_id UUID REFERENCES ventures(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise', 'custom')),
  status TEXT DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'churned', 'paused')),
  source TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REVENUE TABLE
-- ============================================
CREATE TABLE revenue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venture_id UUID REFERENCES ventures(id) ON DELETE CASCADE,
  signup_id UUID REFERENCES signups(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'AUD',
  type TEXT DEFAULT 'subscription' CHECK (type IN ('subscription', 'one-time', 'refund', 'upgrade', 'downgrade')),
  plan TEXT,
  period_start DATE,
  period_end DATE,
  stripe_payment_id TEXT,
  stripe_subscription_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EVENTS TABLE (Activity Feed)
-- ============================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venture_id UUID REFERENCES ventures(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  email TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- METRICS SNAPSHOT TABLE (Daily aggregates)
-- ============================================
CREATE TABLE metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venture_id UUID REFERENCES ventures(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  mrr DECIMAL(12,2) DEFAULT 0,
  arr DECIMAL(12,2) DEFAULT 0,
  total_signups INTEGER DEFAULT 0,
  paid_customers INTEGER DEFAULT 0,
  churned_customers INTEGER DEFAULT 0,
  revenue_total DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(venture_id, date)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_signups_venture ON signups(venture_id);
CREATE INDEX idx_signups_email ON signups(email);
CREATE INDEX idx_signups_created ON signups(created_at DESC);
CREATE INDEX idx_revenue_venture ON revenue(venture_id);
CREATE INDEX idx_revenue_created ON revenue(created_at DESC);
CREATE INDEX idx_events_venture ON events(venture_id);
CREATE INDEX idx_events_created ON events(created_at DESC);
CREATE INDEX idx_metrics_venture_date ON metrics_snapshots(venture_id, date DESC);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ventures_updated_at
  BEFORE UPDATE ON ventures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER signups_updated_at
  BEFORE UPDATE ON signups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE ventures ENABLE ROW LEVEL SECURITY;
ALTER TABLE signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE superadmins ENABLE ROW LEVEL SECURITY;

-- Superadmin can do everything
CREATE POLICY "Superadmin full access to ventures" ON ventures
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (SELECT email FROM superadmins)
  );

CREATE POLICY "Superadmin full access to signups" ON signups
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (SELECT email FROM superadmins)
  );

CREATE POLICY "Superadmin full access to revenue" ON revenue
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (SELECT email FROM superadmins)
  );

CREATE POLICY "Superadmin full access to events" ON events
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (SELECT email FROM superadmins)
  );

CREATE POLICY "Superadmin full access to metrics" ON metrics_snapshots
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (SELECT email FROM superadmins)
  );

-- Service role bypass for API tracking
CREATE POLICY "Service role access to signups" ON signups
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role access to revenue" ON revenue
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role access to events" ON events
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- VIEWS FOR DASHBOARD
-- ============================================
CREATE OR REPLACE VIEW venture_stats AS
SELECT 
  v.id,
  v.name,
  v.slug,
  v.status,
  v.target_arr,
  COALESCE(SUM(r.amount) FILTER (WHERE r.type != 'refund'), 0) as total_revenue,
  COALESCE(SUM(r.amount) FILTER (WHERE r.type = 'refund'), 0) as total_refunds,
  COALESCE(SUM(r.amount) FILTER (WHERE r.type = 'subscription' AND r.created_at >= date_trunc('month', NOW())), 0) as mrr,
  COALESCE(SUM(r.amount) FILTER (WHERE r.type = 'subscription' AND r.created_at >= date_trunc('month', NOW())), 0) * 12 as arr,
  COUNT(DISTINCT s.id) as total_signups,
  COUNT(DISTINCT s.id) FILTER (WHERE s.plan != 'free') as paid_customers,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'churned') as churned_customers
FROM ventures v
LEFT JOIN revenue r ON r.venture_id = v.id
LEFT JOIN signups s ON s.venture_id = v.id
GROUP BY v.id;
