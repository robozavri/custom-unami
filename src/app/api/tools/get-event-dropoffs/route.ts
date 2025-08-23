import { NextRequest, NextResponse } from 'next/server';
import { getEventDropoffs } from '@/queries/sql/events/getEventDropoffs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { websiteId, startDate, endDate, event_name, limit } = body;

    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const result = await getEventDropoffs(websiteId, start, end, event_name, limit);

    const response = {
      success: true,
      data: {
        websiteId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        filter: event_name || 'all_events',
        items: result.items.map(i => ({
          event_name: i.eventName,
          sessions_with_event: i.sessionsWithEvent,
          dropoff_sessions: i.dropoffSessions,
          dropoff_rate: Number(i.dropoffRate.toFixed(2)),
        })),
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
    const limit = searchParams.get('limit');

    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const result = await getEventDropoffs(
      websiteId,
      start,
      end,
      eventName || undefined,
      limit ? Number(limit) : undefined,
    );

    const response = {
      success: true,
      data: {
        websiteId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        filter: eventName || 'all_events',
        items: result.items.map(i => ({
          event_name: i.eventName,
          sessions_with_event: i.sessionsWithEvent,
          dropoff_sessions: i.dropoffSessions,
          dropoff_rate: Number(i.dropoffRate.toFixed(2)),
        })),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error in get-event-dropoffs API:', error);

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
