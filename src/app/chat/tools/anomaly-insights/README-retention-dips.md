# Retention Dips Detection Tool

## Overview

The `get-detect-retention-dips` tool detects cohort retention anomalies by comparing each cohort's retention rate at different time offsets (k) to a robust cross-cohort baseline for the same offset.

## Purpose

Detect when specific user cohorts show significantly lower retention rates compared to the historical baseline, helping identify:
- Onboarding issues
- Feature launch problems
- Pricing changes impact
- Re-engagement campaign effectiveness

## How It Works

### 1. Cohort Building
- Groups users by when they first appeared (first-seen date)
- Buckets users into periods: day, week, or month
- Tracks user activity across subsequent periods (k=0, k=1, k=2, etc.)

### 2. Retention Calculation
- **k=0**: Cohort size (users active in first period)
- **k≥1**: Retention rate = active_users(k) / cohort_size
- Example: k=1 retention of 25% means 25% of cohort users returned in the next period

### 3. Baseline Computation
- For each offset k, calculates median retention across all cohorts
- Uses Median Absolute Deviation (MAD) for robust statistics
- Creates baseline retention curve: k1→30%, k2→22%, k3→16%, etc.

### 4. Anomaly Detection
Flags retention dips when **ALL** conditions are met:
- Cohort size ≥ `min_cohort_size` (default: 50)
- Effect size ≥ `min_effect_size` (default: 15pp below baseline)
- Z-score ≥ sensitivity threshold (low=3, medium=2.5, high=2)

## Input Parameters

```typescript
{
  websiteId?: string,           // Optional: defaults to active website
  date_from: string,           // "YYYY-MM-DD" - first-seen cohorts lower bound
  date_to: string,             // "YYYY-MM-DD" - first-seen cohorts upper bound
  period?: "day"|"week"|"month", // Default: "week"
  max_k?: number,              // Max offset periods to analyze (default: 12)
  timezone?: string,           // Default: "UTC"
  min_cohort_size?: number,    // Minimum cohort size (default: 50)
  min_effect_size?: number,    // Minimum effect size (default: 0.15 = 15pp)
  sensitivity?: "low"|"medium"|"high", // Z-score threshold (default: "medium")
  return_matrix?: boolean      // Return cohort matrix for charts (default: true)
}
```

## Output Format

```typescript
{
  findings: [
    {
      type: "retention_dip",
      cohort_start: "2025-07-07",    // Cohort start date
      k: 1,                          // Offset period
      metric: "retention",
      value: 0.18,                   // Actual retention (18%)
      expected: 0.26,                // Baseline retention (26%)
      effect_size: 0.08,             // Drop below baseline (8pp)
      z: -2.7,                       // Z-score (statistical significance)
      support: 150,                  // Cohort size
      explanation: "Cohort 2025-07-07 has k=1 retention 18% vs baseline 26%",
      recommended_checks: [
        "review onboarding between k-1 and k",
        "check feature launches or pricing changes in that window",
        "analyze email/push re-engagement for this cohort"
      ]
    }
  ],
  summary: "Detected 1 retention dip(s). Top: cohort 2025-07-07 at k=1 (18% vs 26%).",
  extras: {
    matrix: [                        // Cohort matrix for charting
      { cohort_start: "2025-07-07", k: 1, rate: 0.18, cohort_size: 150 },
      { cohort_start: "2025-07-07", k: 2, rate: 0.12, cohort_size: 150 }
    ],
    baselines: [                     // Baseline retention curve
      { k: 1, baseline: 0.26 },
      { k: 2, baseline: 0.22 }
    ]
  }
}
```

## Database Support

### PostgreSQL/MySQL (Implemented)
- Uses `date_trunc()` for period bucketing
- Computes k offsets using date arithmetic
- Joins first-seen cohorts with activity data

### ClickHouse (Stub)
- Implementation pending
- Will use `toStartOfDay/Week/Month()` functions
- Will use `dateDiff()` for k calculations

## Example Usage

### Basic Detection
```typescript
{
  date_from: "2025-05-01",
  date_to: "2025-08-01",
  period: "week",
  max_k: 8
}
```

### Sensitive Detection
```typescript
{
  date_from: "2025-05-01",
  date_to: "2025-08-01",
  period: "week",
  max_k: 8,
  min_cohort_size: 80,
  min_effect_size: 0.18,    // 18pp below baseline
  sensitivity: "high",       // Z-score ≥ 2.0
  return_matrix: true
}
```

## Statistical Details

### Robust Statistics
- **Median**: Central tendency (resistant to outliers)
- **MAD**: Median Absolute Deviation around median
- **Sigma**: 1.4826 × MAD (robust standard deviation approximation)

### Z-Score Calculation
```
z = (retention_rate - baseline) / sigma
```

### Sensitivity Thresholds
- **Low**: |z| ≥ 3.0 (very conservative, few false positives)
- **Medium**: |z| ≥ 2.5 (balanced, default)
- **High**: |z| ≥ 2.0 (sensitive, more findings)

## Use Cases

1. **Product Launches**: Detect if new features hurt retention
2. **Onboarding**: Identify where users drop off
3. **Marketing**: Measure campaign impact on user retention
4. **Pricing**: Monitor retention after price changes
5. **Seasonal**: Track retention patterns across time

## Performance Considerations

- Index on `(website_id, created_at)` for fast cohort building
- Index on `(website_id, distinct_id, created_at)` for activity tracking
- Query includes 90-day lookback for sufficient cohort data
- Results limited by `max_k` parameter

## Limitations

- Requires sufficient cohort data for statistical significance
- Small cohorts may not meet minimum size requirements
- Weekly/monthly periods need longer date ranges
- Statistical significance depends on cohort variability
