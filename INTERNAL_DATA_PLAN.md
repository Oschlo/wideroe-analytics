# Internal Data (HR/People Analytics) - Implementation Plan

## Overview
Phase 2: Add organization-specific internal data sources for HR and People Analytics. This complements the existing open data (weather, health, economic) with proprietary organizational data.

## 🎯 Objectives

1. **Multi-format ingestion** - Support CSV, Excel, JSON, API integrations
2. **Data mapping flexibility** - Unknown schemas, need dynamic field mapping
3. **Historical tracking** - Maintain audit trail and versioning
4. **Admin UI** - Non-technical users can configure data sources
5. **Privacy & Security** - GDPR-compliant, row-level security
6. **Multi-tenant isolation** - Each organization's data is separate

---

## 📊 Data Domains

### 1. HR Master Data (Employee Registry)
**Purpose:** Core employee information - the anchor for all HR analytics

**Expected Fields:**
```typescript
interface Employee {
  employee_id: string;           // Unique identifier
  organization_id: string;        // Multi-tenant key
  full_name: string;
  email: string;
  contract_type: 'permanent' | 'temporary' | 'contractor';
  fte: number;                    // Full-time equivalent (0.0-1.0)
  base_location: string;          // Links to dim_location
  role: string;                   // Job title
  department: string;
  hire_date: date;
  termination_date?: date;
  status: 'active' | 'inactive' | 'on_leave';
  manager_id?: string;            // Self-referencing for org hierarchy

  // Metadata
  data_source: string;            // 'visma', 'manual_upload', 'api_import'
  imported_at: timestamp;
  imported_by: string;
}
```

**Data Sources:**
- Visma HRM (Norway standard)
- SAP SuccessFactors
- Workday
- CSV/Excel manual uploads
- Manual entry via admin UI

**Admin Features:**
- Upload CSV/Excel with column mapping
- View employee list (respecting RLS)
- Deactivate employees
- Bulk import history log

---

### 2. Organizational Structure
**Purpose:** Department hierarchy, cost centers, reporting lines with historical changes

**Expected Fields:**
```typescript
interface OrgStructure {
  org_unit_id: string;
  organization_id: string;
  unit_type: 'department' | 'team' | 'region' | 'cost_center';
  unit_name: string;
  parent_unit_id?: string;        // Hierarchy
  location_sk?: number;           // Geographic tie
  manager_employee_id?: string;

  // Historical tracking
  valid_from: date;
  valid_to?: date;                // Null = current

  // Metadata
  data_source: string;
  imported_at: timestamp;
}
```

**Admin Features:**
- Visual org chart builder
- Historical timeline viewer
- Restructuring event tracker
- Export org structure as JSON

---

### 3. Rosters / Work Schedules
**Purpose:** Planned work schedules - historical + 6-8 weeks forward

**Expected Fields:**
```typescript
interface Roster {
  roster_id: string;
  organization_id: string;
  employee_id: string;
  date: date;

  // Shift details
  shift_type: 'day' | 'evening' | 'night' | 'standby' | 'off';
  start_time?: time;
  end_time?: time;
  hours_planned: number;
  location_sk?: number;           // Work location

  // Flight crew specific (airline)
  flight_route?: string;          // 'OSL-TOS-BOO'
  duty_code?: string;             // Airline-specific codes

  // Metadata
  roster_version: string;         // Track roster changes
  published_at: timestamp;
  data_source: string;
}
```

**Admin Features:**
- Upload roster files (CSV, Excel, PDF parsing)
- Calendar view per employee/department
- Roster version comparison
- Conflict detection (double-booking)

---

### 4. Absence Data
**Purpose:** Sickness absence tracking - the key regression dependent variable

**Two-table approach:**

