# Conversion Drop Insights Tools

This directory contains tools for analyzing conversion performance and detecting drops in conversion rates.

## Tools

### check-total-conversion-drop

Compares total conversion performance between two time periods and calculates whether there is a drop in conversion rate or count.

**Input Parameters:**
- `websiteId` (optional): UUID of the website. If not provided, uses active website or default.
- `conversionEvent`: Name of the event considered a conversion (e.g., "purchase", "signup")
- `currentFrom`: Start of current period (YYYY-MM-DD format)
- `currentTo`: End of current period (YYYY-MM-DD format)
- `previousFrom`: Start of comparison period (YYYY-MM-DD format)
- `previousTo`: End of comparison period (YYYY-MM-DD format)

**Output:**
Returns conversion metrics for both periods and change analysis:
- Current period: conversions, unique visitors, conversion rate
- Previous period: conversions, unique visitors, conversion rate
- Change: rate delta, percent change, direction (increase/decrease/no_change)

**Example Usage:**
```json
{
  "conversionEvent": "purchase",
  "currentFrom": "2024-01-01",
  "currentTo": "2024-01-31",
  "previousFrom": "2023-12-01",
  "previousTo": "2023-12-31"
}
```

**Formula:**
- Conversion rate = conversions / unique visitors
- Delta = conversion_rate_current - conversion_rate_previous
- % Change = (delta / conversion_rate_previous) * 100
- Direction threshold: 0.5% to avoid noise

**Database Support:**
- PostgreSQL (via Prisma)
- ClickHouse
- Database-agnostic SQL queries
