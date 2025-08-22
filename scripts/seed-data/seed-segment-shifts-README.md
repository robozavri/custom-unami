# Seed Script for get-detect-segment-shifts Tool

This seed script generates test data specifically designed to test the `get-detect-segment-shifts` tool with engineered anomalies across multiple segments.

## What It Does

The script creates realistic user session data with demographic information and pageview events, then introduces significant distribution changes on a specific "anomaly day" to test the tool's detection capabilities.

## Data Structure

### **Sessions Table**
- **Demographic Data**: country, device, browser, os, screen, language, region, city
- **Timing**: Random distribution across each day
- **Volume**: 300 visits per day (360 on anomaly day)

### **Website Events Table**
- **Page Data**: url_path, page_title, referrer_domain, utm parameters
- **Session Tracking**: Links events to sessions via session_id
- **Volume**: 2-6 pageviews per session

## Segment Configurations

### **Baseline Period (Days 1-7, 9-14)**
- **Country**: US (40%), DE (25%), GB (15%), FR (10%), CA (10%)
- **Device**: Desktop (60%), Mobile (35%), Tablet (5%)
- **Browser**: Chrome (65%), Firefox (20%), Safari (10%), Edge (5%)
- **Referrer**: Google (45%), Facebook (25%), Twitter (15%), LinkedIn (10%), Direct (5%)
- **UTM Source**: Email (30%), Social (25%), Search (25%), Direct (15%), Affiliate (5%)
- **Path**: Homepage (35%), Pricing (25%), About (20%), Contact (15%), Blog (5%)

### **Anomaly Day (Day 8)**
- **Country**: US +15pp (40% → 55%), DE -5pp (25% → 20%)
- **Device**: Desktop -15pp (60% → 45%), Mobile +15pp (35% → 50%)
- **Browser**: Chrome -10pp (65% → 55%), Firefox +10pp (20% → 30%)
- **Referrer**: Google -10pp (45% → 35%), Facebook +10pp (25% → 35%)
- **UTM Source**: Email +15pp (30% → 45%), Social -5pp (25% → 20%), Search -5pp (25% → 20%)
- **Path**: Homepage -10pp (35% → 25%), Pricing +10pp (25% → 35%)

## Usage

### **Basic Usage**
```bash
# Generate data for July 1-14, 2025 with anomaly on day 8
node scripts/test-data/seed-segment-shifts.js

# Custom date range
node scripts/test-data/seed-segment-shifts.js --from 2025-08-01 --days 21

# Custom website ID
node scripts/test-data/seed-segment-shifts.js --website your-website-id

# Reset existing data in range
node scripts/test-data/seed-segment-shifts.js --reset-range
```

### **Command Line Options**
- `--website` / `--websiteId`: Custom website ID (default: predefined test ID)
- `--from` / `--start`: Start date in YYYY-MM-DD format (default: 2025-07-01)
- `--days`: Number of days to generate (default: 14)
- `--anomaly-index`: Which day should be the anomaly (0-based, default: 7 = day 8)
- `--reset-range`: Delete existing data in the date range before seeding

## Expected Anomalies

When you run the tool on this data, you should detect:

### **High Confidence Findings (≥15pp change)**
- **Country**: US traffic spike (+15pp)
- **Device**: Mobile adoption surge (+15pp), Desktop decline (-15pp)
- **UTM Source**: Email campaign success (+15pp)

### **Medium Confidence Findings (≥10pp change)**
- **Browser**: Chrome decline (-10pp), Firefox growth (+10pp)
- **Referrer**: Google traffic drop (-10pp), Facebook increase (+10pp)
- **Path**: Homepage decline (-10pp), Pricing page growth (+10pp)

### **Lower Confidence Findings (≥5pp change)**
- **Country**: German traffic decline (-5pp)
- **UTM Source**: Social traffic decline (-5pp), Search traffic decline (-5pp)

## Tool Testing Examples

### **Test Single Segment**
```typescript
// Test country shifts
{
  date_from: "2025-07-01",
  date_to: "2025-07-14",
  segment_by: "country",
  metric: "visits",
  min_effect_size: 0.10,  // 10 percentage points
  min_share: 0.05         // 5% minimum share
}
```

### **Test Multiple Segments**
```typescript
// Test device and browser shifts
{
  date_from: "2025-07-01",
  date_to: "2025-07-14",
  segment_by: ["device", "browser"],
  metric: "visits",
  min_effect_size: 0.05   // 5 percentage points
}
```

### **Test Different Metrics**
```typescript
// Test path-based pageview shifts
{
  date_from: "2025-07-01",
  date_to: "2025-07-14",
  segment_by: "path",
  metric: "pageviews",
  min_effect_size: 0.08   // 8 percentage points
}
```

### **Test Lower Thresholds**
```typescript
// Catch smaller changes
{
  date_from: "2025-07-01",
  date_to: "2025-07-14",
  segment_by: ["country", "device", "browser"],
  metric: "visits",
  min_effect_size: 0.03,  // 3 percentage points
  min_share: 0.02,        // 2% minimum share
  min_support: 50         // Lower data requirements
}
```

## Data Volume

- **Total Sessions**: ~4,200 (300 × 14 days)
- **Total Events**: ~14,700 (3.5 × 4,200 sessions)
- **Database Size**: ~2-3 MB
- **Generation Time**: 30-60 seconds

## Verification

After running the seed script, verify the data was created:

```sql
-- Check session counts by day
SELECT 
  DATE(created_at) as date,
  COUNT(*) as sessions,
  COUNT(DISTINCT country) as countries,
  COUNT(DISTINCT device) as devices
FROM session 
WHERE website_id = 'your-website-id'
GROUP BY DATE(created_at)
ORDER BY date;

-- Check event counts by day
SELECT 
  DATE(created_at) as date,
  COUNT(*) as events,
  COUNT(DISTINCT session_id) as sessions
FROM website_event 
WHERE website_id = 'your-website-id'
GROUP BY DATE(created_at)
ORDER BY date;
```

## Troubleshooting

### **Common Issues**
1. **Prisma Connection**: Ensure `.env` file has valid `DATABASE_URL`
2. **Permissions**: Database user needs CREATE/DELETE permissions
3. **Memory**: Large datasets may require increased Node.js memory limit
4. **Timeouts**: Increase Prisma transaction timeout for large batches

### **Performance Tips**
- Use `--reset-range` only when necessary
- Generate smaller date ranges for testing
- Monitor database performance during seeding
- Consider running during low-traffic periods

## Next Steps

1. **Run the seed script** to populate test data
2. **Test the tool** with various segment combinations
3. **Verify anomalies** are detected as expected
4. **Experiment with thresholds** to understand sensitivity
5. **Test different metrics** (visits, pageviews, bounce_rate)

The seed script creates realistic, statistically significant anomalies that should be easily detected by the `get-detect-segment-shifts` tool, making it perfect for testing and demonstrating the tool's capabilities.
