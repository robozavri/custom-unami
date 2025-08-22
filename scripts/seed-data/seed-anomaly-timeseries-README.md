### Test data seeders

Organized seed scripts for generating realistic data to test chat tools.

#### Seed: anomaly timeseries (for `get-detect-timeseries-anomalies`)

File: `scripts/test-data/seed-anomaly-timeseries.js`

Generates 14 days of pageview events with a clear spike on day 8, creating sessions and `website_event` rows compatible with the Prisma schema. Use this to validate anomaly detection across different sensitivities and intervals.

Usage:

```bash
# Clean range and seed defaults (websiteId/date range below). Ensure DATABASE_URL is set.
node scripts/test-data/seed-anomaly-timeseries.js --website 5801af32-ebe2-4273-9e58-89de8971a2fd --from 2023-10-01 --days 14 --anomaly-index 7 --reset-range

# Minimal (uses defaults)
node scripts/test-data/seed-anomaly-timeseries.js

# Custom range without cleanup
node scripts/test-data/seed-anomaly-timeseries.js --website <WEBSITE_ID> --from 2023-12-01 --days 21 --anomaly-index 10
```

Parameters:

- `--website` / `--websiteId`: website UUID. If the website does not exist, it will be created with a basic name/domain.
- `--from` / `--start`: start date (YYYY-MM-DD), UTC.
- `--days`: number of consecutive days to populate.
- `--anomaly-index`: 0-based index for the spike day (e.g., 7 -> day 8).
- `--reset-range`: when provided, deletes existing `session` and `website_event` rows for the website in the date range before inserting.

What it creates:

- Sessions: ~5 to ~10 per day (depends on pageviews).
- Pageviews: 12–20 per baseline day; spike is ~2.5x on the anomaly day.
- Events use `event_type = 1` (pageview), provide `visit_id`, `session_id`, `url_path`, `created_at`.

Next steps (tool invocation hints):

Use these parameters with the tool:

```json
{
  "metric": "pageviews",
  "date_from": "<START_DATE>",
  "date_to": "<END_DATE>",
  "interval": "day",
  "sensitivity": "medium",
  "websiteId": "<WEBSITE_ID>"
}
```

Where `<END_DATE>` is `<START_DATE> + days - 1`.


