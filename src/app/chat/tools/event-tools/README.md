# Event Tools

This directory contains tools for analyzing and working with event data in Umami.

## Tools

### Event Overview Tool (`get-event-overview`)

A comprehensive tool that provides an overview of event metrics including:

- **Event Count**: Total number of events that occurred
- **Unique Users**: Number of unique users who performed events
- **Event Frequency per User**: Average number of events per user
- **Top Events**: List of most frequently occurring events
- **Event Breakdown**: Detailed breakdown of all events with counts and unique users

#### Usage

```typescript
// Basic usage - last 7 days
await getEventOverviewTool.execute({});

// Custom date range
await getEventOverviewTool.execute({
  date_from: '2024-01-01',
  date_to: '2024-01-31'
});

// Filter by specific event
await getEventOverviewTool.execute({
  event_name: 'button_click',
  days: 30
});
```

#### Parameters

- `websiteId` (optional): Specific website ID to analyze
- `days` (default: 7): Number of days to look back if no date range specified
- `date_from` (optional): Start date in YYYY-MM-DD format
- `date_to` (optional): End date in YYYY-MM-DD format
- `event_name` (optional): Filter results to specific event name
- `timezone` (optional): Timezone for date calculations

#### Output

```typescript
{
  days: 7,
  start_date: '2024-01-01',
  end_date: '2024-01-07',
  filter: 'all_events',
  summary: {
    total_event_count: 1500,
    unique_users: 300,
    event_frequency_per_user: 5.0,
    total_unique_events: 25
  },
  top_events: [
    {
      event_name: 'button_click',
      event_count: 500,
      unique_users: 200
    }
    // ... more events
  ],
  results: [
    // ... all events with counts and unique users
  ]
}
```

## Database Support

All tools in this directory are database-agnostic and support:
- PostgreSQL
- MySQL  
- ClickHouse

The tools automatically detect the database type and use appropriate query syntax and optimizations.

## Architecture

The Event Overview Tool follows the established Umami pattern:
- **Tool Implementation**: `src/app/chat/tools/event-tools/get-event-overview.ts`
- **SQL Queries**: `src/queries/sql/events/getEventOverview.ts`
- **Database Abstraction**: Uses the `runQuery` pattern for automatic database type detection

This separation ensures:
- Clean separation of concerns
- Reusable SQL queries
- Consistent database-agnostic implementation
- Easy maintenance and testing
