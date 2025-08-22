# Get Most Frequent Events Tool

## Overview

The `get-most-frequent-events` tool answers the question: **"რომელი event-ებია ყველაზე ხშირად გამოყენებული?"** (Which events are used most frequently?)

This tool analyzes custom events for a website and returns them ranked by frequency, providing insights into which user actions are most common.

## Purpose

- **Event Frequency Analysis**: Identify which custom events occur most often
- **User Behavior Insights**: Understand what actions users take most frequently
- **Feature Usage Tracking**: Monitor which features or interactions are most popular
- **Performance Optimization**: Focus on high-frequency events for optimization

## Tool Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `websiteId` | string | No | Auto-resolved | Website ID to analyze |
| `days` | number | No | 30 | Number of days to analyze (if no date range specified) |
| `date_from` | string | No | days ago | Start date (YYYY-MM-DD) |
| `date_to` | string | No | today | End date (YYYY-MM-DD) |
| `limit` | number | No | 10 | Maximum number of events to return (max 100) |
| `timezone` | string | No | UTC | Timezone for date calculations |

## Response Format

```json
{
  "days": 30,
  "start_date": "2024-07-01",
  "end_date": "2024-07-31",
  "limit": 10,
  "total_events": 15420,
  "period": {
    "startDate": "2024-07-01",
    "endDate": "2024-07-31"
  },
  "most_frequent_events": [
    {
      "event_name": "button_click",
      "event_count": 6168,
      "percentage": 40.0
    },
    {
      "event_name": "form_submit",
      "event_count": 3855,
      "percentage": 25.0
    },
    {
      "event_name": "add_to_cart",
      "event_count": 2313,
      "percentage": 15.0
    }
  ]
}
```

## Use Cases

### 1. **User Experience Analysis**
- Identify which UI elements users interact with most
- Understand user workflow patterns
- Optimize high-traffic features

### 2. **Feature Popularity Tracking**
- Monitor which features are most used
- Track feature adoption over time
- Identify underutilized features

### 3. **Performance Monitoring**
- Focus optimization efforts on high-frequency events
- Identify bottlenecks in popular user paths
- Monitor event processing performance

### 4. **Business Intelligence**
- Understand user behavior patterns
- Track conversion funnel performance
- Identify opportunities for feature development

## Example Queries

### Basic Usage
```javascript
// Get top 10 most frequent events in last 30 days
await getMostFrequentEventsTool.execute({
  days: 30,
  limit: 10
});
```

### Custom Date Range
```javascript
// Analyze specific date range
await getMostFrequentEventsTool.execute({
  date_from: '2024-07-01',
  date_to: '2024-07-31',
  limit: 20
});
```

### Website-Specific Analysis
```javascript
// Analyze specific website
await getMostFrequentEventsTool.execute({
  websiteId: 'specific-website-id',
  days: 60,
  limit: 15
});
```

## Database Support

This tool is **database-agnostic** and supports:
- **PostgreSQL** (via Prisma)
- **MySQL** (via Prisma)  
- **ClickHouse** (direct queries)

## Performance Considerations

- **Indexing**: Ensure proper indexes on `website_id`, `created_at`, and `event_name`
- **Date Ranges**: Large date ranges may impact performance
- **Event Volume**: High event volumes may require query optimization
- **Limit**: Use reasonable limits (default 10, max 100)

## Related Tools

- **`get-total-event-count`**: Get total event count for comparison
- **`get-event-overview`**: Comprehensive event analysis
- **`get-event-trends`**: Event frequency trends over time
- **`get-segmented-events`**: Events broken down by segments

## Testing

Use the provided test files to validate the tool:

1. **Seed Data**: `scripts/seed-data/seed-most-frequent-events.js`
2. **Test Tool**: `scripts/test-tools/test-most-frequent-events.js`

### Running Tests
```bash
# Generate test data
node scripts/seed-data/seed-most-frequent-events.js --reset-range

# Test the tool
node scripts/test-tools/test-most-frequent-events.js
```

## Implementation Details

- **Event Type Filtering**: Only analyzes custom events (event_type = 1)
- **Percentage Calculation**: Based on total events in the specified period
- **Ranking**: Events ordered by frequency (highest to lowest)
- **Data Aggregation**: Uses database GROUP BY for efficient counting
- **Error Handling**: Graceful handling of missing data and edge cases

## Future Enhancements

- **Segment Analysis**: Break down by user segments (country, device, etc.)
- **Trend Analysis**: Compare frequency across different time periods
- **Event Correlation**: Identify related event patterns
- **Real-time Updates**: Live event frequency monitoring
