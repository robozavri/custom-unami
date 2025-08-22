# Test Data Seeding for Umami Analytics

This directory contains comprehensive test data generation scripts for Umami Analytics, designed to create realistic user behavior patterns for testing and development.

## 🚀 Quick Start

### Run All Seeds Together
```bash
# Generate comprehensive test data
node seed-all.js

# With custom settings
node seed-all.js --from 2024-07-01 --to 2024-08-31 --reset-range
```

### Run Individual Seeds
```bash
# Core user activity
node seed-comprehensive.js
node seed-events.js
node seed-returning-event-users.js

# Analytics patterns
node seed-ctr.js
node seed-retention-dips.js
node seed-segment-shifts.js

# Anomaly detection
node seed-anomaly-timeseries.js
```

## 📁 File Structure

### Core Files
- **`seed-constants.js`** - Enhanced data structures and helper functions
- **`seed-all.js`** - Runs all seeds together
- **`seed-comprehensive.js`** - Complete user simulation (already enhanced)

### High Priority Seeds (Enhanced)
- **`seed-events.js`** - Business events and pageviews
- **`seed-returning-event-users.js`** - Returning user patterns
- **`seed-returning-event-users-enhanced.js`** - Advanced user behavior
- **`seed-segmented-events.js`** - User segmentation data

### Medium Priority Seeds (Enhanced)
- **`seed-ctr.js`** - Click-through rate patterns
- **`seed-retention-dips.js`** - Retention analysis data
- **`seed-segment-shifts.js`** - Segment behavior changes
- **`seed-path-dropoffs.js`** - User journey patterns

### No Changes Needed
- **`seed-anomaly-timeseries.js`** - Time series anomalies
- **`seed-timeseries-anomalies-advanced.js`** - Advanced anomaly patterns
- **`clear-analytics-tables.js`** - Cleanup utility
- **`inspect-analytics.js`** - Inspection utility

## 🎯 Enhanced Data Features

### Realistic User Simulation
- **15+ countries** with regions, cities, and timezones
- **Multiple device types** (desktop, mobile, tablet)
- **Real browser versions** (Chrome, Firefox, Safari, Edge)
- **Realistic screen resolutions** for each device type
- **15+ business events** with contextual data

### Traffic Attribution
- **UTM parameter tracking** (source, medium, campaign)
- **Referrer domains** for traffic sources
- **Campaign attribution** data

### Data Quality
- **Consistent data structures** across all seeds
- **Realistic user behavior patterns**
- **Proper event data types** (string, number, date)
- **Geographic diversity** for testing

## 🔧 Configuration

### Environment Setup
```bash
# Ensure you have a .env file with database connection
DATABASE_URL="your-database-connection-string"
```

### Command Line Options
```bash
--website <id>          # Website ID to seed
--from <date>           # Start date (YYYY-MM-DD)
--to <date>             # End date (YYYY-MM-DD)
--reset-range           # Clear existing data in range
--skip <seeds>          # Comma-separated list to skip
```

## 📊 What You Get

After running the seeds, your database will contain:

- **Realistic user sessions** with proper demographics
- **Diverse device and browser data** for testing
- **Geographic user distribution** across 15+ countries
- **Business events** with contextual metadata
- **Traffic source attribution** for campaign analysis
- **User behavior patterns** for retention analysis
- **Anomaly patterns** for detection testing
- **Segmentation data** for user analysis

## 🧪 Testing Scenarios

### User Analytics
- Device and browser performance
- Geographic user patterns
- Traffic source effectiveness
- User journey analysis

### Business Intelligence
- Conversion rate optimization
- Campaign performance analysis
- User retention patterns
- Segment behavior analysis

### Technical Testing
- Anomaly detection algorithms
- Time series analysis
- Data aggregation performance
- Report generation

## 📚 Documentation

- **`seed-all-README.md`** - Comprehensive guide for seed-all.js
- **`SEED-ANALYSIS.md`** - Detailed analysis of which seeds need enhancement
- Individual seed README files for specific use cases

## 🎉 Benefits

1. **Realistic Testing** - Data looks like real user activity
2. **Consistent Experience** - All seeds use same data structures
3. **Better Analytics** - Meaningful insights from test data
4. **Maintainability** - Centralized data definitions
5. **Quality Assurance** - Comprehensive testing of analytics features

## 🚨 Troubleshooting

- Check database connection in `.env`
- Use `--reset-range` to avoid conflicts
- Monitor console output for errors
- Start with small date ranges for testing

---

**Ready to generate realistic test data?** Start with `node seed-all.js` to populate your database with comprehensive, realistic user activity patterns!
