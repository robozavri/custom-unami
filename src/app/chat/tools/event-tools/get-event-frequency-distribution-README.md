# Event Frequency Distribution Tool

## Overview

The Event Frequency Distribution Tool answers the question: **"How many users performed the event once and how many multiple times?"**

This tool provides insights into user engagement patterns by analyzing how frequently users perform events, helping you understand user behavior and engagement levels.

## Purpose

- **User Engagement Analysis**: Understand how engaged your users are with specific events
- **Behavior Pattern Recognition**: Identify users who are one-time vs. repeat performers
- **Conversion Optimization**: Find opportunities to increase user engagement
- **Event Performance Metrics**: Measure the effectiveness of different events

## How It Works

The tool counts how many unique users (sessions) performed events and categorizes them into:
- **Users with one event**: Users who performed the event exactly once
- **Users with multiple events**: Users who performed the event 2 or more times

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `websiteId` | string | Yes | - | The website ID to analyze |
| `days` | number | No | 7 | Number of days to look back from end date |
| `date_from` | string | No | - | Start date (YYYY-MM-DD format) |
| `date_to` | string | No | - | End date (YYYY-MM-DD format) |
| `event_name` | string | No | - | Specific event name to filter by (if not provided, analyzes all events) |
| `timezone` | string | No | - | Timezone for date calculations |

## Usage Examples

### 1. Analyze All Events (Last 7 Days)
```typescript
// Get distribution for all events in the last 7 days
const result = await getEventFrequencyDistribution({
  websiteId: "your-website-id"
});
```

### 2. Analyze Specific Event (Last 30 Days)
```typescript
// Get distribution for button_click events in the last 30 days
const result = await getEventFrequencyDistribution({
  websiteId: "your-website-id",
  days: 30,
  event_name: "button_click"
});
```

### 3. Analyze Custom Date Range
```typescript
// Get distribution for form_submit events in a specific date range
const result = await getEventFrequencyDistribution({
  websiteId: "your-website-id",
  date_from: "2024-01-01",
  date_to: "2024-01-31",
  event_name: "form_submit"
});
```

## Response Format

```typescript
{
  days: 7,
  start_date: "2024-01-01",
  end_date: "2024-01-07",
  filter: "button_click", // or "all_events"
  summary: {
    users_with_one_event: 45,
    users_with_multiple_events: 23,
    total_unique_users: 68
  },
  percentages: {
    one_event: "66.2%",
    multiple_events: "33.8%"
  },
  breakdown: [
    { event_count: 1, user_count: 45 },
    { event_count: 2, user_count: 12 },
    { event_count: 3, user_count: 8 },
    { event_count: 4, user_count: 3 }
  ],
  analysis: {
    question: "How many users performed the event once and how many multiple times?",
    answer: "45 users (66.2%) performed the event once, while 23 users (33.8%) performed it multiple times.",
    total_users: 68
  }
}
```

## Key Metrics Explained

### Summary Metrics
- **`users_with_one_event`**: Count of users who performed the event exactly once
- **`users_with_multiple_events`**: Count of users who performed the event 2 or more times
- **`total_unique_users`**: Total count of unique users who performed the event

### Percentage Metrics
- **`one_event`**: Percentage of users who performed the event once
- **`multiple_events`**: Percentage of users who performed the event multiple times

### Detailed Breakdown
- **`breakdown`**: Array showing the exact count of users for each event frequency
  - `event_count`: Number of times the event was performed
  - `user_count`: Number of users who performed it that many times

## Use Cases

### 1. **E-commerce Analysis**
```typescript
// Analyze purchase events
const purchaseAnalysis = await getEventFrequencyDistribution({
  websiteId: "your-website-id",
  event_name: "purchase",
  days: 30
});
// Results: How many users made one purchase vs. multiple purchases
```

### 2. **Content Engagement**
```typescript
// Analyze article read events
const readAnalysis = await getEventFrequencyDistribution({
  websiteId: "your-website-id",
  event_name: "article_read",
  days: 7
});
// Results: How many users read one article vs. multiple articles
```

### 3. **Feature Adoption**
```typescript
// Analyze feature usage events
const featureAnalysis = await getEventFrequencyDistribution({
  websiteId: "your-website-id",
  event_name: "feature_used",
  days: 14
});
// Results: How many users used the feature once vs. multiple times
```

### 4. **Overall Engagement**
```typescript
// Analyze all events for overall engagement
const overallAnalysis = await getEventFrequencyDistribution({
  websiteId: "your-website-id",
  days: 30
});
// Results: How many users are generally engaged (perform multiple events)
```

## Interpretation Guidelines

### High One-Event Percentage (>70%)
- **Meaning**: Most users are trying the event once but not repeating
- **Action**: Investigate why users aren't returning, improve onboarding, or fix usability issues

### Balanced Distribution (40-60%)
- **Meaning**: Healthy mix of new and returning users
- **Action**: Continue current strategies, focus on converting one-time users to repeat users

### High Multiple-Events Percentage (>60%)
- **Meaning**: Strong user engagement and retention
- **Action**: Leverage this engagement for upselling or feature adoption

## Database Compatibility

This tool is **database agnostic** and works with:
- **PostgreSQL** (via Prisma)
- **MySQL** (via Prisma) 
- **ClickHouse** (direct queries)

The tool automatically detects the database type and uses the appropriate query syntax.

## Testing

### Seed Data
```bash
# Generate test data
node scripts/seed-data/seed-event-frequency-distribution.js --reset-range

# Generate data for specific website
node scripts/seed-data/seed-event-frequency-distribution.js --website "your-website-id" --reset-range
```

### Test Tool
```bash
# Run tests
node scripts/test-tools/test-event-frequency-distribution.js
```

### API Testing
```bash
# Test via API
curl "http://localhost:3000/api/tools/get-event-frequency-distribution?websiteId=your-website-id&event_name=button_click"
```

## Related Tools

- **`get-event-frequency-per-user`**: Average events per user
- **`get-event-overview`**: General event statistics
- **`get-event-trends`**: Event performance over time
- **`get-most-frequent-events`**: Most popular events

## Best Practices

1. **Use Specific Event Names**: When possible, specify the event name for more focused analysis
2. **Consider Time Periods**: Use appropriate date ranges based on your event frequency
3. **Compare Periods**: Use the tool to compare different time periods for trend analysis
4. **Combine with Other Metrics**: Use this tool alongside conversion rates and user retention metrics
5. **Monitor Changes**: Track changes in distribution over time to measure improvement

## Troubleshooting

### Common Issues

1. **No Results**: Ensure the website has events in the specified date range
2. **Zero Users**: Check if the event name is correct and events exist
3. **Database Errors**: Verify database connectivity and permissions

### Performance Tips

- Use appropriate date ranges to avoid querying too much data
- Consider using `days` parameter instead of custom date ranges for recent data
- The tool automatically optimizes queries for the detected database type
