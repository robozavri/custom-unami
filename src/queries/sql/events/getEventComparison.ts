import prisma from '@/lib/prisma';
import clickhouse from '@/lib/clickhouse';
import { getDatabaseType } from '@/lib/db';

export interface EventComparisonResult {
  addToCartCount: number;
  checkoutCount: number;
  successRate: number;
  totalEvents: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

export async function getEventComparison(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  addEventName: string = 'add_to_cart',
  checkoutEventName: string = 'checkout_success',
): Promise<EventComparisonResult> {
  const dbType = await getDatabaseType();

  if (dbType === 'clickhouse') {
    return clickhouseQuery(websiteId, startDate, endDate, addEventName, checkoutEventName);
  } else {
    return relationalQuery(websiteId, startDate, endDate, addEventName, checkoutEventName);
  }
}

async function relationalQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  addEventName: string,
  checkoutEventName: string,
): Promise<EventComparisonResult> {
  const [addToCartResult, checkoutResult] = await Promise.all([
    prisma.client.websiteEvent.count({
      where: {
        websiteId,
        eventName: addEventName,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        eventType: 2, // Custom events
      },
    }),
    prisma.client.websiteEvent.count({
      where: {
        websiteId,
        eventName: checkoutEventName,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        eventType: 2, // Custom events
      },
    }),
  ]);

  const successRate = addToCartResult > 0 ? (checkoutResult / addToCartResult) * 100 : 0;

  return {
    addToCartCount: addToCartResult,
    checkoutCount: checkoutResult,
    successRate: Math.round(successRate * 100) / 100,
    totalEvents: addToCartResult + checkoutResult,
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

async function clickhouseQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  addEventName: string,
  checkoutEventName: string,
): Promise<EventComparisonResult> {
  const query = `
    SELECT 
      event_name,
      count() as event_count
    FROM website_event 
    WHERE website_id = {websiteId:String}
      AND event_name IN ({addEventName:String}, {checkoutEventName:String})
      AND event_type = 2
      AND created_at >= {startDate:DateTime}
      AND created_at <= {endDate:DateTime}
    GROUP BY event_name
  `;

  const result = await clickhouse.client.query({
    query,
    query_params: {
      websiteId,
      addEventName,
      checkoutEventName,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  });

  const rows = await result.json();

  let addToCartCount = 0;
  let checkoutCount = 0;

  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (row.event_name === addEventName) {
        addToCartCount = parseInt(row.event_count);
      } else if (row.event_name === checkoutEventName) {
        checkoutCount = parseInt(row.event_count);
      }
    }
  }

  const successRate = addToCartCount > 0 ? (checkoutCount / addToCartCount) * 100 : 0;

  return {
    addToCartCount,
    checkoutCount,
    successRate: Math.round(successRate * 100) / 100,
    totalEvents: addToCartCount + checkoutCount,
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}
