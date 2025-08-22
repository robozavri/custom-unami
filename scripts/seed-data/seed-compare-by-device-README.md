# Seed Data for Compare-by-Device Tool

This script generates test data for the `compare-by-device` tool, which analyzes conversion performance by device type across different time periods.

## Overview

The seed script creates realistic test data that simulates user behavior across different device types (desktop, mobile, tablet) with varying conversion rates and visitor volumes. This allows you to test the tool's ability to detect device-specific performance changes.

## What Gets Created

### Device Types
- **Desktop**: High volume, moderate conversion rate (~8%)
- **Mobile**: High volume, lower conversion rate (~5%)
- **Tablet**: Lower volume, higher conversion rate (~12%)

### Data Structure
- **Sessions**: User sessions with device information
- **Pageviews**: Initial pageview events for each session
- **Conversion Events**: Purchase, signup, checkout, and subscription events
- **Realistic Variations**: ±30% visitor variation, ±40% conversion rate variation

### Time Periods
- **Current Period**: August 2025 (default)
- **Previous Period**: July 2025 (default)
- **Customizable**: Can specify custom date ranges

## Usage

### Basic Usage
```bash
# Generate data for default date range (July-August 2025)
node scripts/seed-data/seed-compare-by-device.js
```

### Custom Date Range
```bash
# Generate data for June-September 2025
node scripts/seed-data/seed-compare-by-device.js --from 2025-06-01 --to 2025-09-30

# Generate data for specific months
node scripts/seed-data/seed-compare-by-device.js --from 2025-05-01 --to 2025-06-30
```

### Custom Website ID
```bash
# Generate data for a specific website
node scripts/seed-data/seed-compare-by-device.js --websiteId 123e4567-e89b-12d3-a456-426614174000
```

### Clear Existing Data
```bash
# Clear existing data before seeding
node scripts/seed-data/seed-compare-by-device.js --reset

# Combine with custom dates
node scripts/seed-data/seed-compare-by-device.js --from 2025-06-01 --to 2025-09-30 --reset
```

### Help
```bash
# Show usage information
node scripts/seed-data/seed-compare-by-device.js --help
```

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--websiteId` | Website ID to seed data for | `00000000-0000-0000-0000-000000000000` |
| `--from` | Start date (YYYY-MM-DD) | `2025-07-01` |
| `--to` | End date (YYYY-MM-DD) | `2025-08-31` |
| `--reset` | Clear existing data before seeding | `false` |
| `--help` | Show help message | N/A |

## Expected Output

When you run the script, you'll see:

```
Starting seed data generation for compare-by-device tool...
Website ID: 00000000-0000-0000-0000-000000000000
Date range: 2025-07-01 to 2025-08-31
Generating data for 62 days...
Progress: 0% complete
Progress: 11% complete
...
Progress: 89% complete
Progress: 100% complete

✅ Seed data generation completed successfully!
📊 Total sessions created: 17,360
📊 Total events created: 34,720
📱 Device types: desktop, mobile, tablet
🎯 Conversion events: purchase, signup, checkout, subscription
📅 Date range: 2025-07-01 to 2025-08-31
🌐 Website ID: 00000000-0000-0000-0000-000000000000

💡 You can now test the compare-by-device tool with:
   node scripts/test-tools/test-compare-by-device.js
```

## Data Characteristics

### Volume Distribution
- **Desktop**: ~100 visitors/day, ~8 conversions/day
- **Mobile**: ~150 visitors/day, ~7-8 conversions/day  
- **Tablet**: ~30 visitors/day, ~3-4 conversions/day

### Conversion Patterns
- **Desktop**: Steady, moderate conversion rates
- **Mobile**: Lower conversion rates, higher visitor volume
- **Tablet**: Higher conversion rates, lower visitor volume

### Realistic Variations
- Daily visitor counts vary by ±30%
- Conversion rates vary by ±40%
- Events occur at realistic intervals (5-35 minutes after pageview)

## Testing the Tool

After seeding data, you can test the `compare-by-device` tool:

### Standalone Test
```bash
node scripts/test-tools/test-compare-by-device.js
```

### Integrated Test
```bash
yarn test-tools
```

### API Testing
```bash
# Test the API endpoint directly
curl -X POST http://localhost:3000/api/tools/compare-by-device \
  -H "Content-Type: application/json" \
  -d '{
    "conversionEvent": "purchase",
    "currentFrom": "2025-08-01",
    "currentTo": "2025-08-31",
    "previousFrom": "2025-07-01",
    "previousTo": "2025-07-31",
    "minVisitors": 5
  }'
```

## Integration with Other Tools

This seed script is included in the comprehensive `seed-all.js` script:

```bash
# Run all seeds including compare-by-device
node scripts/seed-data/seed-all.js
```

## Troubleshooting

### Common Issues
1. **Database Connection**: Ensure your database is running and accessible
2. **Prisma Schema**: Verify your Prisma schema matches the expected table structure
3. **Date Format**: Use YYYY-MM-DD format for dates
4. **Website ID**: Ensure the website ID exists in your database

### Data Validation
After seeding, you can verify the data was created correctly:

```sql
-- Check session counts by device
SELECT device, COUNT(*) as session_count 
FROM session 
WHERE website_id = '00000000-0000-0000-0000-000000000000'
  AND created_at BETWEEN '2025-07-01' AND '2025-08-31'
GROUP BY device;

-- Check conversion events
SELECT event_name, COUNT(*) as event_count 
FROM website_event 
WHERE website_id = '00000000-0000-0000-0000-000000000000'
  AND event_name IN ('purchase', 'signup', 'checkout', 'subscription')
  AND created_at BETWEEN '2025-07-01' AND '2025-08-31'
GROUP BY event_name;
```

## Next Steps

1. **Seed the data**: Run the seed script with your desired parameters
2. **Test the tool**: Use the test scripts to verify functionality
3. **Analyze results**: Review the conversion performance by device
4. **Customize**: Modify the script to generate different data patterns if needed

The seeded data provides a solid foundation for testing device-specific conversion analysis and identifying performance trends across different platforms.
