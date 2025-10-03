# Placebo/Gimmick Variables - Implementation Plan

## 🎭 Overview
Phase 2B: Add "fun" open-source variables for robustness testing and spurious correlation detection. These serve both scientific and entertainment purposes.

### Scientific Purpose
1. **Robustness Testing** - If moon phase predicts absence better than workload, your model has issues
2. **Spurious Correlation Detection** - Test if correlations are genuine or random noise
3. **Null Hypothesis Baseline** - Compare real predictors against "placebo" variables
4. **Model Validation** - Good models should NOT find moon phase significant

### Entertainment Purpose
1. **Viral Dashboards** - "17. mai reduces absence by 80%" (duh!)
2. **Data Literacy** - Teach correlation ≠ causation
3. **Conference Talks** - Fun examples for presentations
4. **Media Coverage** - "Norwegian airline uses moon phases in HR analytics" 😄

---

## 📊 Data Domains

### 1. Moon Phases & Lunar Data
**Purpose:** Test if lunar cycles correlate with human behavior (spoiler: they don't, but fun to check!)

**Expected Fields:**
```typescript
interface MoonPhaseDay {
  date_sk: number;              // YYYYMMDD

  // Phase
  moon_phase: string;           // 'new_moon', 'waxing_crescent', 'first_quarter',
                                // 'waxing_gibbous', 'full_moon', 'waning_gibbous',
                                // 'last_quarter', 'waning_crescent'
  phase_percentage: number;     // 0-100 (0 = new moon, 100 = full moon)

  // Illumination
  illumination_pct: number;     // Visible surface lit (0-100%)

  // Special events
  is_supermoon: boolean;        // Moon at perigee (closest to Earth)
  is_blue_moon: boolean;        // Second full moon in calendar month
  is_blood_moon: boolean;       // Total lunar eclipse

  // Distance
  distance_km: number;          // Earth-Moon distance
  is_perigee: boolean;          // Closest point (supermoon)
  is_apogee: boolean;           // Farthest point

  // Tide influence (for coastal locations)
  tide_coefficient: number;     // 20-120 (higher = stronger tides)

  // Metadata
  data_source: string;          // 'nasa_api', 'usno_api', 'calculated'
  inserted_at: timestamp;
}
```

**Data Sources:**
- **NASA API** - https://api.nasa.gov/planetary/apod
- **USNO (US Naval Observatory)** - https://aa.usno.navy.mil/data/api
- **Algorithm** - Calculate phases using Jean Meeus algorithm (Astronomical Algorithms)

**API Example (USNO):**
```bash
curl "https://aa.usno.navy.mil/api/moon/phases/year?year=2025"
# Returns: { phases: [{ phase: "Full Moon", date: "2025-01-13", time: "22:27" }] }
```

**Regression Use:**
```python
# Hypothesis: Full moon increases absence (werewolf theory 🐺)
X = ['is_full_moon', 'illumination_pct', 'is_supermoon']
Y = 'is_absent'

# Expected result: β ≈ 0 (no effect)
# If significant → spurious correlation or model overfitting
```

---

### 2. Major Sports Events
**Purpose:** Test if national distractions (World Cup, Olympics) affect absence patterns

**Expected Fields:**
```typescript
interface SportingEvent {
  event_id: string;
  date: date;
  event_type: string;           // 'world_cup', 'olympics', 'euro_championship',
                                // 'cup_final', 'derby', 'cross_country_skiing'

  // Event details
  sport: string;                // 'football', 'handball', 'cross_country_skiing', 'biathlon'
  event_name: string;           // "Norway vs. Brazil - World Cup Round of 16"
  event_importance: number;     // 1-5 scale (5 = World Cup Final)

  // Norwegian involvement
  norway_participating: boolean;
  norway_won: boolean;

  // Timing (important for absence)
  event_time: time;             // e.g., "14:00" (afternoon game)
  is_workday: boolean;          // True if Mon-Fri
  is_evening: boolean;          // After 18:00

  // Expected impact
  expected_viewership_pct: number;  // % of population watching (estimated)

  // Metadata
  data_source: string;          // 'manual_entry', 'api_football', 'wikipedia'
  inserted_at: timestamp;
}
```

**Notable Events to Include:**
- ⚽ **FIFA World Cup** (every 4 years) - High impact if Norway qualifies (rare!)
- 🥇 **Olympics** (Summer/Winter) - Winter Olympics especially (Norway dominates)
- 🎿 **Cross-Country Skiing** - World Championships, Holmenkollen
- 🎯 **Handball** - Norway often in finals
- ⚽ **Norwegian Cup Final** (Cupfinalen) - National holiday vibes
- ⚽ **Derby matches** - Rosenborg vs. Molde, Vålerenga vs. Lillestrøm

**Data Sources:**
- **API-Football** - https://www.api-football.com/
- **TheSportsDB** - https://www.thesportsdb.com/api.php
- **Manual Curation** - Wikipedia "Norwegian sports in YYYY"

**Regression Use:**
```python
# Hypothesis: Big sports events increase absence next day (hangover effect)
X = [
  'sporting_event_yesterday',
  'norway_won_yesterday',
  'event_importance',
  'norway_participating'
]
Y = 'is_absent'

# Expected: Small positive effect if Norway won + workday game
# "Norway beating Brazil → +5% absence next day"
```

---

### 3. Cultural Events & National Holidays
**Purpose:** Control for Norwegian cultural calendar that affects absence/attendance

**Expected Fields:**
```typescript
interface CulturalEvent {
  event_id: string;
  date: date;
  event_type: string;           // 'national_holiday', 'festival', 'religious', 'regional'

  // Event details
  event_name: string;           // "17. mai (Constitution Day)", "Russ Celebration", "St. Hans"
  description: string;

  // Scope
  is_national: boolean;
  regions_affected: string[];   // ['Oslo', 'Trøndelag'] or ['ALL']

  // Work impact
  is_public_holiday: boolean;   // Official day off
  is_red_day: boolean;          // "Rød dag" (banks closed)
  typical_absence_pct: number;  // Historical absence rate

  // Cultural significance (1-5)
  cultural_importance: number;  // 5 = 17. mai, 1 = minor local festival

  // Timing patterns
  is_multi_day: boolean;        // e.g., Easter (5 days)
  start_date: date;
  end_date: date;

  // Metadata
  data_source: string;
  inserted_at: timestamp;
}
```

**Norwegian Cultural Calendar (Key Events):**

| Date | Event | Type | Impact |
|------|-------|------|--------|
| Jan 1 | Nyttårsdag (New Year) | Public Holiday | 100% off |
| Mar/Apr | Easter (5 days) | Public Holiday | 100% off |
| May 1 | 1. mai (Labor Day) | Public Holiday | 100% off |
| May 17 | **17. mai (Constitution Day)** | National Holiday | 99% off (biggest) |
| May 17-31 | Russetid (Russ season) | Cultural | +20% youth absence |
| Jun 23 | St. Hans (Midsummer) | Cultural | +10% absence |
| Oct 31 | Halloween | Cultural (new) | +5% absence |
| Dec 24-26 | Christmas | Public Holiday | 100% off |
| Dec 31 | New Year's Eve | Cultural | 80% off |

**Regional Events:**
- **Øya Festival** (Oslo, August) - +15% Oslo absence
- **Gladmat Festival** (Stavanger, July)
- **Trøndelag Food Festival** (Trondheim)
- **Midnight Sun Marathon** (Tromsø, June)

**Data Sources:**
- **Norsk Kalender API** - https://kayaposoft.com/enrico/
- **Timeanddate.com API** - https://timeanddate.com/services/api
- **Manual Curation** - Wikipedia "Public holidays in Norway"

**Regression Use:**
```python
# Hypothesis: Days before/after 17. mai have high absence (preparation/recovery)
X = [
  'days_until_17mai',       # -7 to 0
  'days_after_17mai',       # 0 to 7
  'is_russ_period',         # May 1-31
  'festival_in_region'      # Local festivals
]
Y = 'is_absent'

# Expected: Strong effect for 17. mai proximity
# "Absence increases 30% in week before 17. mai"
```

---

## 🗄️ Database Schema

```sql
-- ============================================================================
-- PLACEBO / GIMMICK VARIABLES (Phase 2B)
-- ============================================================================

-- 1. Moon Phases (Daily)
CREATE TABLE fact_moon_phase_day (
  date_sk INT PRIMARY KEY,      -- YYYYMMDD

  -- Phase
  moon_phase TEXT CHECK (moon_phase IN (
    'new_moon', 'waxing_crescent', 'first_quarter', 'waxing_gibbous',
    'full_moon', 'waning_gibbous', 'last_quarter', 'waning_crescent'
  )),
  phase_percentage NUMERIC(5,2) CHECK (phase_percentage BETWEEN 0 AND 100),

  -- Illumination
  illumination_pct NUMERIC(5,2) CHECK (illumination_pct BETWEEN 0 AND 100),

  -- Special events
  is_supermoon BOOLEAN DEFAULT FALSE,
  is_blue_moon BOOLEAN DEFAULT FALSE,
  is_blood_moon BOOLEAN DEFAULT FALSE,

  -- Distance
  distance_km NUMERIC(10,2),
  is_perigee BOOLEAN DEFAULT FALSE,
  is_apogee BOOLEAN DEFAULT FALSE,

  -- Tide coefficient (20-120)
  tide_coefficient INT CHECK (tide_coefficient BETWEEN 20 AND 120),

  -- Metadata
  data_source TEXT,
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sporting Events
CREATE TABLE sporting_events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,

  event_type TEXT CHECK (event_type IN (
    'world_cup', 'olympics', 'euro_championship', 'world_championship',
    'cup_final', 'derby', 'cross_country_skiing', 'biathlon', 'handball'
  )),

  sport TEXT,
  event_name TEXT NOT NULL,
  event_importance INT CHECK (event_importance BETWEEN 1 AND 5),

  -- Norwegian involvement
  norway_participating BOOLEAN DEFAULT FALSE,
  norway_won BOOLEAN,
  norway_medal_color TEXT CHECK (norway_medal_color IN ('gold', 'silver', 'bronze')),

  -- Timing
  event_time TIME,
  is_workday BOOLEAN,
  is_evening BOOLEAN,

  -- Impact estimation
  expected_viewership_pct INT,

  -- Metadata
  data_source TEXT,
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Cultural Events
CREATE TABLE cultural_events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,

  event_type TEXT CHECK (event_type IN (
    'national_holiday', 'festival', 'religious', 'regional', 'celebration'
  )),

  event_name TEXT NOT NULL,
  description TEXT,

  -- Scope
  is_national BOOLEAN DEFAULT FALSE,
  regions_affected TEXT[],

  -- Work impact
  is_public_holiday BOOLEAN DEFAULT FALSE,
  is_red_day BOOLEAN DEFAULT FALSE,
  typical_absence_pct INT,

  -- Cultural significance
  cultural_importance INT CHECK (cultural_importance BETWEEN 1 AND 5),

  -- Multi-day events
  is_multi_day BOOLEAN DEFAULT FALSE,
  start_date DATE,
  end_date DATE,

  -- Metadata
  data_source TEXT,
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_moon_phase_date ON fact_moon_phase_day(date_sk);
CREATE INDEX idx_sporting_events_date ON sporting_events(date);
CREATE INDEX idx_sporting_events_norway ON sporting_events(norway_participating, date);
CREATE INDEX idx_cultural_events_date ON cultural_events(date);
CREATE INDEX idx_cultural_events_national ON cultural_events(is_national, date);

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View: Combine all "gimmick" variables for a date
CREATE OR REPLACE VIEW v_placebo_variables AS
SELECT
  d.date_sk,

  -- Moon
  m.moon_phase,
  m.illumination_pct,
  m.is_supermoon,
  m.is_full_moon,

  -- Sports (check if event on this date)
  EXISTS (SELECT 1 FROM sporting_events s WHERE s.date::TEXT = d.date_sk::TEXT) AS has_sporting_event,
  EXISTS (SELECT 1 FROM sporting_events s WHERE s.date::TEXT = d.date_sk::TEXT AND s.norway_participating) AS norway_playing,

  -- Cultural
  EXISTS (SELECT 1 FROM cultural_events c WHERE c.date::TEXT = d.date_sk::TEXT) AS has_cultural_event,
  EXISTS (SELECT 1 FROM cultural_events c WHERE c.date::TEXT = d.date_sk::TEXT AND c.is_public_holiday) AS is_public_holiday

FROM dim_date d
LEFT JOIN fact_moon_phase_day m ON m.date_sk = d.date_sk
ORDER BY d.date_sk;

COMMENT ON VIEW v_placebo_variables IS 'All gimmick/placebo variables by date for robustness testing';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Calculate moon phase for a date (Jean Meeus algorithm)
CREATE OR REPLACE FUNCTION calculate_moon_phase(target_date DATE)
RETURNS TEXT AS $$
DECLARE
  jd NUMERIC;
  phase_angle NUMERIC;
  phase_name TEXT;
BEGIN
  -- Simplified Julian Day calculation
  jd := target_date - DATE '2000-01-01' + 2451545.0;

  -- Moon phase angle (0-360 degrees)
  phase_angle := MOD((jd - 2451550.1) / 29.53058867 * 360, 360);

  -- Classify phase
  IF phase_angle < 22.5 OR phase_angle >= 337.5 THEN
    phase_name := 'new_moon';
  ELSIF phase_angle < 67.5 THEN
    phase_name := 'waxing_crescent';
  ELSIF phase_angle < 112.5 THEN
    phase_name := 'first_quarter';
  ELSIF phase_angle < 157.5 THEN
    phase_name := 'waxing_gibbous';
  ELSIF phase_angle < 202.5 THEN
    phase_name := 'full_moon';
  ELSIF phase_angle < 247.5 THEN
    phase_name := 'waning_gibbous';
  ELSIF phase_angle < 292.5 THEN
    phase_name := 'last_quarter';
  ELSE
    phase_name := 'waning_crescent';
  END IF;

  RETURN phase_name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_moon_phase IS 'Calculate moon phase for any date (simplified Jean Meeus algorithm)';

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Seed Norwegian Cultural Events (2024-2025)
INSERT INTO cultural_events (date, event_type, event_name, is_national, is_public_holiday, cultural_importance, regions_affected) VALUES
  ('2024-01-01', 'national_holiday', 'Nyttårsdag (New Year)', TRUE, TRUE, 5, '{ALL}'),
  ('2024-05-01', 'national_holiday', '1. mai (Labor Day)', TRUE, TRUE, 4, '{ALL}'),
  ('2024-05-17', 'national_holiday', '17. mai (Constitution Day)', TRUE, TRUE, 5, '{ALL}'),
  ('2024-05-17', 'celebration', 'Russetid Start', TRUE, FALSE, 3, '{ALL}'),
  ('2024-06-23', 'cultural', 'St. Hans (Midsummer)', TRUE, FALSE, 3, '{ALL}'),
  ('2024-12-24', 'national_holiday', 'Julaften (Christmas Eve)', TRUE, TRUE, 5, '{ALL}'),
  ('2024-12-25', 'national_holiday', '1. juledag', TRUE, TRUE, 5, '{ALL}'),
  ('2024-12-26', 'national_holiday', '2. juledag', TRUE, TRUE, 4, '{ALL}'),
  ('2025-01-01', 'national_holiday', 'Nyttårsdag (New Year)', TRUE, TRUE, 5, '{ALL}'),
  ('2025-05-01', 'national_holiday', '1. mai (Labor Day)', TRUE, TRUE, 4, '{ALL}'),
  ('2025-05-17', 'national_holiday', '17. mai (Constitution Day)', TRUE, TRUE, 5, '{ALL}');

-- Seed Major Sporting Events (example)
INSERT INTO sporting_events (date, event_type, sport, event_name, event_importance, norway_participating, norway_won, expected_viewership_pct) VALUES
  ('2024-08-11', 'olympics', 'handball', 'Paris 2024 - Women Handball Final', 5, TRUE, TRUE, 85),
  ('2024-03-16', 'world_championship', 'biathlon', 'Biathlon World Cup - Holmenkollen', 4, TRUE, TRUE, 60),
  ('2025-02-23', 'world_championship', 'cross_country_skiing', 'Ski-VM Trondheim 2025', 5, TRUE, NULL, 90);

-- Seed Moon Phases (calculate for date range)
INSERT INTO fact_moon_phase_day (date_sk, moon_phase, illumination_pct, phase_percentage)
SELECT
  TO_CHAR(d, 'YYYYMMDD')::INT AS date_sk,
  calculate_moon_phase(d) AS moon_phase,
  ROUND((1 + COS(RADIANS(MOD((d - DATE '2000-01-06') / 29.53 * 360, 360)))) / 2 * 100, 2) AS illumination_pct,
  MOD((d - DATE '2000-01-06') / 29.53 * 100, 100) AS phase_percentage
FROM generate_series('2024-01-01'::DATE, '2025-12-31'::DATE, '1 day'::INTERVAL) d;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE fact_moon_phase_day IS 'Daily moon phases for placebo/robustness testing. Expected β ≈ 0 in valid models.';
COMMENT ON TABLE sporting_events IS 'Major sporting events (World Cup, Olympics) - test if distractions affect absence';
COMMENT ON TABLE cultural_events IS 'Norwegian cultural calendar (17. mai, festivals) - control for known absence spikes';
```

---

## 🎨 Admin UI Extensions

### New Admin Section: `/admin/organizations/[slug]/placebo`

**Features:**
1. **Moon Phase Calendar**
   - Visual calendar showing moon phases
   - Highlight supermoons, blue moons
   - "Test Moon Hypothesis" button → runs regression

2. **Event Manager**
   - Add sporting events manually
   - Import from TheSportsDB API
   - Flag Norway involvement
   - Predict impact (low/medium/high)

3. **Cultural Calendar**
   - Pre-loaded Norwegian holidays
   - Add regional festivals
   - Multi-day event editor
   - Expected absence % input

4. **Robustness Testing Dashboard**
   - Compare model performance with/without placebo vars
   - "Spurious Correlation Detector"
   - Show if moon phase beats real predictors (= model fail!)

---

## 📈 Regression Analysis Examples

### Example 1: Null Hypothesis Test
```python
# Model A: Real predictors only
Y = β₀ + β₁·cold_shock + β₂·workload_index + ε
# R² = 0.35

# Model B: Add moon phase
Y = β₀ + β₁·cold_shock + β₂·workload_index + β₃·is_full_moon + ε
# R² = 0.36 (barely changed)

# Interpretation:
# If β₃ is significant → model overfitting
# If β₃ ≈ 0 → model is robust (good!)
```

---

### Example 2: Spurious Correlation Hunt
```python
# Test ALL gimmick variables
X_placebo = ['moon_phase', 'is_supermoon', 'norway_won_yesterday', 'days_to_17mai']

# Run regression
# If any p < 0.05 → investigate why
# Likely causes:
#   1. Confounding (17. mai is in May → seasonal effect)
#   2. Overfitting (too many variables, small sample)
#   3. Genuine correlation (Norway wins → celebration → hangover)
```

---

### Example 3: Media-Friendly Results
```python
# "Norway winning at Olympics increases absence by 8%"
# (Genuine effect - celebration/hangover)

# "Full moon increases absence by 0.2%"
# (Spurious - within noise margin)

# "17. mai week absence is 95% higher than normal"
# (Duh! It's a national holiday 😄)

# Dashboard headline:
# "Your model thinks moon phases matter. Time to add more real data!"
```

---

## 🚀 Implementation Plan

### Week 1: Moon Phase Data
- ✅ Create `fact_moon_phase_day` table
- ✅ Implement Jean Meeus algorithm function
- ✅ Calculate phases for 2024-2025 (730 days)
- ✅ Create moon phase calendar UI
- ✅ Add NASA API integration (optional)

### Week 2: Sporting Events
- ✅ Create `sporting_events` table
- ✅ Manual entry of 2024 major events (Olympics, World Cup qualifiers)
- ✅ API integration with TheSportsDB
- ✅ Flag Norway participation
- ✅ Event impact predictor

### Week 3: Cultural Events
- ✅ Create `cultural_events` table
- ✅ Seed Norwegian public holidays (2024-2026)
- ✅ Add regional festivals (Øya, Gladmat, etc.)
- ✅ Multi-day event editor UI
- ✅ Typical absence % input

### Week 4: Robustness Testing Tools
- ✅ Create `v_placebo_variables` view
- ✅ Build "Spurious Correlation Detector" dashboard
- ✅ Model comparison tool (with/without placebo)
- ✅ Alert system (if moon phase is significant)

**Total:** ~4 weeks (parallel with Internal Data Phase 2)

---

## 🎓 Educational Use Cases

### 1. Statistics Workshops
- **Teach:** Correlation ≠ Causation
- **Example:** "Full moon correlates with Friday (more full moons on Fri in our dataset) → spurious"

### 2. Model Validation Training
- **Teach:** How to detect overfitting
- **Example:** "If adding moon phase improves R² → you're fitting noise"

### 3. Media Literacy
- **Teach:** How to spot BS data stories
- **Example:** "Norwegian study finds moon phases predict sickness! (p=0.049, n=15)"

### 4. Conference Presentations
- **Hook:** Start with "We tested if moon phases predict absence"
- **Reveal:** "They don't, but workload index does (β=0.23, p<0.001)"
- **Lesson:** Importance of placebo variables in model validation

---

## 🎯 Success Metrics

**Technical:**
- ✅ Moon phase data for 365+ days with <1% errors
- ✅ 50+ sporting events catalogued (2024-2025)
- ✅ 100% coverage of Norwegian public holidays
- ✅ Robustness test runs in <5 seconds

**Scientific:**
- ✅ Demonstrate null effect of moon phases (β ≈ 0, p > 0.05)
- ✅ Identify genuine effects (e.g., 17. mai, sports wins)
- ✅ Catch overfitting in test models

**Business/PR:**
- ✅ Generate 1 viral LinkedIn post ("We tested moon phases...")
- ✅ Use in 3+ conference presentations
- ✅ Media coverage in tech/HR blogs

---

## 📚 Data Sources Summary

| Variable | Primary Source | Backup Source | Update Frequency |
|----------|---------------|---------------|------------------|
| Moon Phases | Jean Meeus Algorithm | NASA API | One-time calc |
| Sporting Events | TheSportsDB API | Manual curation | Weekly during season |
| Cultural Events | Timeanddate.com | Wikipedia | Yearly |
| Norwegian Holidays | Enrico API | Hardcoded list | Yearly |
| Regional Festivals | Manual | Municipality websites | Yearly |

---

## 🎪 Fun Dashboard Ideas

### "Correlation Circus" 🎪
- Scrolling list of absurd correlations
- "Supermoons correlate with... coffee sales! (r=0.23)"
- "17. mai correlates with... everything in May! (duh!)"
- Educational: Hover to see why it's spurious

### "Placebo Leaderboard" 🏆
- Rank gimmick variables by R²
- Top 3 get 🥇🥈🥉
- If any beat real predictors → 🚨 OVERFITTING ALERT

### "Moon Phase Predictor" 🌙
- Enter date → get moon phase + predicted absence
- Shows: "Full moon tonight! Absence risk: +0.2% (not significant)"
- Compare to: "Cold shock tonight! Absence risk: +12% (p<0.001)"

---

**Status:** 📋 Planning Complete - Ready for Implementation
**Next Action:** Start with Moon Phase calculations (easiest, pure math)
**Fun Factor:** 🎉🎉🎉🎉🎉 (5/5 - will generate great content!)
