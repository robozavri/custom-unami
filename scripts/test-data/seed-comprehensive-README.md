# Comprehensive Seed Script

This script generates comprehensive test data including unique visits, events, and page visits with realistic device, browser, and geolocation data.

## Features

- **Unique Visits**: Each iteration creates a completely unique session with its own visit ID
- **Realistic Events**: Generates both pageview events and business events with proper event data
- **Page Visits**: Includes the requested paths: `/faqs`, `/features`, `/home`, `/integrations` plus additional realistic paths
- **Geolocation**: Imitates 15 different countries with realistic regions and cities
- **Device Variety**: Desktop, mobile, and tablet devices with appropriate screen resolutions
- **Browser Diversity**: Chrome, Firefox, Safari, Edge, and Samsung Browser across different devices
- **Operating Systems**: Windows, macOS, Linux, iOS, and Android
- **UTM Parameters**: Realistic traffic sources, mediums, and campaigns

## Usage

### Basic Usage (July-August 2024)
```bash
node seed-comprehensive.js
```

### Custom Date Range
```bash
node seed-comprehensive.js --from 2024-07-01 --to 2024-08-31
```

### Custom Website ID
```bash
node seed-comprehensive.js --website 12345678-1234-1234-1234-123456789012
```

### Reset Existing Data
```bash
node seed-comprehensive.js --reset-range
```

### Combined Options
```bash
node seed-comprehensive.js --from 2024-07-01 --to 2024-08-31 --website custom-id --reset-range
```

## Configuration

The script uses these default settings:
- **Date Range**: July 1, 2024 to August 31, 2024
- **Website ID**: `5801af32-ebe2-4273-9e58-89de8971a2fd`
- **Iterations per Day**: Random between 10-50
- **Pages per Session**: Random between 2-8
- **Business Event Rate**: 20% of sessions

## Generated Data

### Page Paths
- `/faqs` - Frequently Asked Questions
- `/features` - Product Features
- `/home` - Homepage
- `/integrations` - Integration Options
- `/pricing` - Pricing Plans
- `/about` - About Us
- `/contact` - Contact Information
- `/blog` - Blog Posts
- `/demo` - Demo Requests
- `/support` - Support Center
- `/api` - API Documentation
- `/docs` - Documentation
- `/tutorials` - Tutorials
- `/case-studies` - Case Studies
- `/team` - Team Information

### Business Events
- Start Free Trial
- Watch Demo
- Select Basic/Pro/Enterprise Plan
- Request Integration
- Contact Support
- Download Whitepaper
- Subscribe Newsletter
- Request Quote

### Countries & Regions
- United States (CA - San Francisco)
- Germany (BY - Berlin)
- United Kingdom (EN - London)
- France (IDF - Paris)
- Canada (ON - Toronto)
- Australia (NSW - Sydney)
- Japan (13 - Tokyo)
- Brazil (SP - São Paulo)
- India (MH - Mumbai)
- Netherlands (NH - Amsterdam)
- Italy (RM - Rome)
- Spain (MD - Madrid)
- Sweden (AB - Stockholm)
- Norway (OS - Oslo)
- Denmark (84 - Copenhagen)

### Devices & Browsers
- **Desktop**: Chrome, Firefox, Safari, Edge on Windows/macOS/Linux
- **Mobile**: Safari (iOS), Chrome (Android), Samsung Browser
- **Tablet**: Safari (iPad), Chrome (Android tablets)

## Database Schema

The script creates data in these tables:
- `session` - Unique visitor sessions with device/browser/geolocation data
- `website_event` - Page views and business events
- `event_data` - Custom data for business events

## Example Output

```
[seed:comprehensive] config { websiteId: '5801af32-ebe2-4273-9e58-89de8971a2fd', startDate: '2024-07-01', endDate: '2024-08-31', resetRange: false }
[seed:comprehensive] 2024-07-01 - generating 23 iterations
[seed:comprehensive] 2024-07-02 - generating 37 iterations
...
[seed:comprehensive] seeding completed successfully!
[seed:comprehensive] summary { 
  totalSessions: 1234, 
  totalEvents: 5678, 
  totalEventData: 890,
  dateRange: '2024-07-01 to 2024-08-31',
  paths: ['/faqs', '/features', '/home', '/integrations', ...],
  businessEvents: ['Start Free Trial', 'Watch Demo', ...],
  countries: 15,
  devices: 3
}
```

## Dependencies

- Node.js with Prisma client
- Database connection (MySQL/PostgreSQL)
- Environment variables for database connection

## Notes

- Each session gets a unique `sessionId` and `visitId`
- Page visits are generated sequentially within each session
- Business events occur 5-30 minutes after session start
- All data is properly batched for efficient database insertion
- The script handles cleanup of existing data when using `--reset-range`
