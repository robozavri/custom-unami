# Segmented Events Seed Script

This seed script is specifically designed to test the `get-segmented-events` tool with rich, diverse segmentation data.

## Purpose

Creates test data optimized for segmentation analysis by:
- Generating diverse user segments (countries, devices, browsers, plans)
- Creating multiple event types with realistic probabilities
- Providing rich event metadata for detailed analysis
- Ensuring balanced distribution across different segments

## Features

### Enhanced Segmentation Data
- **15 countries** with realistic geographic distribution
- **9 device types** (desktop, mobile, tablet) with different OS and screen sizes
- **5 browser types** with version information
- **4 plan tiers** (free, starter, professional, enterprise)

### Diverse Event Types
- **10 event types** with realistic probability distribution:
  - Page View (40%)
  - Button Click (15%)
  - Form Submit (10%)
  - File Download (8%)
  - Video Play (7%)
  - Scroll Depth (6%)
  - Search Query (5%)
  - Add to Cart (4%)
  - Purchase (3%)
  - User Registration (2%)

### Rich Event Properties
Each custom event includes relevant metadata:
- Button Click: button text, location, page section
- Form Submit: form type, field count, completion time
- File Download: file type, size, source
- Video Play: title, duration, category
- And more...

## Usage

### Basic Usage
```bash
node scripts/test-data/seed-segmented-events.js
```

### With Custom Parameters
```bash
node scripts/test-data/seed-segmented-events.js \
  --website "your-website-id" \
  --from "2024-07-01" \
  --to "2024-08-31" \
  --reset-range
```

### Parameters
- `--website` / `--websiteId`: Target website ID (default: comprehensive test website)
- `--from` / `--start`: Start date (YYYY-MM-DD, default: 2024-07-01)
- `--to` / `--end`: End date (YYYY-MM-DD, default: 2024-08-31)
- `--reset-range`: Clear existing data in the specified date range before seeding

## Data Generation

### Daily Volume
- **15-40 iterations per day** (randomized for realistic variation)
- **3-8 events per session** (varies by user behavior)
- **Rich segmentation data** for each session

### Session Structure
Each session includes:
- Unique user identifier
- Geographic location (country, region, city)
- Device information (type, OS, screen size)
- Browser details
- Multiple events with realistic timing

## Testing the get-segmented-events Tool

### Example Tool Calls

#### Segment by Country
```javascript
{
  name: "get-segmented-events",
  params: {
    segment_by: "country",
    event_name: "Button Click",
    date_from: "2024-07-01",
    date_to: "2024-08-31"
  }
}
```

#### Segment by Device
```javascript
{
  name: "get-segmented-events",
  params: {
    segment_by: "device",
    event_name: "Form Submit",
    date_from: "2024-07-01",
    date_to: "2024-08-31"
  }
}
```

#### Segment by Browser
```javascript
{
  name: "get-segmented-events",
  params: {
    segment_by: "browser",
    event_name: "File Download",
    date_from: "2024-07-01",
    date_to: "2024-08-31"
  }
}
```

### Expected Results
- **Balanced distribution** across different segments
- **Realistic event counts** per segment
- **Meaningful user counts** for each segment
- **Rich metadata** for detailed analysis

## Data Quality Features

### Realistic Patterns
- Events follow realistic probability distributions
- User behavior varies by segment type
- Geographic distribution mimics real-world patterns
- Device/browser combinations are realistic

### Consistent Data
- All sessions have complete segmentation data
- Event metadata is consistent with event types
- Timestamps follow logical session flow
- User identifiers are unique and traceable

## Performance Considerations

### Batch Processing
- Sessions processed in batches of 500
- Events processed in batches of 500
- Event data processed in batches of 500
- Database transactions with appropriate timeouts

### Memory Management
- Efficient data generation without excessive memory usage
- Progressive processing with regular progress updates
- Cleanup of existing data when using `--reset-range`

## Comparison with Other Seeds

### vs. seed-comprehensive.js
- **More diverse segmentation** (15 countries vs. 10)
- **Richer event types** (10 vs. 10 but with better distribution)
- **Enhanced event metadata** for deeper analysis
- **Optimized for segmentation tools**

### vs. seed-events.js
- **Better geographic distribution** for country segmentation
- **More realistic device/browser combinations**
- **Enhanced user behavior patterns**
- **Optimized for returning user analysis**

## Troubleshooting

### Common Issues
1. **Database connection errors**: Ensure your database is running and accessible
2. **Permission errors**: Check database user permissions
3. **Memory issues**: Reduce batch sizes if processing large date ranges
4. **Timeout errors**: Increase database timeout settings if needed

### Data Validation
After seeding, verify data quality:
```sql
-- Check segmentation distribution
SELECT device, COUNT(*) FROM session GROUP BY device;

-- Verify event types
SELECT event_name, COUNT(*) FROM website_event WHERE event_type = 2 GROUP BY event_name;

-- Check geographic distribution
SELECT country, COUNT(*) FROM session GROUP BY country;
```

## Next Steps

After running this seed:
1. Test the `get-segmented-events` tool with different segment types
2. Analyze event distribution across segments
3. Test filtering by specific event names
4. Validate segmentation accuracy and completeness
