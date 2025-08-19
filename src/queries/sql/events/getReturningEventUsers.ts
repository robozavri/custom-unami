import clickhouse from '@/lib/clickhouse';
import { EVENT_TYPE } from '@/lib/constants';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface ReturningEventUsersResult {
  periods: Array<{
    period: string;
    total_users: number;
    returning_users: number;
    returning_rate: number;
  }>;
}

export async function getReturningEventUsers(
  ...args: [
    websiteId: string,
    startDate: Date,
    endDate: Date,
    granularity: 'day' | 'week' | 'month',
    eventName?: string,
  ]
): Promise<ReturningEventUsersResult> {
  return runQuery({
    [PRISMA]: () => relationalQuery(...args),
    [CLICKHOUSE]: () => clickhouseQuery(...args),
  });
}

async function relationalQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  granularity: 'day' | 'week' | 'month',
  eventName?: string,
): Promise<ReturningEventUsersResult> {
  const { rawQuery } = prisma;

  // console.log('[getReturningEventUsers] relationalQuery called with:', {
  //   websiteId,
  //   startDate: startDate.toISOString(),
  //   endDate: endDate.toISOString(),
  //   granularity,
  //   eventName,
  // });

  // Build event filter (ignore empty string)
  const hasEventFilter = !!(eventName && String(eventName).trim());
  const eventFilter = hasEventFilter ? 'and event_name = {{eventName}}' : '';

  // Determine date trunc function based on granularity
  const dateTrunc = granularity === 'day' ? 'day' : granularity === 'week' ? 'week' : 'month';

  const query = `
    SELECT 
      s.distinct_id as user_id,
      date_trunc('${dateTrunc}', e.created_at) AS period
    FROM website_event e
    JOIN session s ON s.session_id = e.session_id
    WHERE e.website_id = {{websiteId::uuid}}
      AND e.created_at BETWEEN {{startDate}} AND {{endDate}}
      AND e.event_type = {{eventType}}
      ${eventFilter}
      AND s.distinct_id IS NOT NULL
    GROUP BY s.distinct_id, date_trunc('${dateTrunc}', e.created_at)
    ORDER BY period, user_id
  `;

  const params = {
    websiteId,
    startDate,
    endDate,
    eventType: EVENT_TYPE.customEvent,
    ...(hasEventFilter && { eventName }),
  };

  // console.log('[getReturningEventUsers] PostgreSQL query:', query);
  // console.log('[getReturningEventUsers] PostgreSQL params:', params);

  // Get user events grouped by period (distinct users)
  const userEventsResult = await rawQuery(query, params);

  // console.log('[getReturningEventUsers] PostgreSQL raw result:', userEventsResult);
  // console.log('[getReturningEventUsers] PostgreSQL result type:', typeof userEventsResult);
  // console.log(
  //   '[getReturningEventUsers] PostgreSQL result length:',
  //   Array.isArray(userEventsResult) ? userEventsResult.length : 'not array',
  // );

  // Process results to calculate returning users
  // console.log('[getReturningEventUsers] Starting to process results...');

  const periodMap = new Map<string, Set<string>>();
  const userMap = new Map<string, Set<string>>();

  // Group users by period
  // console.log('[getReturningEventUsers] Processing rows:', userEventsResult.length);

  userEventsResult.forEach((row: any, index: number) => {
    if (index < 5) {
      // Log first 5 rows for debugging
      // console.log(`[getReturningEventUsers] Row ${index}:`, row);
    }

    // Convert period to a consistent string format
    const period =
      row.period instanceof Date ? row.period.toISOString().split('T')[0] : String(row.period);
    const userId = row.user_id;

    // console.log(`[getReturningEventUsers] Processed row ${index}: period="${period}", sessionId="${sessionId}"`);

    if (!periodMap.has(period)) {
      periodMap.set(period, new Set());
    }
    periodMap.get(period)!.add(userId);

    if (!userMap.has(userId)) {
      userMap.set(userId, new Set());
    }
    userMap.get(userId)!.add(period);
  });

  // console.log('[getReturningEventUsers] Period map size:', periodMap.size);
  // console.log('[getReturningEventUsers] User map size:', userMap.size);

  // Debug: Show what's in the period map
  // console.log('[getReturningEventUsers] Period map contents:');
  // periodMap.forEach((users, period) => {
  //   console.log(`  Period "${period}": ${users.size} users`);
  // });

  // Calculate returning users for each period
  const periods = Array.from(periodMap.keys()).sort();
  // console.log('[getReturningEventUsers] Sorted periods:', periods);

  const result = periods.map((period, index) => {
    const currentUsers = periodMap.get(period)!;
    const totalUsers = currentUsers.size;

    let returningUsers = 0;
    if (index > 0) {
      const previousPeriods = periods.slice(0, index);
      const previousUsers = new Set<string>();
      previousPeriods.forEach(p => {
        periodMap.get(p)!.forEach(user => previousUsers.add(user));
      });

      returningUsers = Array.from(currentUsers).filter(user => previousUsers.has(user)).length;
    }

    const returningRate = totalUsers > 0 ? (returningUsers / totalUsers) * 100 : 0;

    const periodResult = {
      period,
      total_users: totalUsers,
      returning_users: returningUsers,
      returning_rate: Math.round(returningRate * 100) / 100, // Round to 2 decimal places
    };

    // console.log(`[getReturningEventUsers] Period ${period} result:`, periodResult);

    return periodResult;
  });

  // console.log('[getReturningEventUsers] Final result:', { periods: result });
  return { periods: result };
}

