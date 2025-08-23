import { NextRequest, NextResponse } from 'next/server';
import { getSignupConversionRate } from '@/queries/sql/events/getSignupConversionRate';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { websiteId, startDate, endDate, signupEventName } = body;

    // Validate required parameters
    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Execute the query
    const result = await getSignupConversionRate(
      websiteId,
      start,
      end,
      signupEventName || 'signup',
    );

    const response = {
      success: true,
      data: {
        websiteId,
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
        metrics: {
          totalVisits: result.totalVisits,
          totalSignups: result.totalSignups,
          conversionRate: `${result.conversionRate.toFixed(2)}%`,
          ratio: `${result.totalSignups}:${result.totalVisits}`,
        },
        breakdown: {
          visits: {
            pageviews: result.breakdown.visits.pageviews,
            uniqueVisitors: result.breakdown.visits.uniqueVisitors,
          },
          signups: {
            total: result.breakdown.signups.total,
            uniqueUsers: result.breakdown.signups.uniqueUsers,
          },
        },
        analysis: {
          question: 'What is the ratio of "signups" vs "visits"?',
          answer: `During the analyzed period, there were ${
            result.totalVisits
          } total visits (pageviews) and ${
            result.totalSignups
          } signups. The conversion rate is ${result.conversionRate.toFixed(
            2,
          )}%, meaning for every 100 visits, ${result.conversionRate.toFixed(
            1,
          )} resulted in a signup.`,
          interpretation:
            result.conversionRate > 5
              ? 'High conversion rate - excellent user acquisition performance!'
              : result.conversionRate > 2
              ? 'Good conversion rate - room for optimization'
              : 'Low conversion rate - consider improving signup flow and user experience',
        },
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('websiteId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const signupEventName = searchParams.get('signupEventName');

    // Validate required parameters
    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Execute the query
    const result = await getSignupConversionRate(
      websiteId,
      start,
      end,
      signupEventName || 'signup',
    );

    const response = {
      success: true,
      data: {
        websiteId,
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
        metrics: {
          totalVisits: result.totalVisits,
          totalSignups: result.totalSignups,
          conversionRate: `${result.conversionRate.toFixed(2)}%`,
          ratio: `${result.totalSignups}:${result.totalVisits}`,
        },
        breakdown: {
          visits: {
            pageviews: result.breakdown.visits.pageviews,
            uniqueVisitors: result.breakdown.visits.uniqueVisitors,
          },
          signups: {
            total: result.breakdown.signups.total,
            uniqueUsers: result.breakdown.signups.uniqueUsers,
          },
        },
        analysis: {
          question: 'What is the ratio of "signups" vs "visits"?',
          answer: `During the analyzed period, there were ${
            result.totalVisits
          } total visits (pageviews) and ${
            result.totalSignups
          } signups. The conversion rate is ${result.conversionRate.toFixed(
            2,
          )}%, meaning for every 100 visits, ${result.conversionRate.toFixed(
            1,
          )} resulted in a signup.`,
          interpretation:
            result.conversionRate > 5
              ? 'High conversion rate - excellent user acquisition performance!'
              : result.conversionRate > 2
              ? 'Good conversion rate - room for optimization'
              : 'Low conversion rate - consider improving signup flow and user experience',
        },
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
