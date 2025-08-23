# Average Events Per Session Tool

## Overview

The Average Events Per Session Tool answers the question: **"What is the average number of events per session?"**

This tool provides insights into user engagement patterns by analyzing how many events users typically perform during a single session, helping you understand user behavior and website engagement levels.

## Purpose

- **User Engagement Analysis**: Understand how engaged your users are during individual sessions
- **Session Quality Assessment**: Measure the depth of user interactions per visit
- **Conversion Optimization**: Identify opportunities to increase session engagement
- **Performance Metrics**: Track how well your website retains user attention

## How It Works

The tool calculates the average number of events per session by:
1. Counting total events in the specified date range
2. Counting unique sessions in the same period
3. Dividing total events by total sessions
4. Providing a detailed breakdown of session distribution

## Parameters

- **websiteId** (optional): Specific website to analyze
- **days** (default: 7): Number of days to look back from today
- **date_from** (optional): Start date in YYYY-MM-DD format
- **date_to** (optional): End date in YYYY-MM-DD format
- **event_name** (optional): Filter by specific event type
- **timezone** (optional): Timezone for date calculations

## Response Format

```json
{
  "days": 7,
  "start_date": "2025-08-16",
  "end_date": "2025-08-23",
  "filter": "all_events",
  "summary": {
    "average_events_per_session": 4.67,
    "total_sessions": 1050,
    "total_events": 4903
  },
  "breakdown": [
    {
      "events_per_session": 1,
      "session_count": 91,
      "percentage": 8.7
    },
    {
      "events_per_session": 2,
      "session_count": 95,
      "percentage": 9.0
    }
  ],
  "analysis": {
    "question": "What is the average number of events per session?",
    "answer": "The average number of events per session is 4.67. This is calculated from 4903 total events across 1050 unique sessions.",
    "insights": [
      "Most sessions have 1 events",
      "8.7% of sessions are single-event sessions",
      "The distribution shows how engaged users are with your website"
    ]
  }
}
```

## Use Cases

### 1. Overall Engagement Analysis
```json
{
  "days": 30
}
```
Shows the average events per session across all event types for the last 30 days.

### 2. Specific Event Analysis
```json
{
  "days": 7,
  "event_name": "Start Free Trial"
}
```
Shows the average number of "Start Free Trial" events per session for the last 7 days.

### 3. Custom Date Range
```json
{
  "date_from": "2025-07-01",
  "date_to": "2025-07-31"
}
```
Analyzes a specific date range for average events per session.

## Interpretation

- **High average** (>5 events/session): Users are highly engaged and perform many actions
- **Medium average** (3-5 events/session): Normal engagement levels
- **Low average** (<3 events/session): Users may be leaving quickly or not finding value

## Examples

### Example 1: High Engagement Website
- Average: 6.2 events per session
- Breakdown: Many sessions with 5+ events
- Insight: Users are deeply engaged with your content

### Example 2: Low Engagement Website
- Average: 2.1 events per session
- Breakdown: Most sessions have 1-2 events
- Insight: Users may be bouncing quickly or not finding what they need

### Example 3: Specific Event Analysis
- Event: "Purchase"
- Average: 1.8 events per session
- Insight: Users typically make purchases after minimal interaction

## Best Practices

1. **Compare Time Periods**: Track changes in engagement over time
2. **Segment by Event Type**: Analyze different user behaviors separately
3. **Correlate with Conversion**: Link engagement to business outcomes
4. **Monitor Trends**: Watch for changes in user behavior patterns

## Related Tools

- **Event Frequency Distribution**: See how many users perform events once vs. multiple times
- **Event Overview**: Get comprehensive event analytics
- **User Behavior**: Analyze broader user interaction patterns

## Technical Details

- **Database Agnostic**: Works with PostgreSQL, MySQL, and ClickHouse
- **Efficient Queries**: Uses optimized SQL with proper indexing
- **Real-time Data**: Processes current data from your analytics database
- **Scalable**: Handles large datasets efficiently
