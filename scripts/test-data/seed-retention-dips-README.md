# Retention Dips Seed Script

## Overview

This script generates test data for the `get-detect-retention-dips` tool, creating weekly cohorts with engineered retention anomalies to test the tool's detection capabilities.

## Data Structure

### Cohort Generation
- **Period**: Weekly cohorts (Monday-based)
- **Date Range**: July 1 to August 30, 2025 (9 weeks)
- **Cohort Size**: 200 users per cohort (configurable)
- **Tracking**: 8 offset periods (k=0 to k=8)

### Retention Patterns

#### Baseline Pattern (Normal Cohorts)
```
k=0: 100% (200 users active in first period)
k=1: 35% retention (70 users return)
k=2: 25% retention (50 users return)
k=3: 18% retention (36 users return)
k=4: 14% retention (28 users return)
k=5: 12% retention (24 users return)
k=6: 10% retention (20 users return)
k=7: 9% retention (18 users return)
k=8: 8% retention (16 users return)
```

#### Anomaly Pattern (July 15 Cohort)
```
k=0: 100% (200 users active in first period)
k=1: 20% retention (40 users return) - DIP! -15pp vs baseline
k=2: 15% retention (30 users return) - DIP! -10pp vs baseline
k=3: 12% retention (24 users return) - DIP! -6pp vs baseline
k=4: 10% retention (20 users return) - DIP! -4pp vs baseline
k=5: 8% retention (16 users return) - DIP! -4pp vs baseline
k=6: 7% retention (14 users return) - DIP! -3pp vs baseline
k=7: 6% retention (12 users return) - DIP! -3pp vs baseline
k=8: 5% retention (10 users return) - DIP! -3pp vs baseline
```

## Usage

### Basic Usage
```bash
# Generate data for July 1 - August 30, 2025
node scripts/test-data/seed-retention-dips.js

# Generate data for custom date range
node scripts/test-data/seed-retention-dips.js --from 2025-06-01 --to 2025-09-30

# Use custom website ID
node scripts/test-data/seed-retention-dips.js --website 123e4567-e89b-12d3-a456-426614174000

# Custom cohort size
node scripts/test-data/seed-retention-dips.js --cohort-size 300

# Custom anomaly cohort
node scripts/test-data/seed-retention-dips.js --anomaly-cohort 2025-07-22

# Reset existing data in range
node scripts/test-data/seed-retention-dips.js --reset-range
```

### Command Line Options
- `--website, --websiteId`: Website ID to use (default: hardcoded UUID)
- `--from, --start`: Start date for cohorts (default: 2025-07-01)
- `--to, --end`: End date for cohorts (default: 2025-08-30)
- `--cohort-size`: Number of users per cohort (default: 200)
- `--anomaly-cohort`: Specific cohort date to make anomalous (default: 2025-07-15)
- `--reset-range`: Delete existing data in the date range before seeding

## Expected Anomalies

### Primary Detection Target
The **July 15, 2025** cohort is engineered to show significant retention dips:

- **k=1**: 20% vs 35% baseline (-15 percentage points)
- **k=2**: 15% vs 25% baseline (-10 percentage points)
- **k=3**: 12% vs 18% baseline (-6 percentage points)

### Detection Thresholds
With default tool parameters:
- `min_effect_size: 0.15` (15pp) - Will catch k=1 dip
- `min_effect_size: 0.10` (10pp) - Will catch k=1 and k=2 dips
- `min_effect_size: 0.05` (5pp) - Will catch all dips

## Tool Testing Examples

### Basic Detection
```typescript
{
  date_from: "2025-07-01",
  date_to: "2025-08-30",
  period: "week",
  max_k: 8
}
```

### Sensitive Detection (Recommended for Testing)
```typescript
{
  date_from: "2025-07-01",
  date_to: "2025-08-30",
  period: "week",
  max_k: 8,
  min_effect_size: 0.05,    // 5pp threshold
  sensitivity: "medium",     // Z-score ≥ 2.5
  return_matrix: true        // Get cohort data for charts
}
```

### Conservative Detection
```typescript
{
  date_from: "2025-07-01",
  date_to: "2025-08-30",
  period: "week",
  max_k: 8,
  min_effect_size: 0.15,    // 15pp threshold
  sensitivity: "low",        // Z-score ≥ 3.0
  return_matrix: false
}
```

## Data Volume

### Per Cohort
- **Sessions**: 200 (one per user)
- **Events**: 200 (one pageview per user)
- **Total per cohort**: 400 records

### Total Data
- **Cohorts**: 9 weeks
- **Total sessions**: ~1,800
- **Total events**: ~1,800
- **Total records**: ~3,600

## Verification

### Check Data Presence
```sql
-- Verify cohorts exist
SELECT 
  DATE_TRUNC('week', created_at) as cohort_week,
  COUNT(DISTINCT session_id) as users
FROM website_event 
WHERE website_id = '5801af32-ebe2-4273-9e58-89de8971a2fd'
  AND created_at >= '2025-07-01'
  AND created_at <= '2025-08-30'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY cohort_week;

-- Check anomaly cohort (July 15)
SELECT 
  DATE_TRUNC('week', created_at) as cohort_week,
  COUNT(DISTINCT session_id) as users
FROM website_event 
WHERE website_id = '5801af32-ebe2-4273-9e58-89de8971a2fd'
  AND created_at >= '2025-07-15'
  AND created_at < '2025-07-22'
GROUP BY DATE_TRUNC('week', created_at);
```

### Expected Results
- **July 15 cohort**: ~200 users (anomaly)
- **Other cohorts**: ~200 users each (baseline)
- **Total unique users**: ~1,800 across all cohorts

## Troubleshooting

### Common Issues

1. **No data generated**
   - Check website ID exists in database
   - Verify date range is valid
   - Check database connection

2. **Wrong cohort sizes**
   - Verify `DEFAULT_COHORT_SIZE` setting
   - Check for data conflicts

3. **Anomaly not detected**
   - Ensure `min_effect_size` is low enough (try 0.05)
   - Check that anomaly cohort date matches exactly
   - Verify sufficient data exists for statistical significance

### Debug Mode
Add console.log statements in the script to see:
- Cohort generation details
- Data creation counts
- Database operation results

## Performance Notes

- **Batch operations**: Uses `createMany` for efficiency
- **Skip duplicates**: Prevents duplicate key errors
- **Cleanup**: Respects foreign key constraints
- **Memory**: Generates data in chunks to avoid memory issues

## Next Steps

After seeding:
1. **Test the tool** with various parameters
2. **Verify anomalies** are detected as expected
3. **Adjust thresholds** to test sensitivity
4. **Generate charts** using the matrix data
5. **Clean up** when done testing
