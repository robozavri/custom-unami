# Events Seeding Script

This script seeds various business events for July and August 2024, including pageviews and custom business events with associated event data.

## Features

- **Business Events**: Seeds 7 different business event types with realistic data
- **Pageviews**: Generates pageview events for each session
- **Event Data**: Creates rich event data for each business event
- **Realistic Patterns**: Varies event rates and session counts day-to-day
- **UTM Tracking**: Includes UTM parameters for attribution analysis
- **Geographic Distribution**: Spreads events across multiple countries and devices

## Business Events Seeded

1. **Start Free Trial** - With plan type, trial length, and source
2. **Watch Demo** - With demo type, duration, and completion rate
3. **Select Basic Plan** - With pricing, billing cycle, and discount info
4. **Select Pro Plan** - With pricing, billing cycle, and discount info
5. **Select Enterprise Plan** - With pricing, billing cycle, and discount info
6. **Request Integration** - With integration type, platform, and priority
7. **Contact Support** - With support type, priority, and channel

## Usage

### Basic Usage (July-August 2024)
```bash
node scripts/test-data/seed-events.js
```

### Custom Date Range
```bash
node scripts/test-data/seed-events.js --from 2024-07-01 --to 2024-08-31
```

### Custom Website ID
```bash
node scripts/test-data/seed-events.js --website "your-website-id-here"
```

### Reset Existing Data
```bash
node scripts/test-data/seed-events.js --reset-range
```

### Custom Event Rate
```bash
node scripts/test-data/seed-events.js --event-rate 0.20
```

### All Options Combined
```bash
node scripts/test-data/seed-events.js \
  --website "your-website-id" \
  --from 2024-07-01 \
  --to 2024-08-31 \
  --reset-range \
  --event-rate 0.18
```

## Configuration

### Default Settings
- **Website ID**: `5801af32-ebe2-4273-9e58-89de8971a2fd`
- **Date Range**: July 1 - August 31, 2024
- **Sessions per Day**: ~180 (varies 0.8x-1.2x daily)
- **Pages per Session**: ~4.5
- **Business Event Rate**: 15% of sessions
- **Countries**: US, DE, GB, FR, CA, AU, JP, BR, IN, NL
- **Devices**: Desktop, Mobile, Tablet

### Event Data Types
- **Type 1**: String values (plan types, sources, etc.)
- **Type 2**: Number values (prices, durations, etc.)
- **Type 3**: Date values (timestamps)

## Data Structure

### Sessions
- Unique session IDs with realistic demographics
- Device, browser, OS, screen resolution
- Geographic location (country, region, city)
- Language and timezone considerations

### Events
- **Pageviews**: Event type 1, no event name
- **Business Events**: Event type 2, with specific event names
- UTM tracking parameters
- Referrer information
- Page titles and paths

### Event Data
- Rich metadata for each business event
- Structured key-value pairs
- Appropriate data types for analytics

## Output Example

```
[seed:events] config { websiteId: '5801af32-ebe2-4273-9e58-89de8971a2fd', startDate: '2024-07-01', endDate: '2024-08-31', resetRange: false, eventRate: 0.15 }
[seed:events] 2024-07-01 visits=156 events=702 eventData=45
[seed:events] 2024-07-02 visits=189 events=850 eventData=52
[seed:events] 2024-07-03 visits=172 events=774 eventData=48
...
[seed:events] done { totalSessions: 11160, totalEvents: 50220, totalEventData: 3348 }
```

## Prerequisites

- Node.js environment
- Prisma client configured
- Database connection (MySQL/PostgreSQL)
- Environment variables set up

## Database Tables Used

- `session` - User sessions and demographics
- `website_event` - Pageviews and business events
- `event_data` - Rich event metadata
- `website` - Website configuration

## Analytics Use Cases

This seeded data enables testing of:

- **Event Tracking**: Monitor business event conversions
- **Funnel Analysis**: Analyze user journey from pageview to conversion
- **Attribution**: UTM parameter performance analysis
- **Geographic Insights**: Country and region-based analytics
- **Device Performance**: Mobile vs desktop conversion rates
- **Time-based Trends**: Daily and monthly patterns

## Customization

To add new event types or modify existing ones:

1. Add new event names to `BUSINESS_EVENTS` array
2. Implement `generateEventData()` logic for new events
3. Adjust event rates and patterns as needed
4. Modify UTM campaigns and sources for different scenarios

## Troubleshooting

- **Database Connection**: Ensure DATABASE_URL is set correctly
- **Permissions**: Verify database user has INSERT/DELETE permissions
- **Memory**: Large date ranges may require increased Node.js memory
- **Timeouts**: Adjust transaction timeouts for large datasets

