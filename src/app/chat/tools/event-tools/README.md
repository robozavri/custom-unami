# Event Tools

This directory contains tools for analyzing event data in the Umami analytics platform.

## Available Tools

### Overview Tools

- **`get-event-overview`** - Get comprehensive event overview including event count, unique users, frequency, and top events
- **`get-event-conversion-dropoff`** - Get event conversion rate, drop-off rate, and event ratio metrics

### Individual Property Tools

Each of these tools provides a focused view of a specific metric from the event overview:

- **`get-total-event-count`** - Get the total count of custom events for a website
- **`get-unique-users`** - Get the count of unique users who triggered custom events  
- **`get-event-frequency-per-user`** - Get the average number of events per user (event frequency)
- **`get-total-unique-events`** - Get the count of unique event types that occurred

## Tool Architecture

All tools follow the same pattern:

1. **Database Agnostic**: Each tool uses the `runQuery` wrapper to support both PostgreSQL and ClickHouse
2. **Consistent Parameters**: All tools accept the same parameter schema:
   - `websiteId` (optional) - specific website to analyze
   - `days` (default: 7) - number of days to analyze
   - `date_from` (optional) - start date in YYYY-MM-DD format
   - `date_to` (optional) - end date in YYYY-MM-DD format
   - `event_name` (optional) - filter by specific event type
   - `timezone` (optional) - timezone for date calculations

3. **Standardized Output**: Each tool returns consistent date range information and focused metrics

## Database Queries

Each tool has its own database-agnostic query function in `src/queries/sql/events/`:

- `getTotalEventCount.ts` - Counts total events
- `getUniqueUsers.ts` - Counts unique users/sessions
- `getEventFrequencyPerUser.ts` - Calculates events per user ratio
- `getTotalUniqueEvents.ts` - Counts distinct event types

## Usage Examples

### Get Total Event Count
```typescript
// Get events for last 7 days
await getTotalEventCountTool.execute({ days: 7 });

// Get events for specific date range
await getTotalEventCountTool.execute({ 
  date_from: '2025-08-01', 
  date_to: '2025-08-31' 
});

// Get events for specific event type
await getTotalEventCountTool.execute({ 
  event_name: 'Start Free Trial',
  days: 30 
});
```

### Get Event Frequency Per User
```typescript
// Get average events per user for last 14 days
await getEventFrequencyPerUserTool.execute({ days: 14 });

// Returns calculation breakdown:
// {
//   event_frequency_per_user: 4.67,
//   supporting_metrics: {
//     total_event_count: 1401,
//     unique_users: 300
//   },
//   calculation: "Total Events (1401) ÷ Unique Users (300) = 4.67"
// }
```

## Integration

All tools are automatically registered in the chat system through `src/app/chat/tools/registry.ts` and can be used immediately in the chat interface.

## Benefits of Individual Tools

1. **Focused Analysis**: Each tool provides a single, clear metric
2. **Performance**: Smaller, targeted queries are often faster than comprehensive overviews
3. **Flexibility**: Users can request only the specific data they need
4. **Maintainability**: Each tool has a single responsibility and is easier to debug
5. **Reusability**: Individual tools can be combined in different ways for custom analysis
