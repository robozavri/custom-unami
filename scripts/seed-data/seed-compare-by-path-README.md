# Seed Compare-by-Path Tool

This script generates test data for the `compare-by-path` tool, which analyzes conversion performance by page path between two time periods.

## Overview

The `compare-by-path` tool helps identify which page paths are experiencing conversion drops or improvements by comparing conversion rates between two time periods. This seed script creates realistic test data with different conversion patterns across various page paths.

## What Data is Generated

### Page Paths
- **Homepage paths**: `/`, `/home` (high traffic, moderate conversion rates)
- **Product paths**: `/products`, `/products/featured`, `/products/new`, `/pricing` (good traffic, moderate-high conversion rates)
- **Conversion paths**: `/checkout`, `/signup` (moderate traffic, high conversion rates)
- **Content paths**: `/blog`, `/blog/tech`, `/blog/business`, `/about` (moderate traffic, lower conversion rates)
- **Other paths**: `/contact`, `/login`, `/dashboard`, `/profile`, `/help`, `/faq`, `/terms`, `/privacy` (lower traffic, lower conversion rates)

### Traffic Patterns
- **Homepage**: 50-150 visitors per day, 2-10% conversion rate
- **Product pages**: 20-80 visitors per day, 8-20% conversion rate
- **Conversion pages**: 10-40 visitors per day, 15-40% conversion rate
- **Content pages**: 15-55 visitors per day, 2-8% conversion rate
- **Other pages**: 5-30 visitors per day, 1-5% conversion rate

### Conversion Events
- `purchase`
- `signup`
- `checkout`
- `subscription`

## Usage

### Basic Usage
```bash
# Generate data for default date range (July-August 2025)
node scripts/seed-data/seed-compare-by-path.js

# Generate data for custom date range
node scripts/seed-data/seed-compare-by-path.js --from 2025-06-01 --to 2025-09-30

# Use custom website ID
node scripts/seed-data/seed-compare-by-path.js --website YOUR_WEBSITE_ID

# Clear existing data before seeding
node scripts/seed-data/seed-compare-by-path.js --reset
```

### Command Line Options
- `--website` or `--websiteId`: Specify website ID (default: `5801af32-ebe2-4273-9e58-89de8971a2fd`)
- `--from` or `--start`: Start date in YYYY-MM-DD format (default: `2025-07-01`)
- `--to` or `--end`: End date in YYYY-MM-DD format (default: `2025-08-31`)
- `--reset`: Clear existing data in the date range before seeding

## Expected Results

After running this seed script, you'll have:

1. **Realistic traffic patterns** across different page paths
2. **Varied conversion rates** that simulate real-world scenarios
3. **Comparable data** for July and August 2025 periods
4. **Sufficient visitor counts** to meet the `minVisitors` filter requirements

## Testing the Tool

Once seeded, you can test the `compare-by-path` tool with:

```json
{
  "conversionEvent": "purchase",
  "currentFrom": "2025-08-01",
  "currentTo": "2025-08-31",
  "previousFrom": "2025-07-01",
  "previousTo": "2025-07-31",
  "minVisitors": 5
}
```

## Data Structure

The script creates:
- **Sessions**: One per visitor per path per day
- **Pageview events**: Track visitor interactions with each path
- **Conversion events**: Based on calculated conversion rates
- **Realistic metadata**: Browser, OS, device, country, UTM parameters

## Integration with Other Seeds

This seed script is included in the comprehensive `seed-all.js` script and can be run individually or as part of the full test data generation process.

## Notes

- Each page path has different traffic volumes and conversion rates to create realistic testing scenarios
- The data spans multiple days to ensure sufficient sample sizes
- Conversion events are distributed across different paths based on the calculated rates
- All data uses the same website ID for consistent testing
