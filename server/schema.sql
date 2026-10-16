-- ====================================================================
-- ReworkGuard — Bug Accountability and Rework Cost Tracker
-- Shared PostgreSQL / Supabase Database Schema & Realistic Seed Data
-- Tables: users, modules, module_status_history, bugs, bug_status_history, time_entries, reviews, audit_logs
-- ====================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(32) NOT NULL CHECK (role IN ('developer', 'manager', 'qa', 'admin')),
  hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
  avatar VARCHAR(512),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. MODULES TABLE
CREATE TABLE IF NOT EXISTS modules (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(64) UNIQUE NOT NULL,
  version VARCHAR(32) NOT NULL DEFAULT 'v1.0.0',
  description TEXT,
  owner_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  total_lines_of_code INTEGER NOT NULL DEFAULT 10000,
  status VARCHAR(32) NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'reopened', 'closed', 'active', 'maintenance', 'deprecated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completion_date TIMESTAMP WITH TIME ZONE
);

-- 2b. MODULE_STATUS_HISTORY TABLE
CREATE TABLE IF NOT EXISTS module_status_history (
  id VARCHAR(64) PRIMARY KEY,
  module_id VARCHAR(64) NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  from_status VARCHAR(32) NOT NULL,
  to_status VARCHAR(32) NOT NULL,
  changed_by_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. BUGS TABLE
CREATE TABLE IF NOT EXISTS bugs (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  module_id VARCHAR(64) NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  module_version VARCHAR(32),
  original_module_owner_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  reproduction_steps TEXT,
  severity VARCHAR(32) NOT NULL CHECK (severity IN ('critical', 'major', 'minor', 'high', 'medium', 'low')),
  priority VARCHAR(32) NOT NULL CHECK (priority IN ('p0', 'p1', 'p2', 'p3')),
  status VARCHAR(32) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'fixed', 'closed', 'reopened', 'review_pending')),
  root_cause VARCHAR(64) NOT NULL CHECK (root_cause IN (
    'logic_error', 'requirement_gap', 'regression', 'integration', 
    'edge_case', 'security', 'performance', 'code_defect', 
    'requirement_change', 'external_dependency', 'unclear_specification', 'other'
  )),
  original_author_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  corrective_hours NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
  rework_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  review_status VARCHAR(32) NOT NULL DEFAULT 'not_submitted' CHECK (review_status IN (
    'not_submitted', 'pending', 'approved_for_accounting', 'approved', 'waived', 'disputed', 'rejected', 'changes_requested'
  )),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- 3b. BUG_STATUS_HISTORY TABLE
CREATE TABLE IF NOT EXISTS bug_status_history (
  id VARCHAR(64) PRIMARY KEY,
  bug_id VARCHAR(64) NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  from_status VARCHAR(32) NOT NULL,
  to_status VARCHAR(32) NOT NULL,
  changed_by_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TIME_ENTRIES TABLE
CREATE TABLE IF NOT EXISTS time_entries (
  id VARCHAR(64) PRIMARY KEY,
  bug_id VARCHAR(64) NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hours_spent NUMERIC(8, 2) NOT NULL CHECK (hours_spent > 0),
  hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
  cost NUMERIC(12, 2) NOT NULL,
  work_description TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. REVIEWS TABLE
CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(64) PRIMARY KEY,
  bug_id VARCHAR(64) NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  manager_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  developer_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  root_cause VARCHAR(64) NOT NULL DEFAULT 'code_defect',
  decision VARCHAR(32) NOT NULL DEFAULT 'pending',
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved_for_accounting', 'approved', 'waived', 'disputed', 'rejected', 'changes_requested'
  )),
  review_notes TEXT,
  comments TEXT,
  cost_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  hours_approved NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. AUDIT_LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  entity_type VARCHAR(32) NOT NULL CHECK (entity_type IN ('bug', 'module', 'review', 'time_entry')),
  entity_id VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  details TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_bugs_module_id ON bugs(module_id);