async function clickhouseQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  granularity: 'day' | 'week' | 'month',
  eventName?: string,
): Promise<ReturningEventUsersResult> {
  const { rawQuery } = clickhouse;

  // console.log('[getReturningEventUsers] clickhouseQuery called with:', {
  //   websiteId,
  //   startDate: startDate.toISOString(),
  //   endDate: endDate.toISOString(),
  //   granularity,
  //   eventName,
  // });

  // Build event filter (ignore empty string)
  const hasEventFilter = !!(eventName && String(eventName).trim());
  const eventFilter = hasEventFilter ? 'AND event_name = {eventName:String}' : '';

  // Determine date trunc function based on granularity
  const dateTrunc =
    granularity === 'day'
      ? 'toStartOfDay'
      : granularity === 'week'
      ? 'toStartOfWeek'
      : 'toStartOfMonth';

  const query = `
    SELECT 
      s.distinct_id as user_id,
      ${dateTrunc}(e.created_at) AS period
    FROM website_event e
    JOIN session s ON s.session_id = e.session_id
    WHERE e.website_id = {websiteId:UUID}
      AND e.created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      AND e.event_type = {eventType:UInt32}
      ${eventFilter}
      AND s.distinct_id != ''
    GROUP BY s.distinct_id, ${dateTrunc}(e.created_at)
    ORDER BY period, user_id
  `;

  const params = {
    websiteId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    eventType: EVENT_TYPE.customEvent,
    ...(hasEventFilter && { eventName }),
  };

  // console.log('[getReturningEventUsers] ClickHouse query:', query);
  // console.log('[getReturningEventUsers] ClickHouse params:', params);

  // Get user events grouped by period
  const userEventsResult = await rawQuery(query, params);

  // console.log('[getReturningEventUsers] ClickHouse raw result:', userEventsResult);
  // console.log('[getReturningEventUsers] ClickHouse result type:', typeof userEventsResult);
  // console.log(
  //   '[getReturningEventUsers] ClickHouse result length:',
  //   Array.isArray(userEventsResult) ? userEventsResult.length : 'not array',
  // );

  // Process results to calculate returning users
  // console.log('[getReturningEventUsers] ClickHouse: Starting to process results...');

  const periodMap = new Map<string, Set<string>>();
  const userMap = new Map<string, Set<string>>();

  // Group users by period
  if (Array.isArray(userEventsResult)) {
    // console.log('[getReturningEventUsers] ClickHouse: Processing rows:', userEventsResult.length);

    userEventsResult.forEach((row: any, index: number) => {
      if (index < 5) {
        // Log first 5 rows for debugging
        // console.log(`[getReturningEventUsers] ClickHouse: Row ${index}:`, row);
      }

      // Convert period to a consistent string format
      const period =
        row.period instanceof Date ? row.period.toISOString().split('T')[0] : String(row.period);
      const userId = row.user_id;

      // console.log(`[getReturningEventUsers] ClickHouse: Processed row ${index}: period="${period}", userId="${userId}"`);

      if (!periodMap.has(period)) {
        periodMap.set(period, new Set());
      }
      periodMap.get(period)!.add(userId);

      if (!userMap.has(userId)) {
        userMap.set(userId, new Set());
      }
      userMap.get(userId)!.add(period);
    });
  } else {
    // console.log(
    //   '[getReturningEventUsers] ClickHouse: userEventsResult is not an array:',
    //   userEventsResult,
    // );
  }

  // console.log('[getReturningEventUsers] ClickHouse: Period map size:', periodMap.size);
  // console.log('[getReturningEventUsers] ClickHouse: User map size:', userMap.size);

  // Debug: Show what's in the period map
  // console.log('[getReturningEventUsers] ClickHouse: Period map contents:');
  // periodMap.forEach((users, period) => {
  //   console.log(`  Period "${period}": ${users.size} users`);
  // });

  // Calculate returning users for each period
  const periods = Array.from(periodMap.keys()).sort();
  // console.log('[getReturningEventUsers] ClickHouse: Sorted periods:', periods);

  const result = periods.map((period, index) => {
    const currentUsers = periodMap.get(period)!;
    const totalUsers = currentUsers.size;

    let returningUsers = 0;
    if (index > 0) {
      const previousPeriods = periods.slice(0, index);
      const previousUsers = new Set<string>();
      previousPeriods.forEach(p => {
        periodMap.get(p)!.forEach(user => previousUsers.add(user));
      });

      returningUsers = Array.from(currentUsers).filter(user => previousUsers.has(user)).length;
    }

    const returningRate = totalUsers > 0 ? (returningUsers / totalUsers) * 100 : 0;

    const periodResult = {
      period,
      total_users: totalUsers,
      returning_users: returningUsers,
      returning_rate: Math.round(returningRate * 100) / 100, // Round to 2 decimal places
    };

    // console.log(`[getReturningEventUsers] ClickHouse: Period ${period} result:`, periodResult);

    return periodResult;
  });

  // console.log('[getReturningEventUsers] ClickHouse: Final result:', { periods: result });
  return { periods: result };
}
