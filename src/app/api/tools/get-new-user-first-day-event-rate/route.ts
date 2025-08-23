import { NextRequest, NextResponse } from 'next/server';
import { getNewUserFirstDayEventRate } from '@/queries/sql/events/getNewUserFirstDayEventRate';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { websiteId, startDate, endDate, event_name } = body;

    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const result = await getNewUserFirstDayEventRate(websiteId, start, end, event_name);

    const response = {
      success: true,
      data: {
        websiteId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        filter: event_name || 'any_custom_event',
        total_sessions: result.totalSessions,
        sessions_with_event_on_first_day: result.sessionsWithEventOnFirstDay,
        percentage: Number(result.percentage.toFixed(2)),
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

    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const result = await getNewUserFirstDayEventRate(websiteId, start, end, eventName || undefined);

    const response = {
      success: true,
      data: {
        websiteId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        filter: eventName || 'any_custom_event',
        total_sessions: result.totalSessions,
        sessions_with_event_on_first_day: result.sessionsWithEventOnFirstDay,
        percentage: Number(result.percentage.toFixed(2)),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error in get-new-user-first-day-event-rate API:', error);

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
