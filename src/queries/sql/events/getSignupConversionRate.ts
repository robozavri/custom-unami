import prisma from '@/lib/prisma';
import clickhouse from '@/lib/clickhouse';
import { getDatabaseType } from '@/lib/db';

export interface SignupConversionRateResult {
  totalVisits: number;
  totalSignups: number;
  conversionRate: number;
  period: {
    startDate: string;
    endDate: string;
  };
  breakdown: {
    visits: {
      pageviews: number;
      uniqueVisitors: number;
    };
    signups: {
      total: number;
      uniqueUsers: number;
    };
  };
}

export async function getSignupConversionRate(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  signupEventName: string = 'signup',
): Promise<SignupConversionRateResult> {
  const dbType = await getDatabaseType();

  if (dbType === 'clickhouse') {
    return clickhouseQuery(websiteId, startDate, endDate, signupEventName);
  } else {
    return relationalQuery(websiteId, startDate, endDate, signupEventName);
  }
}

async function relationalQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  signupEventName: string,
): Promise<SignupConversionRateResult> {
  // Get total pageviews (visits)
  const totalVisits = await prisma.client.websiteEvent.count({
    where: {
      websiteId,
      eventType: 1, // Pageviews
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Get unique visitors
  const uniqueVisitors = await prisma.client.websiteEvent.groupBy({
    by: ['sessionId'],
    where: {
      websiteId,
      eventType: 1, // Pageviews
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _count: {
      sessionId: true,
    },
  });

  // Get total signups
  const totalSignups = await prisma.client.websiteEvent.count({
    where: {
      websiteId,
      eventName: signupEventName,
      eventType: 2, // Custom events
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Get unique users who signed up
  const uniqueSignupUsers = await prisma.client.websiteEvent.groupBy({
    by: ['sessionId'],
    where: {
      websiteId,
      eventName: signupEventName,
      eventType: 2, // Custom events
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _count: {
      sessionId: true,
    },
  });

  const conversionRate = totalVisits > 0 ? (totalSignups / totalVisits) * 100 : 0;

  return {
    totalVisits,
    totalSignups,
    conversionRate: Math.round(conversionRate * 100) / 100,
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    breakdown: {
      visits: {
        pageviews: totalVisits,
        uniqueVisitors: uniqueVisitors.length,
      },
      signups: {
        total: totalSignups,
        uniqueUsers: uniqueSignupUsers.length,
      },
    },
  };
}

async function clickhouseQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  signupEventName: string,
): Promise<SignupConversionRateResult> {
  // Query for visits (pageviews)
  const visitsQuery = `
    SELECT 
      count() as total_visits,
      uniq(session_id) as unique_visitors
    FROM website_event 
    WHERE website_id = {websiteId:String}
      AND event_type = 1
      AND created_at >= {startDate:DateTime}
      AND created_at <= {endDate:DateTime}
  `;

  // Query for signups
  const signupsQuery = `
    SELECT 
      count() as total_signups,
      uniq(session_id) as unique_users
    FROM website_event 
    WHERE website_id = {websiteId:String}
      AND event_name = {signupEventName:String}
      AND event_type = 2
      AND created_at >= {startDate:DateTime}
      AND created_at <= {endDate:DateTime}
  `;

  const [visitsResult, signupsResult] = await Promise.all([
    clickhouse.client.query({
      query: visitsQuery,
      query_params: {
        websiteId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    }),
    clickhouse.client.query({
      query: signupsQuery,
      query_params: {
        websiteId,
        signupEventName,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    }),
  ]);

  const visitsData = await visitsResult.json();
  const signupsData = await signupsResult.json();

  const totalVisits = visitsData[0]?.total_visits || 0;
  const uniqueVisitors = visitsData[0]?.unique_visitors || 0;
  const totalSignups = signupsData[0]?.total_signups || 0;
  const uniqueUsers = signupsData[0]?.unique_users || 0;

  const conversionRate = totalVisits > 0 ? (totalSignups / totalVisits) * 100 : 0;

  return {
    totalVisits,
    totalSignups,
    conversionRate: Math.round(conversionRate * 100) / 100,
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    breakdown: {
      visits: {
        pageviews: totalVisits,
        uniqueVisitors,
      },
      signups: {
        total: totalSignups,
        uniqueUsers,
      },
    },
  };
}
