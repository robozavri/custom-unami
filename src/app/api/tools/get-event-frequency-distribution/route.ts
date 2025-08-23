import { NextRequest, NextResponse } from 'next/server';
import { getEventFrequencyDistribution } from '@/queries/sql/events/getEventFrequencyDistribution';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { websiteId, startDate, endDate, event_name } = body;

    // Validate required parameters
    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Execute the query
    const result = await getEventFrequencyDistribution(websiteId, start, end, event_name);

    // Calculate percentages
    const oneEventPercentage =
      result.totalUniqueUsers > 0
        ? ((result.usersWithOneEvent / result.totalUniqueUsers) * 100).toFixed(1)
        : '0.0';
    const multipleEventsPercentage =
      result.totalUniqueUsers > 0
        ? ((result.usersWithMultipleEvents / result.totalUniqueUsers) * 100).toFixed(1)
        : '0.0';

    const response = {
      success: true,
      data: {
        websiteId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        eventName: event_name || 'all_events',
        summary: {
          users_with_one_event: result.usersWithOneEvent,
          users_with_multiple_events: result.usersWithMultipleEvents,
          total_unique_users: result.totalUniqueUsers,
        },
        percentages: {
          one_event: `${oneEventPercentage}%`,
          multiple_events: `${multipleEventsPercentage}%`,
        },
        breakdown: result.breakdown,
        analysis: {
          question: 'How many users performed the event once and how many multiple times?',
          answer: `${result.usersWithOneEvent} users (${oneEventPercentage}%) performed the event once, while ${result.usersWithMultipleEvents} users (${multipleEventsPercentage}%) performed it multiple times.`,
          total_users: result.totalUniqueUsers,
        },
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    // eslint-disable-next-line no-console
    // console.error('Error in get-event-frequency-distribution API:', error);

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
    const eventName = searchParams.get('eventName');

    // Validate required parameters
    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Execute the query
    const result = await getEventFrequencyDistribution(websiteId, start, end, eventName);

    // Calculate percentages
    const oneEventPercentage =
      result.totalUniqueUsers > 0
        ? ((result.usersWithOneEvent / result.totalUniqueUsers) * 100).toFixed(1)
        : '0.0';
    const multipleEventsPercentage =
      result.totalUniqueUsers > 0
        ? ((result.usersWithMultipleEvents / result.totalUniqueUsers) * 100).toFixed(1)
        : '0.0';

    const response = {
      success: true,
      data: {
        websiteId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        eventName: eventName || 'all_events',
        summary: {
          users_with_one_event: result.usersWithOneEvent,
          users_with_multiple_events: result.usersWithMultipleEvents,
          total_unique_users: result.totalUniqueUsers,
        },
        percentages: {
          one_event: `${oneEventPercentage}%`,
          multiple_events: `${multipleEventsPercentage}%`,
        },
        breakdown: result.breakdown,
        analysis: {
          question: 'How many users performed the event once and how many multiple times?',
          answer: `${result.usersWithOneEvent} users (${oneEventPercentage}%) performed the event once, while ${result.usersWithMultipleEvents} users (${multipleEventsPercentage}%) performed it multiple times.`,
          total_users: result.totalUniqueUsers,
        },
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error in get-event-frequency-distribution API:', error);

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