CREATE INDEX IF NOT EXISTS idx_bugs_status ON bugs(status);
CREATE INDEX IF NOT EXISTS idx_bugs_assigned_to ON bugs(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_bug_id ON time_entries(bug_id);
CREATE INDEX IF NOT EXISTS idx_reviews_bug_id ON reviews(bug_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- ====================================================================
-- SEED DATA (Safe Demo Credentials & Initial Records)
-- ====================================================================

-- 1. Seed Users (All rates in INR ₹)
INSERT INTO users (id, name, email, role, hourly_rate, avatar) VALUES
('usr-1', 'Sarah Connor', 'sarah.connor@reworkguard.io', 'manager', 750.00, 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'),
('usr-2', 'Alex Rivera', 'alex.rivera@reworkguard.io', 'developer', 500.00, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'),
('usr-3', 'Devon Lee', 'devon.lee@reworkguard.io', 'developer', 500.00, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'),
('usr-4', 'Priya Sharma', 'priya.sharma@reworkguard.io', 'qa', 450.00, 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150'),
('usr-5', 'Marcus Vance', 'marcus.vance@reworkguard.io', 'developer', 600.00, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150')
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Modules
INSERT INTO modules (id, name, code, version, description, owner_id, total_lines_of_code, status, created_at) VALUES
('mod-1', 'Billing & Checkout Engine', 'CHECKOUT', 'v2.4.0', 'Payment processing, multi-currency conversion, cart calculation, and payment gateway webhooks.', 'usr-2', 28500, 'in_progress', '2026-08-15T08:00:00Z'),
('mod-2', 'Authentication & OAuth Core', 'AUTH', 'v1.8.2', 'JWT issuance, session token rotation, RBAC permission verification, and SSO SAML connectors.', 'usr-3', 14200, 'completed', '2026-08-20T09:30:00Z'),
('mod-3', 'Inventory & Stock Sync', 'STOCK', 'v3.1.0', 'Real-time stock reservation, distributed locking, warehouse ERP syncing, and threshold alerting.', 'usr-5', 22100, 'assigned', '2026-09-01T11:00:00Z'),
('mod-4', 'Customer Communications', 'NOTIF', 'v1.2.5', 'Transactional emails, SMS dispatch gateway, push notification queues, and template engine.', 'usr-2', 9800, 'completed', '2026-09-10T14:15:00Z'),
('mod-5', 'Analytics & Compliance Reports', 'REPORTS', 'v2.0.0', 'Executive dashboard aggregations, financial tax audits, GDPR export routines, and CSV generators.', 'usr-3', 18400, 'in_progress', '2026-09-18T16:45:00Z')
ON CONFLICT (id) DO NOTHING;

-- 3. Seed Bugs
INSERT INTO bugs (id, title, description, module_id, module_version, original_module_owner_id, severity, priority, status, root_cause, original_author_id, assigned_to_id, corrective_hours, hourly_rate, rework_cost, review_status, created_at) VALUES
('bug-101', 'Idempotency failure on high-latency payment retries', 'When 3D-Secure authentication handshake takes >15s, client retried POST /charge without idempotency key header, generating double transactions.', 'mod-1', 'v2.4.0', 'usr-2', 'critical', 'p0', 'review_pending', 'code_defect', 'usr-2', 'usr-2', 14.5, 500.00, 7250.00, 'pending', '2026-10-02T09:15:00Z'),
('bug-102', 'JWT refresh token reuse race condition', 'Concurrent refresh requests with the same rotation token caused silent logout for valid active sessions due to unindexed timestamp comparison.', 'mod-2', 'v1.8.2', 'usr-3', 'major', 'p1', 'closed', 'code_defect', 'usr-3', 'usr-3', 8.0, 500.00, 4000.00, 'approved_for_accounting', '2026-10-04T11:20:00Z'),
('bug-103', 'Negative stock quantity during simultaneous cart checkout', 'Inventory lock was released prior to DB commit, allowing 2 users to buy the last single remaining SKU simultaneously.', 'mod-3', 'v3.1.0', 'usr-5', 'critical', 'p0', 'in_progress', 'code_defect', 'usr-5', 'usr-5', 11.0, 600.00, 6600.00, 'not_submitted', '2026-10-08T14:00:00Z'),
('bug-104', 'Email notification template variable XSS sanitization gap', 'Customer greeting in transactional receipt emails permitted raw HTML injection if display name contained unsanitized script tags.', 'mod-4', 'v1.2.5', 'usr-2', 'major', 'p1', 'closed', 'code_defect', 'usr-2', 'usr-2', 5.5, 500.00, 2750.00, 'approved_for_accounting', '2026-09-25T13:40:00Z'),
('bug-105', 'OOM error when generating quarterly CSV report over 100k rows', 'Report generation loaded entire dataset into memory instead of streaming chunks via cursor, causing Node heap limit crash.', 'mod-5', 'v2.0.0', 'usr-3', 'minor', 'p2', 'open', 'code_defect', 'usr-3', 'usr-3', 3.0, 500.00, 1500.00, 'not_submitted', '2026-10-11T10:05:00Z'),
('bug-106', 'Tax rounding discrepancy on EU VAT orders with multiple items', 'Calculated tax per unit rather than sum of line totals, leading to 1-cent divergence against Stripe tax calculation.', 'mod-1', 'v2.4.0', 'usr-2', 'minor', 'p2', 'review_pending', 'requirement_change', 'usr-2', 'usr-5', 6.0, 600.00, 3600.00, 'pending', '2026-10-07T16:15:00Z')
ON CONFLICT (id) DO NOTHING;

-- 4. Seed Time Entries
INSERT INTO time_entries (id, bug_id, user_id, hours_spent, hourly_rate, cost, work_description, date) VALUES
('te-1', 'bug-101', 'usr-2', 6.5, 500.00, 3250.00, 'Isolated idempotency race condition in webhook receiver; drafted unit test suite.', '2026-10-03'),
('te-2', 'bug-101', 'usr-2', 8.0, 500.00, 4000.00, 'Implemented distributed Redis lock with SHA-256 idempotency signature; verified with test mocks.', '2026-10-04'),
('te-3', 'bug-102', 'usr-3', 8.0, 500.00, 4000.00, 'Added atomic token invalidation in PostgreSQL transaction; added concurrency tests.', '2026-10-05'),
('te-4', 'bug-103', 'usr-5', 11.0, 600.00, 6600.00, 'Implemented SELECT FOR UPDATE row-level locking on inventory table.', '2026-10-09'),
('te-5', 'bug-104', 'usr-2', 5.5, 500.00, 2750.00, 'Added DOMPurify sanitizer and escaped mustache template tags across all templates.', '2026-09-26'),
('te-6', 'bug-105', 'usr-3', 3.0, 500.00, 1500.00, 'Refactored report query to use cursor streams piping into gzip compression stream.', '2026-10-12'),
('te-7', 'bug-106', 'usr-5', 6.0, 600.00, 3600.00, 'Recalculated line totals using Banker rounding matching Stripe tax precision.', '2026-10-08')
ON CONFLICT (id) DO NOTHING;

-- 5. Seed Reviews
INSERT INTO reviews (id, bug_id, manager_id, developer_id, root_cause, decision, status, review_notes, comments, cost_accepted, hours_approved, quality_rating, created_at) VALUES
('rev-1', 'bug-102', 'usr-1', 'usr-3', 'code_defect', 'approved_for_accounting', 'approved_for_accounting', 'Clean atomic lock solution. Concurrency tests passed. Rework cost approved.', 'Clean atomic lock solution. Concurrency tests passed. Rework cost approved.', true, 8.0, 5, '2026-10-11T10:00:00Z'),
('rev-2', 'bug-104', 'usr-1', 'usr-2', 'code_defect', 'approved_for_accounting', 'approved_for_accounting', 'Sanitization filters applied across all notification templates. Regression suite green.', 'Sanitization filters applied across all notification templates. Regression suite green.', true, 5.5, 4, '2026-09-30T14:00:00Z'),
('rev-3', 'bug-101', 'usr-1', 'usr-2', 'code_defect', 'pending', 'pending', 'Awaiting final payment provider sandbox automated integration run before signing off.', 'Awaiting final payment provider sandbox automated integration run before signing off.', false, 14.5, 4, '2026-10-12T17:00:00Z'),
('rev-4', 'bug-106', 'usr-1', 'usr-5', 'requirement_change', 'pending', 'pending', 'Need confirmation from finance department regarding Austrian and German edge case orders.', 'Need confirmation from finance department regarding Austrian and German edge case orders.', false, 6.0, 4, '2026-10-15T16:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- 6. Seed Audit Logs
INSERT INTO audit_logs (id, entity_type, entity_id, action, user_id, details, timestamp) VALUES
('aud-1', 'bug', 'bug-101', 'STATUS_CHANGED', 'usr-2', 'Status changed from in_progress to review_pending after completing tests.', '2026-10-12T16:40:00Z'),
('aud-2', 'time_entry', 'te-2', 'HOURS_LOGGED', 'usr-2', 'Logged 8.0 corrective hours on bug-101 (Rework cost: ₹4,000).', '2026-10-04T18:00:00Z'),
('aud-3', 'review', 'rev-1', 'REVIEW_APPROVED', 'usr-1', 'Manager Sarah Connor approved rework cost for bug-102.', '2026-10-11T10:00:00Z')
ON CONFLICT (id) DO NOTHING;
