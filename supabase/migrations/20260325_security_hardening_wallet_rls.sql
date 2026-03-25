-- Security hardening: wallet RLS + nonce replay protection.

-- 1) Enable RLS to prevent anon-key full table reads.
ALTER TABLE IF EXISTS wallet_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallet_payments ENABLE ROW LEVEL SECURITY;

-- Explicit deny-all policies (service role bypasses RLS; anon/authenticated denied by default).
DROP POLICY IF EXISTS "wallet_subscriptions_deny_all" ON wallet_subscriptions;
CREATE POLICY "wallet_subscriptions_deny_all"
  ON wallet_subscriptions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "wallet_payments_deny_all" ON wallet_payments;
CREATE POLICY "wallet_payments_deny_all"
  ON wallet_payments
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 2) Nonce single-use store (cross-instance replay protection).
CREATE TABLE IF NOT EXISTS wallet_used_nonces (
  nonce_hash TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS wallet_used_nonces_expires_idx ON wallet_used_nonces(expires_at);
CREATE INDEX IF NOT EXISTS wallet_used_nonces_wallet_idx ON wallet_used_nonces(wallet_address);

ALTER TABLE IF EXISTS wallet_used_nonces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_used_nonces_deny_all" ON wallet_used_nonces;
CREATE POLICY "wallet_used_nonces_deny_all"
  ON wallet_used_nonces
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 3) Cross-network replay protection (wallet + tx + chain uniqueness).
CREATE UNIQUE INDEX IF NOT EXISTS wallet_payments_wallet_tx_chain_uidx
  ON wallet_payments(wallet_address, tx_hash, chain_id);

-- 4) Server-side session revocation list.
CREATE TABLE IF NOT EXISTS wallet_revoked_sessions (
  token_hash TEXT PRIMARY KEY,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS wallet_revoked_sessions_expires_idx
  ON wallet_revoked_sessions(expires_at);

ALTER TABLE IF EXISTS wallet_revoked_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_revoked_sessions_deny_all" ON wallet_revoked_sessions;
CREATE POLICY "wallet_revoked_sessions_deny_all"
  ON wallet_revoked_sessions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
