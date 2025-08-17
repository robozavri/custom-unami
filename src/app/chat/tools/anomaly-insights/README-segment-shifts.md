# get-detect-segment-shifts

Detects significant share shifts by segment (country, device, browser, referrer_domain, utm_source, path) comparing current vs previous window.

## What it does

This tool analyzes traffic patterns across different segments to identify unusual changes in user behavior or traffic sources. It compares the current time period with an equal-length previous period to detect statistically significant shifts.

## Detection Types

### 1. **Share Shifts**
- **Positive shifts**: Segment share increased (e.g., US traffic from 20% → 35%)
- **Negative shifts**: Segment share decreased (e.g., mobile traffic from 60% → 45%)

### 2. **Statistical Significance**
- Uses chi-square test for categorical data
- Combines practical significance (effect size) with statistical validation
- Filters out random fluctuations

## How it works

1. **Data Collection**: Fetches segment totals for current and previous periods
2. **Share Calculation**: Computes percentage shares for each segment label
3. **Change Detection**: Identifies segments with significant share changes
4. **Statistical Testing**: Applies chi-square test for validation
5. **Ranking**: Orders findings by effect size and data support

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `websiteId` | string | auto | Website ID (auto-resolved if not provided) |
| `date_from` | string | required | Start date (YYYY-MM-DD) |
| `date_to` | string | required | End date (YYYY-MM-DD) |
| `segment_by` | string/array | required | Segment type(s) to analyze |
| `metric` | string | "visits" | Metric to analyze (visits, pageviews, bounce_rate) |
| `min_effect_size` | number | 0.15 | Minimum change threshold (15 percentage points) |
| `min_share` | number | 0.05 | Minimum segment share to consider (5%) |
| `min_support` | number | 100 | Minimum total data points required |
| `use_chi_square` | boolean | true | Enable statistical testing |
| `normalize_labels` | boolean | true | Normalize segment labels (lowercase) |

## Output Format

```typescript
{
  findings: [
    {
      type: "shift",
      metric: "visits",
      segment_by: "country",
      label: "US",
      value: 0.35,        // Current share (35%)
      expected: 0.20,     // Previous share (20%)
      effect_size: 0.15,  // Change magnitude (15pp)
      p_value: 0.01,      // Statistical significance
      support_curr: 1000, // Current period total
      support_prev: 950,  // Previous period total
      explanation: "country=US share increased by 15pp (20% → 35%)",
      recommended_checks: [
        "inspect campaigns/referrers",
        "review geo/device targeting",
        "check landing page relevance"
      ]
    }
  ],
  summary: "Detected 1 segment shift(s). Top: country=US 15pp change."
}
```

## Database Support

- **PostgreSQL/Prisma**: ✅ Full implementation
- **ClickHouse**: ⏳ Pending implementation (stub exists)

## Use Cases

### 1. **Campaign Analysis**
- Detect UTM source shifts after marketing campaigns
- Identify referrer domain changes

### 2. **Geographic Insights**
- Monitor country/region traffic changes
- Detect geo-targeting effectiveness

### 3. **Device/Platform Monitoring**
- Track mobile vs desktop shifts
- Monitor browser adoption changes

### 4. **Content Performance**
- Analyze path-based traffic shifts
- Identify page popularity changes

## Example Usage

```typescript
// Detect country and device shifts
const result = await detectSegmentShifts({
  date_from: "2025-07-01",
  date_to: "2025-07-14",
  segment_by: ["country", "device"],
  metric: "visits",
  min_effect_size: 0.10,  // 10 percentage points
  min_share: 0.05,        // 5% minimum share
  min_support: 500,       // 500+ visits required
  use_chi_square: true
});

console.log(result.summary);
console.table(result.findings.map(f => ({
  segment: `${f.segment_by}=${f.label}`,
  change: `${(f.effect_size * 100).toFixed(1)}pp`,
  current: `${(f.value * 100).toFixed(1)}%`,
  previous: `${(f.expected * 100).toFixed(1)}%`,
  p_value: f.p_value?.toFixed(4)
})));
```

## Statistical Details

### Chi-Square Test
- **Purpose**: Validate that observed changes are statistically significant
- **Method**: 2×2 contingency table (segment vs other segments)
- **Threshold**: p < 0.05 for statistical significance
- **Correction**: Yates continuity correction applied

### Effect Size Calculation
- **Formula**: Δs = |s_current - s_previous|
- **Units**: Percentage points (0.15 = 15 percentage points)
- **Interpretation**: 
  - 0.05-0.10: Small change
  - 0.10-0.20: Medium change  
  - 0.20+: Large change

### Previous Window Calculation
- **Method**: Equal-length period before current window
- **Example**: Current: Jul 1-14, Previous: Jun 17-30
- **Purpose**: Control for seasonal/weekly patterns

## Performance Considerations

- **Batch Processing**: Handles multiple segments efficiently
- **Database Optimization**: Uses indexed columns (website_id, created_at)
- **Memory Efficient**: Processes data in chunks
- **Timeout Handling**: Configurable query timeouts

## Limitations

1. **Minimum Data Requirements**: Needs sufficient data in both periods
2. **Seasonal Patterns**: May flag normal seasonal changes
3. **Correlation vs Causation**: Identifies changes but not causes
4. **ClickHouse**: Currently PostgreSQL-only (ClickHouse pending)
