### Seed: Advanced timeseries anomalies (for `get-detect-timeseries-anomalies`)

Creates realistic `session` and `website_event` rows with controlled anomalies for metrics: visits, pageviews, bounce rate, and visit duration. Supports day or hour granularity (weekly works by aggregating days from this seed).

Works with the Prisma schema used by the tool's SQL (`website_event` is queried for visits/pageviews/bounce/duration buckets).

#### File

`scripts/test-data/seed-timeseries-anomalies-advanced.js`

#### Usage

```bash
# Minimal (uses defaults; website will be created if missing)
node scripts/test-data/seed-timeseries-anomalies-advanced.js

# Explicit params, clean range, make a pageviews spike on the 11th bucket
node scripts/test-data/seed-timeseries-anomalies-advanced.js \
  --website 5801af32-ebe2-4273-9e58-89de8971a2fd \
  --from 2024-01-01 \
  --days 21 \
  --interval day \
  --metric pageviews \
  --anomaly-index 10 \
  --direction spike \
  --magnitude 2.0 \
  --reset-range

# Hourly example: bounce rate dip on hour index 30
node scripts/test-data/seed-timeseries-anomalies-advanced.js \
  --from 2024-02-01 --days 3 --interval hour --metric bounce_rate \
  --anomaly-index 30 --direction dip --magnitude 2.5 --reset-range
```

#### Parameters

- `--website` / `--websiteId`: target website UUID. Default uses the chat config ID.
- `--from` / `--start`: start date (UTC date only).
- `--days`: number of consecutive days to populate (also drives hourly length = days*24).
- `--interval`: `hour` or `day`. Weekly buckets are derived by the tool from daily.
- `--metric`: `visits` | `pageviews` | `bounce_rate` | `visit_duration`.
- `--anomaly-index`: 0-based index of the bucket to make anomalous.
- `--direction`: `spike` or `dip`.
- `--magnitude`: positive multiplier for anomaly effect (>= 1.0 recommended).
- `--reset-range`: delete existing rows for the website and date range before seeding.

#### What it generates

- Sessions per bucket with timestamps in the bucket.
- Pageview events (`event_type = 1`) spread across sessions to achieve totals.
- Bounce control by making a subset of sessions single-pageview.
- Session duration control by spacing pageviews within a session.

#### Testing the tool

Example tool payload after seeding:

```json
{
  "metric": "pageviews",
  "interval": "day",
  "date_from": "2024-01-01",
  "date_to": "2024-01-21",
  "websiteId": "5801af32-ebe2-4273-9e58-89de8971a2fd",
  "sensitivity": "medium"
}
```

The first 7 buckets form the rolling baseline; anomalies should appear at the configured bucket when magnitude is sufficient (threshold depends on sensitivity).

#### Notes

- Ensure `DATABASE_URL` is set in your environment.
- If using ClickHouse, this seed populates the relational schema via Prisma. The tool can query either backend; for ClickHouse testing, mirror rows appropriately or use the relational path.
- Keep `days >= 8` so the rolling baseline (7 prior buckets) is available.


