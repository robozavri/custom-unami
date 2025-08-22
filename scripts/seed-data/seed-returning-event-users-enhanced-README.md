# Enhanced Returning Event Users Seed Script

This seed script is specifically designed to test the `get-returning-event-users` tool with realistic user return patterns and behavior analysis.

## Purpose

Creates test data optimized for returning user analysis by:
- Simulating different user types with varying return probabilities
- Creating realistic session spacing and event frequency patterns
- Providing diverse user segments that influence return behavior
- Generating meaningful data for retention and engagement analysis

## Features

### User Behavior Patterns
The script creates 4 distinct user types with realistic return patterns:

#### 1. Power Users (80% return rate)
- **8 average sessions** per user
- **1-3 days** between sessions
- **5-12 events** per session
- **High engagement** events: Page View, Button Click, Form Submit, File Download, Video Play

#### 2. Regular Users (60% return rate)
- **4 average sessions** per user
- **2-7 days** between sessions
- **3-8 events** per session
- **Medium engagement** events: Page View, Button Click, Form Submit

#### 3. Occasional Users (30% return rate)
- **2 average sessions** per user
- **5-14 days** between sessions
- **2-5 events** per session
- **Low engagement** events: Page View, Button Click

#### 4. One-Time Users (10% return rate)
- **1 average session** per user
- **10-30 days** between sessions (if they return)
- **1-3 events** per session
- **Minimal engagement** events: Page View only

### Event Types with Realistic Distribution
- **Page View** (35%): Basic page navigation
- **Button Click** (20%): User interaction
- **Form Submit** (15%): User engagement
- **File Download** (10%): Content consumption
- **Video Play** (8%): Media engagement
- **Search Query** (6%): Information seeking
- **Add to Cart** (4%): E-commerce behavior
- **Purchase** (2%): Conversion events

### User Properties Influencing Return Behavior
Each user has properties that affect their return probability:

#### Countries with Different Return Rates
- **US**: 70% return rate, 5 avg sessions
- **CA**: 72% return rate, 5.5 avg sessions
- **AU**: 69% return rate, 4.8 avg sessions
- **DE**: 65% return rate, 4 avg sessions
- **JP**: 58% return rate, 3.5 avg sessions
- **BR**: 55% return rate, 3 avg sessions
- **IN**: 52% return rate, 2.8 avg sessions

#### Devices with Different Engagement Patterns
- **Desktop**: 75% return rate, 5.5 avg sessions
- **Tablet**: 68% return rate, 4.1 avg sessions
- **Mobile**: 55% return rate, 3.2 avg sessions

#### Browsers with Different User Segments
- **Chrome**: 72% return rate, 4.8 avg sessions
- **Edge**: 71% return rate, 4.7 avg sessions
- **Firefox**: 69% return rate, 4.5 avg sessions
- **Safari**: 65% return rate, 4.2 avg sessions

## Usage

### Basic Usage
```bash
node scripts/test-data/seed-returning-event-users-enhanced.js
```

### With Custom Parameters
```bash
node scripts/test-data/seed-returning-event-users-enhanced.js \
  --website "your-website-id" \
  --from "2024-07-01" \
  --to "2024-08-31" \
  --reset-range \
  --user-count 500
```

### Parameters
- `--website` / `--websiteId`: Target website ID (default: comprehensive test website)
- `--from` / `--start`: Start date (YYYY-MM-DD, default: 2024-07-01)
- `--to` / `--end`: End date (YYYY-MM-DD, default: 2024-08-31)
- `--reset-range`: Clear existing data in the specified date range before seeding
- `--user-count`: Number of users to generate (default: 300)

## Data Generation

### User Generation Process
1. **User Type Assignment**: Each user gets assigned a behavior pattern
2. **Property Assignment**: Geographic, device, and browser properties assigned
3. **Session Generation**: Sessions created based on user type patterns
4. **Event Generation**: Events created within each session
5. **Return Logic**: Return probability applied between sessions

### Session Spacing Logic
- **First session**: Random time within the date range
- **Subsequent sessions**: Based on user type spacing rules
- **Return probability**: Applied before each new session
- **Natural termination**: When return probability fails or date range ends

