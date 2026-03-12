import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

export async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        plan TEXT DEFAULT 'free',
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        api_key TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS domains (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        domain TEXT NOT NULL,
        monitoring_enabled BOOLEAN DEFAULT false,
        monitoring_interval TEXT DEFAULT 'weekly',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS scans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        domain TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        security_score INTEGER,
        critical_count INTEGER DEFAULT 0,
        warning_count INTEGER DEFAULT 0,
        info_count INTEGER DEFAULT 0,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS scan_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
        module TEXT NOT NULL,
        status TEXT,
        score INTEGER,
        findings JSONB DEFAULT '[]',
        raw_data JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS vulnerabilities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        severity TEXT NOT NULL,
        category TEXT,
        fix_recommendation TEXT,
        fix_example TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        pdf_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        stripe_subscription_id TEXT UNIQUE,
        plan TEXT NOT NULL,
        status TEXT NOT NULL,
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS finding_fixes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vulnerability_id UUID REFERENCES vulnerabilities(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'fixed',
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(vulnerability_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS anon_scan_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ip_address TEXT NOT NULL,
        scan_date DATE DEFAULT CURRENT_DATE,
        scan_count INTEGER DEFAULT 1,
        UNIQUE(ip_address, scan_date)
      );

      CREATE TABLE IF NOT EXISTS ai_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usage_key TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ai_usage_key ON ai_usage(usage_key, created_at);

      CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
      CREATE INDEX IF NOT EXISTS idx_scans_domain ON scans(domain);
      CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
      CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_scans_user_domain ON scans(user_id, domain);
      CREATE INDEX IF NOT EXISTS idx_vulnerabilities_scan_id ON vulnerabilities(scan_id);
      CREATE INDEX IF NOT EXISTS idx_scan_results_scan_id ON scan_results(scan_id);
      CREATE INDEX IF NOT EXISTS idx_anon_scan_tracking ON anon_scan_tracking(ip_address, scan_date);
      CREATE INDEX IF NOT EXISTS idx_domains_monitoring ON domains(user_id) WHERE monitoring_enabled = true;
    `);
    // Add new columns if they don't exist yet (idempotent migrations)
    await client.query(`ALTER TABLE scans ADD COLUMN IF NOT EXISTS ip_address TEXT;`);
    await client.query(`ALTER TABLE scans ADD COLUMN IF NOT EXISTS owasp_summary JSONB DEFAULT '{}';`);
    await client.query(`ALTER TABLE domains ADD COLUMN IF NOT EXISTS webhook_url TEXT;`);
    await client.query(`ALTER TABLE domains ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE domains ADD COLUMN IF NOT EXISTS last_score INTEGER;`);
    // Auth enhancements
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token TEXT;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token_expires TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_alerts BOOLEAN DEFAULT true;`);
    console.log('Database schema initialized');
  } finally {
    client.release();
  }
}
