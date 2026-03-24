CREATE TABLE IF NOT EXISTS wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  chain_namespace TEXT NOT NULL DEFAULT 'eip155',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'dex', 'full')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'canceled')),
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_subscriptions_wallet_idx ON wallet_subscriptions(wallet_address);
CREATE INDEX IF NOT EXISTS wallet_subscriptions_expires_idx ON wallet_subscriptions(expires_at);

CREATE TABLE IF NOT EXISTS wallet_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  chain_id BIGINT,
  token_address TEXT,
  paid_amount_units TEXT NOT NULL,
  expected_amount_units TEXT NOT NULL,
  amount_usd NUMERIC(18,2) NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('dex', 'full')),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_payments_wallet_idx ON wallet_payments(wallet_address);
CREATE INDEX IF NOT EXISTS wallet_payments_plan_idx ON wallet_payments(plan);

