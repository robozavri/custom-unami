# Seed All - Comprehensive Test Data Generation

This script runs all seed files together to generate comprehensive, realistic test data for your analytics database.

## 🚀 Quick Start

```bash
# Run all seeds with default settings
node seed-all.js

# Run with custom date range
node seed-all.js --from 2024-07-01 --to 2024-08-31

# Run with custom website ID
node seed-all.js --website your-website-id

# Skip specific seeds
node seed-all.js --skip seed-ctr,seed-retention-dips

# Reset existing data in range
node seed-all.js --reset-range
```

## 📊 What Gets Generated

### Core User Activity
- **seed-comprehensive.js**: Base user sessions and events
- **seed-events.js**: Business events and pageviews
- **seed-returning-event-users.js**: Returning user patterns
- **seed-returning-event-users-enhanced.js**: Advanced user behavior

### Analytics Patterns
- **seed-segmented-events.js**: User segmentation data
- **seed-ctr.js**: Click-through rate patterns
- **seed-retention-dips.js**: Retention analysis data
- **seed-segment-shifts.js**: Segment behavior changes
- **seed-path-dropoffs.js**: User journey patterns

### Anomaly Detection
- **seed-anomaly-timeseries.js**: Time series anomalies
- **seed-timeseries-anomalies-advanced.js**: Advanced anomaly patterns

## 🎯 Enhanced Data Features

### Realistic User Agents
- Desktop: Chrome, Firefox, Safari, Edge
- Mobile: Safari, Chrome, Samsung Browser
- Tablet: Safari, Chrome
- Real browser versions and OS combinations

### Device Diversity
- **Desktop**: Windows, macOS, Linux with realistic screen resolutions
- **Mobile**: iOS, Android with device-specific dimensions
- **Tablet**: iPad, Android tablets with tablet resolutions

### Geographic Distribution
- 15 countries with realistic regions and cities
- Proper timezone information
- Geographic diversity for testing

### Business Events
- 15+ business event types
- Realistic event data with proper types
- Contextual information for each event

### Traffic Sources
- UTM parameter tracking
- Realistic referrer domains
- Campaign attribution data

## 🔧 Configuration Options

### Command Line Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--website` | Website ID to seed | `5801af32-ebe2-4273-9e58-89de8971a2fd` |
| `--from` | Start date (YYYY-MM-DD) | `2024-07-01` |
| `--to` | End date (YYYY-MM-DD) | `2024-08-31` |
| `--reset-range` | Clear existing data in range | `false` |
| `--skip` | Comma-separated list of seeds to skip | None |

### Environment Variables

Make sure you have a `.env` file with your database connection:

```env
DATABASE_URL="your-database-connection-string"
```

## 📈 Expected Output

When you run `seed-all.js`, you'll see:

```
[seed-all] Starting comprehensive test data generation...
[seed-all] Config: { websiteId: '...', startDate: '2024-07-01', endDate: '2024-08-31', resetRange: false, skipSeeds: [] }

[seed-all] Running comprehensive...
[seed-all] ✅ comprehensive completed successfully in 45.23s

[seed-all] Running events...
[seed-all] ✅ events completed successfully in 12.45s

[seed-all] Running returning-event-users...
[seed-all] ✅ returning-event-users completed successfully in 8.67s

...

=====================================
[seed-all] SEEDING COMPLETED - SUMMARY
=====================================
Total seeds: 11
Successful: 11
Failed: 0

✅ Successful seeds:
  - comprehensive: 45.23s
  - events: 12.45s
  - returning-event-users: 8.67s
  ...

📊 Database now contains comprehensive test data for:
  - Website ID: 5801af32-ebe2-4273-9e58-89de8971a2fd
  - Date range: 2024-07-01 to 2024-08-31
  - Multiple user behaviors and patterns
  - Various device types, countries, and traffic sources
  - Business events with realistic data
  - Anomalies and retention patterns

🎉 All seeds completed successfully! Your database is ready for comprehensive testing.
```

## 🧪 Testing Your Analytics

After running all seeds, you can test:

### User Behavior Analysis
- Device and browser distribution
- Geographic user patterns
- Traffic source attribution
- User journey analysis

### Business Metrics
- Conversion rates by traffic source
- Device performance differences
- Geographic performance variations
- Campaign effectiveness

### Advanced Analytics
- User segmentation
- Retention analysis
- Anomaly detection
- Path analysis

## 🔍 Individual Seed Usage

You can still run individual seeds:

```bash
# Run just the comprehensive seed
node seed-comprehensive.js

# Run events with custom settings
node seed-events.js --event-rate 0.25

# Run CTR analysis
node seed-ctr.js --from 2024-07-01 --to 2024-07-31
```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check your `.env` file
   - Ensure database is running
   - Verify connection string

2. **Seed Fails**
   - Check console output for specific errors
   - Verify database schema matches expectations
   - Check for conflicting data in date range

3. **Performance Issues**
   - Use `--skip` to exclude problematic seeds
   - Reduce date range for testing
   - Check database performance

### Getting Help

- Check individual seed README files
- Review console output for specific errors
- Verify database schema and permissions

## 🎯 Best Practices

1. **Start Small**: Test with a small date range first
2. **Use Reset**: Use `--reset-range` when testing to avoid conflicts
3. **Monitor Progress**: Watch console output for any issues
4. **Verify Data**: Check your analytics dashboard after seeding
5. **Customize**: Modify `seed-constants.js` for your specific needs

## 🔄 Updating Enhanced Data

To modify the enhanced data structures:

1. Edit `seed-constants.js`
2. Add new countries, devices, or events
3. Update helper functions as needed
4. Test with individual seeds first
5. Run full `seed-all.js` to verify

This ensures all your test data remains consistent and realistic across all seed files.
