-- =====================================================
-- WIDERØE ANALYTICS PLATFORM
-- Migration 004: Row-Level Security (RLS) Policies
-- GDPR-compliant access control
-- =====================================================

-- =====================================================
-- User roles table (linked to Supabase Auth)
-- =====================================================
CREATE TABLE user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('hr_admin', 'manager', 'analyst', 'occ_health')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_roles_role ON user_roles(role);

COMMENT ON TABLE user_roles IS 'User role assignments for RBAC. Roles: hr_admin (full access), manager (org-scoped), analyst (aggregate only), occ_health (medical context)';

-- =====================================================
-- User organization access (for managers)
-- =====================================================
CREATE TABLE user_org_access (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_sk BIGINT REFERENCES dim_org(org_sk),
  include_descendants BOOLEAN DEFAULT TRUE, -- Access to child orgs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, org_sk)
);

CREATE INDEX idx_user_org_user ON user_org_access(user_id);
CREATE INDEX idx_user_org_org ON user_org_access(org_sk);

COMMENT ON TABLE user_org_access IS 'Organization-level access for managers. include_descendants grants access to child orgs in hierarchy.';

-- =====================================================
-- Audit log for person-level data access
-- =====================================================
CREATE TABLE audit_log (
  log_id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  action TEXT NOT NULL, -- 'view_person_data', 'export', 'predict', 'view_survey'
  table_name TEXT,
  record_id TEXT,
  person_pseudonym TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_pseudonym ON audit_log(person_pseudonym);

COMMENT ON TABLE audit_log IS 'Audit trail for GDPR compliance. Logs all person-level data access.';

-- =====================================================
-- Helper function: Check if user has org access
-- =====================================================
CREATE OR REPLACE FUNCTION user_has_org_access(target_org_sk BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get user role
  SELECT role INTO user_role
  FROM user_roles
  WHERE user_id = auth.uid();

  -- HR admins and occ_health have full access
  IF user_role IN ('hr_admin', 'occ_health') THEN
    RETURN TRUE;
  END IF;

  -- Managers: check org access (including descendants)
  IF user_role = 'manager' THEN
    RETURN EXISTS (
      SELECT 1
      FROM user_org_access uoa
      WHERE uoa.user_id = auth.uid()
      AND (
        uoa.org_sk = target_org_sk
        OR (
          uoa.include_descendants = TRUE
          AND target_org_sk IN (
            WITH RECURSIVE org_tree AS (
              SELECT org_sk FROM dim_org WHERE org_sk = uoa.org_sk
              UNION ALL
              SELECT o.org_sk FROM dim_org o
              JOIN org_tree ot ON o.parent_org_sk = ot.org_sk
            )
            SELECT org_sk FROM org_tree
          )
        )
      )
    );
  END IF;

  -- Analysts: no person-level access
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Enable RLS on sensitive tables
-- =====================================================
ALTER TABLE dim_employee ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_absence_day ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_absence_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_survey_response ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_activity_hr ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_employee_week ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies: dim_employee
-- =====================================================

-- HR admins and occ_health: full access
CREATE POLICY employee_hr_admin_all ON dim_employee
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('hr_admin', 'occ_health')
    )
  );

-- Managers: only their org hierarchy
CREATE POLICY employee_manager_org ON dim_employee
  FOR SELECT
  USING (user_has_org_access(org_sk));

-- Analysts: no person-level access (use aggregate views)
-- No policy needed - they access via views

-- =====================================================
-- RLS Policies: fact_absence_day
-- =====================================================

CREATE POLICY absence_day_hr_admin ON fact_absence_day
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('hr_admin', 'occ_health')
    )
  );

CREATE POLICY absence_day_manager ON fact_absence_day
  FOR SELECT
  USING (user_has_org_access(org_sk));

-- =====================================================
-- RLS Policies: fact_absence_event
-- =====================================================

CREATE POLICY absence_event_hr_admin ON fact_absence_event
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('hr_admin', 'occ_health')
    )
  );

CREATE POLICY absence_event_manager ON fact_absence_event
  FOR SELECT
  USING (user_has_org_access(org_sk));

-- =====================================================
-- RLS Policies: fact_survey_response
-- =====================================================

CREATE POLICY survey_hr_admin ON fact_survey_response
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('hr_admin', 'occ_health')
    )
  );

CREATE POLICY survey_manager ON fact_survey_response
  FOR SELECT
  USING (user_has_org_access(org_sk));

-- =====================================================
-- RLS Policies: prediction_employee_week
-- =====================================================

