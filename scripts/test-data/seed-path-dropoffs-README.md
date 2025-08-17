### Test data seeders

Organized seed scripts for generating realistic data to test chat tools.

#### Seed: path drop-offs (for `get-detect-path-dropoffs`)

File: `scripts/test-data/seed-path-dropoffs.js`

Generates 14 days of realistic user navigation patterns with clear drop-off anomalies on day 8. Creates sessions and `website_event` rows with realistic page transitions and exit rates that the path drop-off detection tool can identify.

## What it creates

### Navigation Structure
- **Homepage** (`/`) → Pricing (35%), About (25%), Products (20%), Contact (15%), Blog (5%)
- **Pricing** (`/pricing`) → Signup (60%), Contact (25%), Home (10%), About (5%)
- **About** (`/about`) → Contact (40%), Home (35%), Products (20%), Pricing (5%)
- **Products** (`/products`) → Pricing (50%), Home (30%), Contact (15%), About (5%)
- **Contact** (`/contact`) → Home (60%), Pricing (25%), About (10%), Products (5%)
- **Signup** (`/signup`) → Dashboard (80%), Home (15%), Pricing (5%)
- **Blog** (`/blog`) → Home (70%), Products (20%), About (10%)
- **Dashboard** (`/dashboard`) → Profile (40%), Settings (30%), Home (20%), Logout (10%)

### Baseline Behavior (Days 1-7, 9-14)
- **200 visits per day** with 3.5 average pages per visit
- **Realistic exit rates**: Homepage (10%), Pricing (25%), About (30%), Products (20%), Contact (35%), Signup (15%), Blog (45%), Dashboard (5%)
- **Natural transition probabilities** between pages

### Anomaly Day (Day 8)
- **40% fewer visits** (120 instead of 200)
- **80% increase in exit rates** across all pages
- **40% decrease in transition probabilities** between pages
- **Shorter visit paths** (2.5 pages instead of 3.5)

## Usage

```bash
# Clean range and seed defaults (websiteId/date range below). Ensure DATABASE_URL is set.
node scripts/test-data/seed-path-dropoffs.js --website 5801af32-ebe2-4273-9e58-89de8971a2fd --from 2023-10-01 --days 14 --anomaly-index 7 --reset-range

# Minimal (uses defaults)
node scripts/test-data/seed-path-dropoffs.js

# Custom range without cleanup
node scripts/test-data/seed-path-dropoffs.js --website <WEBSITE_ID> --from 2023-12-01 --days 21 --anomaly-index 10
```

## Parameters

- `--website` / `--websiteId`: website UUID. If the website does not exist, it will be created with a basic name/domain.
- `--from` / `--start`: start date (YYYY-MM-DD), UTC.
- `--days`: number of consecutive days to populate.
- `--anomaly-index`: 0-based index for the anomaly day (e.g., 7 -> day 8).
- `--reset-range`: when provided, deletes existing `session` and `website_event` rows for the website in the date range before inserting.

## Expected Anomalies

The tool should detect these patterns:

### Exit Rate Anomalies
- **Pricing page**: Exit rate increases from 25% to 45% (80% increase)
- **All pages**: Significant increase in exit rates on anomaly day
- **Effect size**: Should be well above the default 0.15 threshold

### Step Drop-offs
- **Homepage → Pricing**: Transition probability drops from 35% to 21% (40% decrease)
- **Homepage → About**: Transition probability drops from 25% to 15%
- **All transitions**: 40% reduction in probability on anomaly day

## Next steps (tool invocation hints)

Use these parameters with the tool:

```json
{
  "websiteId": "<WEBSITE_ID>",
  "date_from": "<START_DATE>",
  "date_to": "<END_DATE>",
  "min_support": 100,
  "min_effect_size": 0.15,
  "sensitivity": "medium",
  "include_step_dropoffs": true,
  "normalize_paths": true
}
```

Where `<END_DATE>` is `<START_DATE> + days - 1`.

## Example Output

After running the seed script, you should see output like:

```
[seed] 2023-10-01 visits=200 pageviews=700
[seed] 2023-10-02 visits=200 pageviews=700
...
[seed] 2023-10-08 visits=120 pageviews=300 (ANOMALY - increased exits, decreased transitions)
...
[seed] 2023-10-14 visits=200 pageviews=700

Next: run the tool with parameters like:
websiteId=5801af32-ebe2-4273-9e58-89de8971a2fd date_from=2023-10-01 date_to=2023-10-14

Expected anomalies:
- Day 8: 40% fewer visits, 80% more exits, 40% fewer transitions
- /pricing page: exit rate increases from 25% to 45% on anomaly day
- Homepage → Pricing transition drops from 35% to 21% on anomaly day
```

## Data Quality

- **Realistic timing**: 1-5 minutes between pageviews
- **Natural variation**: Random distribution around baseline probabilities
- **Proper relationships**: Sessions, visits, and events properly linked
- **Event types**: All events use `event_type = 1` (pageview)
- **URL paths**: Clean, normalized paths without query parameters