### Event Distribution
- **Page views**: Always included (event type 1)
- **Custom events**: Selected based on probability distribution
- **Event timing**: Realistic spacing within sessions
- **Path variety**: 15 different page paths for realistic navigation

## Testing the get-returning-event-users Tool

### Example Tool Calls

#### Basic Returning Users Analysis
```javascript
{
  name: "get-returning-event-users",
  params: {
    granularity: "day",
    date_from: "2024-07-01",
    date_to: "2024-08-31"
  }
}
```

#### Filtered by Specific Event
```javascript
{
  name: "get-returning-event-users",
  params: {
    granularity: "week",
    event_name: "Button Click",
    date_from: "2024-07-01",
    date_to: "2024-08-31"
  }
}
```

#### Monthly Granularity Analysis
```javascript
{
  name: "get-returning-event-users",
  params: {
    granularity: "month",
    event_name: "Form Submit",
    date_from: "2024-07-01",
    date_to: "2024-08-31"
  }
}
```

### Expected Results
- **Realistic return patterns** that vary by user type
- **Meaningful retention metrics** across different time periods
- **Event-specific analysis** showing different return behaviors
- **Granularity-based insights** (daily, weekly, monthly)

## Data Quality Features

### Realistic User Journeys
- Users follow natural engagement patterns
- Session spacing mimics real-world behavior
- Event frequency varies by user engagement level
- Return patterns reflect actual user psychology

### Consistent Behavior Patterns
- Power users consistently return more frequently
- Regular users show moderate engagement
- Occasional users demonstrate sporadic return behavior
- One-time users rarely return (as expected)

### Geographic and Device Variations
- Different countries show varying return rates
- Device types influence engagement patterns
- Browser preferences correlate with user behavior
- Realistic distribution across all segments

## Performance Considerations

### Efficient Processing
- **User-by-user generation** for better memory management
- **Batch database operations** for optimal performance
- **Progress tracking** every 50 users
- **Configurable user count** for different testing needs

### Database Optimization
- **Batch inserts** for sessions and events
- **Appropriate timeouts** for large operations
- **Efficient cleanup** when using reset-range
- **Transaction-based operations** for data consistency

## Comparison with Other Seeds

### vs. seed-comprehensive.js
- **Focused on user return patterns** rather than general analytics
- **Realistic session spacing** for retention analysis
- **User type classification** for behavior analysis
- **Optimized for returning user tools**

### vs. seed-returning-event-users.js
- **Enhanced user behavior modeling** with 4 distinct user types
- **Realistic return probability** based on user segments
- **Better geographic and device distribution**
- **More sophisticated session generation logic**

## Analysis Scenarios

### Retention Analysis
- **Daily retention**: Track user return patterns day by day
- **Weekly patterns**: Identify weekly engagement cycles
- **Monthly trends**: Analyze long-term retention trends

### User Segmentation
- **By country**: Geographic retention patterns
- **By device**: Device-specific engagement
- **By browser**: Browser user behavior differences

### Event-Specific Analysis
- **High-engagement events**: Form Submit, File Download
- **Low-engagement events**: Page View, Button Click
- **Conversion events**: Add to Cart, Purchase

## Troubleshooting

### Common Issues
1. **Low return rates**: Check user type distribution and return probabilities
2. **Uneven data distribution**: Verify user count and date range settings
3. **Memory issues**: Reduce user count for large date ranges
4. **Database timeouts**: Increase timeout settings for large operations

### Data Validation
After seeding, verify data quality:
```sql
-- Check user return patterns
SELECT 
  COUNT(DISTINCT distinct_id) as total_users,
  COUNT(*) as total_sessions,
  COUNT(*) / COUNT(DISTINCT distinct_id) as avg_sessions_per_user
FROM session;

-- Verify event distribution
SELECT event_name, COUNT(*) 
FROM website_event 
WHERE event_type = 2 
GROUP BY event_name;

-- Check geographic distribution
SELECT country, COUNT(DISTINCT distinct_id) as users
FROM session 
GROUP BY country;
```

## Next Steps

After running this seed:
1. Test the `get-returning-event-users` tool with different granularities
2. Analyze return patterns by specific events
3. Compare retention across different user segments
4. Validate that return patterns match expected user type behaviors
