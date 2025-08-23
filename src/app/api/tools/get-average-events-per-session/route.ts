import { NextRequest, NextResponse } from 'next/server';
import { getAverageEventsPerSession } from '@/queries/sql/events/getAverageEventsPerSession';

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
    const result = await getAverageEventsPerSession(websiteId, start, end, event_name);

    const response = {
      success: true,
      data: {
        websiteId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        eventName: event_name || 'all_events',
        summary: {
          average_events_per_session: Number(result.averageEventsPerSession.toFixed(2)),
          total_sessions: result.totalSessions,
          total_events: result.totalEvents,
        },
        breakdown: result.breakdown.map(item => ({
          events_per_session: item.eventCount,
          session_count: item.sessionCount,
          percentage: Number(item.percentage.toFixed(1)),
        })),
        analysis: {
          question: 'What is the average number of events per session?',
          answer: `The average number of events per session is ${result.averageEventsPerSession.toFixed(
            2,
          )}. This is calculated from ${result.totalEvents} total events across ${
            result.totalSessions
          } unique sessions.`,
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
    const eventName = searchParams.get('eventName');

    // Validate required parameters
    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Execute the query
    const result = await getAverageEventsPerSession(websiteId, start, end, eventName);

    const response = {
      success: true,
      data: {
        websiteId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        eventName: eventName || 'all_events',
        summary: {
          average_events_per_session: Number(result.averageEventsPerSession.toFixed(2)),
          total_sessions: result.totalSessions,
          total_events: result.totalEvents,
        },
        breakdown: result.breakdown.map(item => ({
          events_per_session: item.eventCount,
          session_count: item.sessionCount,
          percentage: Number(item.percentage.toFixed(1)),
        })),
        analysis: {
          question: 'What is the average number of events per session?',
          answer: `The average number of events per session is ${result.averageEventsPerSession.toFixed(
            2,
          )}. This is calculated from ${result.totalEvents} total events across ${
            result.totalSessions
          } unique sessions.`,
        },
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error in get-average-events-per-session API:', error);

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