#### 4a. Absence Episodes (Source)
```typescript
interface AbsenceEpisode {
  episode_id: string;
  organization_id: string;
  employee_id: string;

  // Episode details
  start_date: date;
  end_date?: date;                // Null = ongoing
  absence_type: 'self_certified' | 'doctor_certified' | 'long_term' | 'partial';
  diagnosis_code?: string;        // ICD-10 (if available)
  percentage: number;             // 100 = full absence, 50 = 50% sick

  // Certification
  certified_by: 'self' | 'doctor' | 'specialist';
  return_to_work_date?: date;

  // Metadata
  data_source: string;
  imported_at: timestamp;
}
```

#### 4b. Daily Absence Facts (Derived)
```typescript
interface DailyAbsence {
  organization_id: string;
  employee_id: string;
  date_sk: number;                // YYYYMMDD

  // Absence flags
  is_absent: boolean;
  absence_type: string;
  absence_percentage: number;
  is_self_certified: boolean;
  is_doctor_certified: boolean;

  // Derived from episodes
  absence_duration_days: number;  // How many days into episode
  is_first_day: boolean;
  is_return_to_work: boolean;

  // Context (joins)
  location_sk?: number;           // From roster or employee base
  department?: string;

  // Metadata
  source_episode_id: string;
}
```

**Admin Features:**
- Import absence from HR system (Visma, SAP)
- Manual absence registration
- Episode timeline view
- Privacy-compliant export (anonymized)

---

### 5. Employee Surveys (JDR - Job Demands-Resources)
**Purpose:** Psychological safety, workload, job satisfaction indices

**Expected Fields:**
```typescript
interface SurveyResponse {
  response_id: string;
  organization_id: string;
  employee_id?: string;           // Nullable for anonymous surveys
  survey_id: string;
  survey_date: date;

  // JDR Model Indices (Demerouti & Bakker)
  // Job Demands
  workload_index: number;         // 1-7 scale
  emotional_demands: number;
  cognitive_demands: number;
  time_pressure: number;

  // Job Resources
  autonomy_index: number;
  social_support: number;
  feedback_quality: number;
  development_opportunities: number;

  // Outcomes
  engagement_index: number;       // Utrecht Work Engagement Scale
  burnout_risk: number;           // Maslach Burnout Inventory
  job_satisfaction: number;

  // Demographics (for aggregation)
  department?: string;
  tenure_years?: number;

  // Privacy
  is_anonymous: boolean;
  data_source: string;
}
```

**Admin Features:**
- Upload survey results (CSV, SPSS, Qualtrics export)
- Aggregate department-level scores (preserve anonymity)
- Trend analysis dashboard
- Alert on high burnout risk departments

---

### 6. HR Activities & Interventions
**Purpose:** Track managerial activities - MUS, 1:1s, team interventions

**Expected Fields:**
```typescript
interface HRActivity {
  activity_id: string;
  organization_id: string;
  activity_type: 'mus' | 'one_on_one' | 'team_workshop' | 'conflict_resolution' | 'wellness_program';

  // Participants
  employee_ids: string[];         // Multiple participants
  facilitator_id: string;         // Manager or HR
  department?: string;

  // Timing
  activity_date: date;
  duration_minutes: number;

  // Frequency tracking (for regression)
  is_recurring: boolean;
  recurrence_interval?: string;   // 'weekly', 'monthly', 'quarterly'

  // Outcome (optional)
  outcome_rating?: number;        // 1-5 scale
  action_items?: string[];
  follow_up_date?: date;

  // Metadata
  data_source: string;
  logged_at: timestamp;
}
```

