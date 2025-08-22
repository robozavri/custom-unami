# Seed Compare-by-Country Tool

This script generates test data for the `compare-by-country` tool, which analyzes conversion performance by user country between two time periods.

## Overview

The `compare-by-country` tool helps identify regions where conversion behavior has changed, which may indicate:
- Localization issues
- Geo-based outages or service disruptions
- Traffic drops from specific markets
- Regional performance variations

This seed script creates realistic test data with different conversion patterns across various countries.

## What Data is Generated

### Countries
- **High-traffic countries**: US (200 visitors/day), GB (80 visitors/day), DE (70 visitors/day)
- **Medium-traffic countries**: FR (60 visitors/day), CA (50 visitors/day), AU (40 visitors/day)
- **Lower-traffic countries**: NL (35 visitors/day), SE (30 visitors/day), NO (25 visitors/day)
- **International markets**: JP (35 visitors/day), KR (30 visitors/day), BR (25 visitors/day)
- **Emerging markets**: IN (30 visitors/day), SG (15 visitors/day), AE (10 visitors/day)

### Traffic Patterns
- **US**: 200 visitors/day, 15% conversion rate
- **Major European**: 60-80 visitors/day, 10-12% conversion rate
- **Other European**: 20-35 visitors/day, 6-9% conversion rate
- **Asia-Pacific**: 15-35 visitors/day, 10-11% conversion rate
- **Emerging markets**: 10-30 visitors/day, 5-8% conversion rate

### Conversion Events
- `purchase`
- `signup`
- `checkout`
- `subscription`

## Usage

### Basic Usage
```bash
# Generate data for default date range (July-August 2025)
node scripts/seed-data/seed-compare-by-country.js

# Generate data for custom date range
node scripts/seed-data/seed-compare-by-country.js --from 2025-06-01 --to 2025-09-30

# Use custom website ID
node scripts/seed-data/seed-compare-by-country.js --website YOUR_WEBSITE_ID

# Clear existing data before seeding
node scripts/seed-data/seed-compare-by-country.js --reset
```

### Command Line Options
- `--website` or `--websiteId`: Specify website ID (default: `5801af32-ebe2-4273-9e58-89de8971a2fd`)
- `--from` or `--start`: Start date in YYYY-MM-DD format (default: `2025-07-01`)
- `--to` or `--end`: End date in YYYY-MM-DD format (default: `2025-08-31`)
- `--reset`: Clear existing data in the date range before seeding

## Expected Results

After running this seed script, you'll have:

1. **Realistic geographic distribution** across 20 different countries
2. **Varied conversion rates** that simulate real-world regional differences
3. **Comparable data** for July and August 2025 periods
4. **Sufficient visitor counts** to meet the `minVisitors` filter requirements
5. **Regional performance variations** to test the tool's analysis capabilities

## Testing the Tool

Once seeded, you can test the `compare-by-country` tool with:

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
- **Sessions**: One per visitor per country per day
- **Pageview events**: Track visitor interactions
- **Conversion events**: Based on calculated conversion rates per country
- **Realistic metadata**: Browser, OS, device, country codes and names, UTM parameters

## Integration with Other Seeds

This seed script is included in the comprehensive `seed-all.js` script and can be run individually or as part of the full test data generation process.

## Notes

- Each country has different traffic volumes and conversion rates to create realistic testing scenarios
- The data spans multiple days to ensure sufficient sample sizes
- Conversion events are distributed across different countries based on the calculated rates
- All data uses the same website ID for consistent testing
- Country codes follow ISO 3166-1 alpha-2 standard
- Unknown or missing countries are mapped to "Unknown" for testing edge cases