CREATE POLICY prediction_hr_admin ON prediction_employee_week
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('hr_admin', 'occ_health')
    )
  );

CREATE POLICY prediction_manager ON prediction_employee_week
  FOR SELECT
  USING (
    person_pseudonym IN (
      SELECT e.person_pseudonym
      FROM dim_employee e
      WHERE user_has_org_access(e.org_sk)
      AND e.is_current = TRUE
    )
  );

-- =====================================================
-- Aggregate views for analysts (no RLS, aggregated data)
-- =====================================================

CREATE OR REPLACE VIEW vw_org_absence_summary AS
SELECT
  o.org_code,
  o.org_name,
  o.region,
  d.iso_year,
  d.iso_week,
  COUNT(DISTINCT ad.employee_sk) AS employees_with_absence,
  COUNT(*) AS total_absence_days,
  COUNT(*) FILTER (WHERE at.code = 'egenmeldt') AS self_cert_days,
  COUNT(*) FILTER (WHERE at.code = 'legemeldt') AS doctor_cert_days,
  ROUND(AVG(ad.absence_minutes) / 60.0, 2) AS avg_absence_hours
FROM fact_absence_day ad
JOIN dim_absence_type at ON at.absence_type_sk = ad.absence_type_sk
JOIN dim_date d ON d.date_sk = ad.date_sk
JOIN dim_org o ON o.org_sk = ad.org_sk
WHERE o.is_current = TRUE
GROUP BY o.org_code, o.org_name, o.region, d.iso_year, d.iso_week;

COMMENT ON VIEW vw_org_absence_summary IS 'Org-level absence aggregates (no PII) for analysts and dashboards';

-- =====================================================
-- View: Risk scores by org (aggregated)
-- =====================================================

CREATE OR REPLACE VIEW vw_org_risk_summary AS
SELECT
  e.org_sk,
  o.org_code,
  o.org_name,
  p.iso_year,
  p.iso_week,
  COUNT(*) AS employee_count,
  ROUND(AVG(p.risk_score_egenmeldt), 3) AS avg_risk_score,
  COUNT(*) FILTER (WHERE p.risk_category = 'high') AS high_risk_count,
  COUNT(*) FILTER (WHERE p.risk_category = 'medium') AS medium_risk_count,
  COUNT(*) FILTER (WHERE p.risk_category = 'low') AS low_risk_count
FROM prediction_employee_week p
JOIN dim_employee e ON e.person_pseudonym = p.person_pseudonym AND e.is_current = TRUE
JOIN dim_org o ON o.org_sk = e.org_sk AND o.is_current = TRUE
GROUP BY e.org_sk, o.org_code, o.org_name, p.iso_year, p.iso_week;

COMMENT ON VIEW vw_org_risk_summary IS 'Org-level risk aggregates (no PII) for managers and analysts';

-- =====================================================
-- Function: Log person-level access (GDPR audit)
-- =====================================================

CREATE OR REPLACE FUNCTION log_person_access(
  p_action TEXT,
  p_table_name TEXT,
  p_record_id TEXT DEFAULT NULL,
  p_person_pseudonym TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_log (
    user_id,
    user_email,
    action,
    table_name,
    record_id,
    person_pseudonym,
    ip_address
  ) VALUES (
    auth.uid(),
    auth.email(),
    p_action,
    p_table_name,
    p_record_id,
    p_person_pseudonym,
    inet_client_addr()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_person_access IS 'Logs person-level data access for GDPR audit trail. Call from application layer.';

-- =====================================================
-- Grant permissions
-- =====================================================

-- Authenticated users can read their accessible data (RLS enforces scope)
GRANT SELECT ON dim_employee TO authenticated;
GRANT SELECT ON fact_absence_day TO authenticated;
GRANT SELECT ON fact_absence_event TO authenticated;
GRANT SELECT ON fact_survey_response TO authenticated;
GRANT SELECT ON prediction_employee_week TO authenticated;

-- All users can read aggregate views
GRANT SELECT ON vw_org_absence_summary TO authenticated;
GRANT SELECT ON vw_org_risk_summary TO authenticated;

-- HR admins can write to person tables
GRANT ALL ON dim_employee TO authenticated; -- RLS restricts to hr_admin
GRANT ALL ON fact_absence_event TO authenticated;
GRANT ALL ON fact_survey_response TO authenticated;

-- Audit log access (read-only for all, insert via function)
GRANT SELECT ON audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION log_person_access TO authenticated;