**Admin Features:**
- Log HR activities manually
- Import from calendar integrations (Outlook, Google Calendar)
- Reminder system for overdue MUS/1:1s
- Coverage report (who hasn't had MUS in 12 months?)

---

## 🏗️ Database Schema Design

### Core Tables

```sql
-- ============================================================================
-- INTERNAL DATA SCHEMA (Phase 2)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Employees (HR Master)
CREATE TABLE employees (
  employee_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(organization_id) NOT NULL,

  -- Identity
  external_employee_id TEXT,      -- ID from source system (Visma, SAP)
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,

  -- Employment
  contract_type TEXT CHECK (contract_type IN ('permanent', 'temporary', 'contractor')),
  fte NUMERIC(3,2) CHECK (fte >= 0 AND fte <= 1.0),
  base_location_sk INT REFERENCES dim_location(location_sk),
  role TEXT,
  department TEXT,
  cost_center TEXT,
  hire_date DATE,
  termination_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),

  -- Hierarchy
  manager_employee_id UUID REFERENCES employees(employee_id),

  -- Metadata
  data_source TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  imported_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, external_employee_id)
);

-- 2. Organizational Structure (with temporal validity)
CREATE TABLE org_structure (
  org_unit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(organization_id) NOT NULL,

  unit_type TEXT CHECK (unit_type IN ('department', 'team', 'region', 'cost_center')),
  unit_name TEXT NOT NULL,
  parent_unit_id UUID REFERENCES org_structure(org_unit_id),
  location_sk INT REFERENCES dim_location(location_sk),
  manager_employee_id UUID REFERENCES employees(employee_id),

  -- Temporal validity
  valid_from DATE NOT NULL,
  valid_to DATE,

  -- Metadata
  data_source TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Rosters (Work Schedules)
CREATE TABLE rosters (
  roster_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(organization_id) NOT NULL,
  employee_id UUID REFERENCES employees(employee_id) NOT NULL,

  date DATE NOT NULL,
  shift_type TEXT,
  start_time TIME,
  end_time TIME,
  hours_planned NUMERIC(4,2),
  location_sk INT REFERENCES dim_location(location_sk),

  -- Industry-specific
  flight_route TEXT,
  duty_code TEXT,

  -- Versioning
  roster_version TEXT,
  published_at TIMESTAMPTZ,

  -- Metadata
  data_source TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, employee_id, date, roster_version)
);

-- 4a. Absence Episodes (Source of truth)
CREATE TABLE absence_episodes (
  episode_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(organization_id) NOT NULL,
  employee_id UUID REFERENCES employees(employee_id) NOT NULL,

  start_date DATE NOT NULL,
  end_date DATE,
  absence_type TEXT CHECK (absence_type IN ('self_certified', 'doctor_certified', 'long_term', 'partial')),
  diagnosis_code TEXT,              -- ICD-10
  percentage INT CHECK (percentage BETWEEN 1 AND 100),

  certified_by TEXT CHECK (certified_by IN ('self', 'doctor', 'specialist')),
  return_to_work_date DATE,

  -- Metadata
  data_source TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  imported_by UUID
);

-- 4b. Daily Absence Facts (Derived - materialized view or table)
CREATE TABLE fact_absence_day (
  organization_id UUID REFERENCES organizations(organization_id) NOT NULL,
  employee_id UUID REFERENCES employees(employee_id) NOT NULL,
  date_sk INT NOT NULL,            -- YYYYMMDD

  -- Absence indicators
  is_absent BOOLEAN DEFAULT FALSE,
  absence_type TEXT,
  absence_percentage INT,
  is_self_certified BOOLEAN,
  is_doctor_certified BOOLEAN,

  -- Episode context
  absence_duration_days INT,
  is_first_day BOOLEAN,
  is_return_to_work BOOLEAN,
  source_episode_id UUID REFERENCES absence_episodes(episode_id),

  -- Context (from joins)
  location_sk INT,
  department TEXT,

  -- Metadata
  inserted_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (organization_id, employee_id, date_sk)
);

-- 5. Survey Responses (JDR Model)
CREATE TABLE survey_responses (
  response_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(organization_id) NOT NULL,
  employee_id UUID REFERENCES employees(employee_id),  -- Nullable for anonymous
  survey_id UUID NOT NULL,
  survey_date DATE NOT NULL,

  -- JDR Indices (1-7 scale)
  workload_index NUMERIC(3,2),
  emotional_demands NUMERIC(3,2),
  cognitive_demands NUMERIC(3,2),
  time_pressure NUMERIC(3,2),
  autonomy_index NUMERIC(3,2),
  social_support NUMERIC(3,2),
  feedback_quality NUMERIC(3,2),
  development_opportunities NUMERIC(3,2),

  -- Outcomes
  engagement_index NUMERIC(3,2),
  burnout_risk NUMERIC(3,2),
  job_satisfaction NUMERIC(3,2),

  -- Demographics (for aggregation)
  department TEXT,
  tenure_years INT,

  -- Privacy
  is_anonymous BOOLEAN DEFAULT FALSE,

  -- Metadata
  data_source TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. HR Activities
CREATE TABLE hr_activities (
  activity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(organization_id) NOT NULL,

  activity_type TEXT CHECK (activity_type IN ('mus', 'one_on_one', 'team_workshop', 'conflict_resolution', 'wellness_program')),
  activity_date DATE NOT NULL,
  duration_minutes INT,

  facilitator_id UUID REFERENCES employees(employee_id),
  department TEXT,

  -- Participants (many-to-many via junction table)
  -- See hr_activity_participants below

  -- Recurrence
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_interval TEXT,

  -- Outcome
  outcome_rating INT CHECK (outcome_rating BETWEEN 1 AND 5),
  action_items TEXT[],
  follow_up_date DATE,

  -- Metadata
  data_source TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  logged_by UUID
);

-- Junction table for HR activity participants
CREATE TABLE hr_activity_participants (
  activity_id UUID REFERENCES hr_activities(activity_id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(employee_id),
  PRIMARY KEY (activity_id, employee_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_employees_org_id ON employees(organization_id);
CREATE INDEX idx_employees_status ON employees(organization_id, status);
CREATE INDEX idx_employees_manager ON employees(manager_employee_id);

CREATE INDEX idx_org_structure_org_id ON org_structure(organization_id);
CREATE INDEX idx_org_structure_validity ON org_structure(valid_from, valid_to);

CREATE INDEX idx_rosters_org_employee_date ON rosters(organization_id, employee_id, date);
CREATE INDEX idx_rosters_date ON rosters(date);

CREATE INDEX idx_absence_episodes_org_employee ON absence_episodes(organization_id, employee_id);
CREATE INDEX idx_absence_episodes_dates ON absence_episodes(start_date, end_date);

CREATE INDEX idx_fact_absence_org_date ON fact_absence_day(organization_id, date_sk);
CREATE INDEX idx_fact_absence_employee ON fact_absence_day(employee_id);

CREATE INDEX idx_survey_org_date ON survey_responses(organization_id, survey_date);
CREATE INDEX idx_survey_department ON survey_responses(organization_id, department);

CREATE INDEX idx_hr_activities_org_date ON hr_activities(organization_id, activity_date);
CREATE INDEX idx_hr_activities_type ON hr_activities(organization_id, activity_type);

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_absence_day ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_activities ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see data from their organization
-- (Requires user_organizations table to be created - see Phase 3)

CREATE POLICY "org_isolation_employees" ON employees
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- Repeat for all tables...
-- (Full RLS policies in separate migration file)

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Explode absence episodes into daily facts
CREATE OR REPLACE FUNCTION explode_absence_episode(episode_uuid UUID)
RETURNS VOID AS $$
DECLARE
  episode RECORD;
  current_date DATE;
  duration INT;
BEGIN
  SELECT * INTO episode FROM absence_episodes WHERE episode_id = episode_uuid;

  IF episode.end_date IS NULL THEN
    -- Ongoing episode, explode up to today
    current_date := episode.start_date;
    WHILE current_date <= CURRENT_DATE LOOP
      INSERT INTO fact_absence_day (
        organization_id, employee_id, date_sk,
        is_absent, absence_type, absence_percentage,
        is_self_certified, is_doctor_certified,
        absence_duration_days, is_first_day,
        source_episode_id
      ) VALUES (
        episode.organization_id,
        episode.employee_id,
        TO_CHAR(current_date, 'YYYYMMDD')::INT,
        TRUE,
        episode.absence_type,
        episode.percentage,
        episode.certified_by = 'self',
        episode.certified_by IN ('doctor', 'specialist'),
        current_date - episode.start_date + 1,
        current_date = episode.start_date,
        episode.episode_id
      )
      ON CONFLICT (organization_id, employee_id, date_sk) DO UPDATE
        SET is_absent = EXCLUDED.is_absent,
            absence_type = EXCLUDED.absence_type,
            absence_percentage = EXCLUDED.absence_percentage;

      current_date := current_date + INTERVAL '1 day';
    END LOOP;
  ELSE
    -- Completed episode
    current_date := episode.start_date;
    WHILE current_date <= episode.end_date LOOP
      -- Same logic as above
      current_date := current_date + INTERVAL '1 day';
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-explode episodes on insert
CREATE OR REPLACE FUNCTION trigger_explode_absence()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM explode_absence_episode(NEW.episode_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_absence_episode_insert
  AFTER INSERT ON absence_episodes
  FOR EACH ROW EXECUTE FUNCTION trigger_explode_absence();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE employees IS 'HR master data - employee registry with multi-tenant isolation';
COMMENT ON TABLE org_structure IS 'Organizational hierarchy with temporal validity tracking';
COMMENT ON TABLE rosters IS 'Work schedules - historical + 6-8 weeks forward planning';
COMMENT ON TABLE absence_episodes IS 'Source table for sickness absence episodes';
COMMENT ON TABLE fact_absence_day IS 'Daily absence facts - exploded from episodes for regression analysis';
COMMENT ON TABLE survey_responses IS 'Employee surveys - JDR model indices for wellbeing analysis';
COMMENT ON TABLE hr_activities IS 'HR interventions - MUS, 1:1s, team activities (predictive for absence reduction)';
```

---

## 🎨 Admin UI Design

### New Admin Routes

```
/admin/organizations/[slug]/hr
  ├── /employees          # Employee management
  ├── /org-structure      # Org chart editor
  ├── /rosters           # Roster upload & calendar
  ├── /absence           # Absence tracking
  ├── /surveys           # Survey result uploads
  ├── /activities        # HR activity logging
  └── /data-imports      # Generic import wizard
```

### Key Admin Features

#### 1. **Data Import Wizard** (`/admin/organizations/[slug]/hr/data-imports`)
```typescript
// Multi-step wizard
Step 1: Select data type (employees, rosters, absence, surveys)
Step 2: Upload file (CSV, Excel, JSON) or connect API
Step 3: Map columns to schema
Step 4: Preview & validate
Step 5: Import & confirm

// Column Mapping UI
Source CSV:        Target Field:
┌─────────────┐    ┌──────────────────┐
│ Ansattnr    │ →  │ external_employee_id │
│ Navn        │ →  │ full_name            │
│ Stillingspst│ →  │ fte                  │
│ Base        │ →  │ base_location_sk     │
└─────────────┘    └──────────────────┘

[Auto-detect Norwegian headers] [Save mapping template]
```

#### 2. **Employee Registry** (`/admin/organizations/[slug]/hr/employees`)
- Table view with filters (status, department, location)
- Add/edit employee form
- Bulk upload CSV
- Deactivate/terminate employees
- View employee timeline (hire → promotions → termination)

#### 3. **Org Structure Editor** (`/admin/organizations/[slug]/hr/org-structure`)
- Visual tree/chart view (D3.js or React Flow)
- Drag-and-drop restructuring
- Historical timeline slider
- Export as JSON/CSV

#### 4. **Roster Calendar** (`/admin/organizations/[slug]/hr/rosters`)
- Calendar view (day/week/month)
- Filter by employee/department/location
- Upload roster file with date range
- Conflict detection (overlapping shifts)
- Compare roster versions

#### 5. **Absence Dashboard** (`/admin/organizations/[slug]/hr/absence`)
- Episode list with timeline
- Manual episode registration form
- Bulk import from HR system
- Absence rate charts (by department, location, month)
- Privacy-compliant export (anonymized)

#### 6. **Survey Results** (`/admin/organizations/[slug]/hr/surveys`)
- Upload survey CSV (Qualtrics, SurveyMonkey export)
- Aggregate department scores (preserve anonymity)
- JDR index visualization (radar charts)
- Alert on high burnout risk

#### 7. **HR Activities Log** (`/admin/organizations/[slug]/hr/activities`)
- Log MUS, 1:1, team workshops
- Calendar integration (import from Outlook/Google)
- Overdue reminders (MUS every 12 months)
- Coverage report (who's missing MUS?)

---

## 🔌 Data Integration Strategies

### Strategy 1: Manual CSV/Excel Upload
**Best for:** Initial setup, small organizations, infrequent updates

**Flow:**
1. User downloads template CSV
2. Fills in data (Excel, Google Sheets)
3. Uploads via admin UI
4. System validates & maps columns
5. Preview before import
6. Data inserted with `data_source = 'manual_upload'`

**Pros:** Simple, no technical setup
**Cons:** Manual work, error-prone

---

### Strategy 2: API Integration (Future)
**Best for:** Large organizations, real-time sync

**Supported APIs:**
- Visma HRM API (Norway standard)
- SAP SuccessFactors API
- Workday API
- BambooHR API
- Generic REST API with OAuth

**Flow:**
1. Admin configures API credentials
2. Maps API fields to schema
3. Scheduled sync (daily/weekly)
4. Incremental updates (only changed records)
5. Data versioning & audit log

**Pros:** Automated, always up-to-date
**Cons:** Complex setup, requires IT support

---

### Strategy 3: File Drop (SFTP/Cloud Storage)
**Best for:** Batch exports from legacy systems

**Flow:**
1. HR system exports CSV to SFTP/S3 nightly
2. Edge Function monitors folder
3. Auto-imports new files
4. Archives processed files
5. Email notification on errors

**Pros:** Works with any system
**Cons:** Delayed data, file format issues

---

## 🔒 Privacy & Compliance

### GDPR Considerations

1. **Data Minimization**
   - Only collect necessary fields
   - Configurable retention periods
   - Auto-delete terminated employees after X years

2. **Anonymization**
   - Survey responses can be anonymous
   - Aggregate reports suppress small groups (<5)
   - Export functions have anonymization option

3. **Access Control**
   - RLS policies enforce organization isolation
   - Role-based access (HR admin, manager, analyst)
   - Audit log for all data access

4. **Right to be Forgotten**
   - Employee deletion cascades to related data
   - Option to anonymize instead of delete (preserve analytics)

### Norwegian Labor Law Compliance

- **Arbeidsmiljøloven §14-9**: Employer can process health data if necessary for insurance/absence management
- **Personopplysningsloven**: GDPR implementation in Norway
- **NAV Reporting**: Absence data format compatible with NAV sykefraværsrapportering

---

## 🧪 Regression Analysis Use Cases

### 1. Absence Prediction Model
```python
# Dependent Variable: Y = is_absent (binary) or absence_percentage
# Independent Variables:
X = [
  # Weather predictors
  'cold_shock_lag_3d',          # Cold shock 3 days prior
  'wind_shift_lag_1d',          # Wind shift 1 day prior
  'avg_temp_7d',                # 7-day temperature average

  # Health predictors
  'regional_flu_rate',          # FHI influenza rate in region
  'vaccination_coverage',       # Vaccination rate in employee base

  # Economic predictors
  'cpi_change_mom',             # Economic stress proxy

  # HR predictors (NEW!)
  'workload_index',             # From surveys
  'burnout_risk',               # From surveys
  'mus_last_90d',               # Had MUS in last 90 days (binary)
  'one_on_one_frequency',       # 1:1s per month
  'team_intervention_flag',     # Team workshop in last 30 days

  # Employee attributes
  'tenure_years',
  'fte',
  'role_type',
  'location_sk',                # Fixed effects
]

# Model:
logit(P(absent)) = β₀ + β₁·cold_shock + β₂·workload + β₃·mus_recent + ε
```

**Business Insight:**
- "Employees who had MUS in last 90 days have 23% lower absence risk"
- "High workload index (>5) increases absence probability by 34%"
- "Team workshops reduce next-month absence by 18%"

---

### 2. Intervention Effectiveness
```python
# A/B Test: Does increasing 1:1 frequency reduce absence?

# Treatment group: Managers with monthly 1:1s (>12 per year)
# Control group: Managers with quarterly 1:1s (<4 per year)

# Measure:
#   - Absence days per employee
#   - Burnout index change
#   - Engagement index change

# Regression:
Y = β₀ + β₁·treatment + β₂·controls + ε
```

---

### 3. JDR Model Validation
```python
# Test Job Demands-Resources theory

# Hypothesis: High demands + low resources → burnout → absence

# Path Analysis:
# Step 1: Workload → Burnout (β₁)
# Step 2: Burnout → Absence (β₂)
# Step 3: Social Support moderates Step 1 (β₃·interaction)

# Mediation model:
Y_burnout = β₀ + β₁·workload + β₂·social_support + β₃·(workload × support)
Y_absence = β₀ + β₁·burnout + β₂·controls
```

---

## 📅 Implementation Roadmap

### Phase 2.1: Core Schema & Manual Upload (4 weeks)
- ✅ Create database schema (employees, absence, rosters)
- ✅ Build import wizard UI
- ✅ CSV column mapping functionality
- ✅ Basic employee registry admin page
- ✅ Absence episode entry form

### Phase 2.2: Absence Analytics (2 weeks)
- ✅ Daily absence explosion logic
- ✅ Absence dashboard (rates, trends)
- ✅ Privacy-compliant export
- ✅ Integration with weather data (join on location_sk + date)

### Phase 2.3: Survey & HR Activities (3 weeks)
- ✅ Survey upload (CSV from Qualtrics)
- ✅ JDR index calculation
- ✅ HR activity logging
- ✅ MUS/1:1 reminder system

### Phase 2.4: Advanced Features (3 weeks)
- ✅ Org structure visual editor
- ✅ Roster calendar view
- ✅ API integration framework (Visma)
- ✅ Automated file drop processing

### Phase 2.5: Regression Models (2 weeks)
- ✅ Create combined dataset view (weather + HR + absence)
- ✅ Regression model builder UI
- ✅ Python/R code generation for models
- ✅ Model validation & interpretation

**Total:** ~14 weeks (3.5 months)

---

## 🚀 Next Steps

1. **User Research**
   - Interview Widerøe HR team
   - Get sample data files (CSV, Excel)
   - Understand current HR systems (Visma? SAP?)
   - Identify pain points in current reporting

2. **Data Mapping Workshop**
   - Map Widerøe's fields to our schema
   - Create organization-specific templates
   - Document data quality issues

3. **Prototype Import Wizard**
   - Build column mapping UI
   - Test with real Widerøe data
   - Validate data quality checks

4. **Schema Migration**
   - Create migration 20240119000000_internal_data_schema.sql
   - Apply to staging environment
   - Load test data

5. **Admin UI Development**
   - Build employee registry page
   - Build import wizard
   - Build absence dashboard

---

## 📊 Success Metrics

**Technical:**
- ✅ Import 10,000+ employee records without errors
- ✅ Process 1 year of absence data (365 days × 500 employees)
- ✅ Sub-second query performance on absence analytics
- ✅ Zero data leakage between organizations (RLS verification)

**Business:**
- ✅ HR admins can upload data without IT support
- ✅ Absence prediction model achieves R² > 0.3
- ✅ Identify top 3 predictors of absence (weather, workload, interventions)
- ✅ ROI: 10% absence reduction = NOK 5-10M savings for Widerøe

---

**Status:** 📋 Planning Complete - Ready for User Research
**Next Action:** Schedule workshop with Widerøe HR team to review data formats
