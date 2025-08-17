# Path Drop-off Detection Tool

The `get-detect-path-dropoffs` tool analyzes user navigation patterns to identify unusual drop-offs in conversion funnels and user journeys.

## What it detects

### 1. Exit Rate Anomalies
- **Single-page drop-offs**: Pages with unusually high exit rates compared to other pages
- **Statistical method**: Uses Median Absolute Deviation (MAD) based z-scores for robust anomaly detection
- **Example**: A pricing page with 65% exits when the baseline is 40%

### 2. Step Drop-offs
- **Transition probability dips**: Sudden decreases in the probability of moving from page A to page B
- **Cross-sectional comparison**: Compares against other next-step options from the same origin page
- **Example**: Homepage → Signup transition drops from 35% to 10% while other transitions remain stable

## How it works

1. **Data Collection**: Fetches pageview events and builds visit sequences
2. **Path Normalization**: Standardizes URLs (removes query params, normalizes slashes)
3. **Transition Analysis**: Computes transition probabilities and exit rates
4. **Anomaly Detection**: Uses robust statistics (MAD-based z-scores) to flag unusual patterns
5. **Ranking**: Sorts findings by severity (effect size + z-score)

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `websiteId` | string | optional | Website to analyze (uses active website if not provided) |
| `date_from` | string | required | Start date (YYYY-MM-DD) |
| `date_to` | string | required | End date (YYYY-MM-DD) |
| `timezone` | string | "UTC" | Timezone for date calculations |
| `min_support` | number | 100 | Minimum transitions required to consider a path |
| `min_effect_size` | number | 0.15 | Minimum effect size to flag (15 percentage points) |
| `sensitivity` | enum | "medium" | Detection threshold: "low" (3σ), "medium" (2.5σ), "high" (2σ) |
| `include_step_dropoffs` | boolean | true | Whether to detect A→B transition drops |
| `normalize_paths` | boolean | true | Normalize URL paths for better grouping |

## Output

```typescript
{
  findings: [
    {
      type: "dropoff",
      metric: "exit_rate" | "transition_rate",
      path_sequence: ["/pricing"], // or ["/", "/signup"] for transitions
      value: 0.65, // observed rate
      expected: 0.40, // baseline rate
      effect_size: 0.25, // absolute difference
      z: 2.8, // robust z-score
      support: 1000, // number of observations
      explanation: "Exit rate on /pricing is 65% vs 40% baseline",
      recommended_checks: ["inspect UX & copy", "check page speed & errors"]
    }
  ],
  summary: "Detected 1 drop-off(s). Top: exit_rate at /pricing",
  extras: {
    exit_rates: [...], // All exit rates for reference
    transitions: [...] // Raw transition data
  }
}
```

## Database Support

- **PostgreSQL/MySQL**: Full implementation via Prisma
- **ClickHouse**: Query structure prepared, implementation pending
- **Database agnostic**: Core logic works with any data source

## Use Cases

- **Conversion funnel analysis**: Identify where users abandon the most
- **UX optimization**: Find pages with poor user experience
- **A/B testing validation**: Compare conversion rates across variants
- **Performance monitoring**: Detect sudden drops in user engagement

## Example Usage

```typescript
const result = await getDetectPathDropoffsTool.execute({
  websiteId: "your-website-id",
  date_from: "2025-01-01",
  date_to: "2025-01-07",
  min_support: 150,
  min_effect_size: 0.18, // 18 percentage points
  sensitivity: "medium",
  include_step_dropoffs: true,
  normalize_paths: true,
});

console.log(result.summary);
result.findings.forEach(finding => {
  console.log(`${finding.metric}: ${finding.path_sequence.join(" → ")}`);
  console.log(`Effect: ${(finding.effect_size * 100).toFixed(1)}pp`);
});
```

## Statistical Details

- **MAD-based z-scores**: More robust than standard deviation for outlier detection
- **Cross-sectional baselines**: Compares against peers in the same time window
- **Effect size filtering**: Ensures findings are practically significant
- **Support thresholds**: Prevents noise from low-traffic pages
