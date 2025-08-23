import { NextRequest, NextResponse } from 'next/server';
import { getEventConversionFunnel } from '@/queries/sql/events/getEventConversionFunnel';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { websiteId, startDate, endDate, event_x, event_y } = body;

    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const result = await getEventConversionFunnel(websiteId, start, end, event_x, event_y);

    const response = {
      success: true,
      data: {
        websiteId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        eventX: event_x || 'page_view',
        eventY: event_y || 'any_custom_event',
        started_sessions: result.startedSessions,
        converted_sessions: result.convertedSessions,
        conversion_rate: Number(result.conversionRate.toFixed(2)),
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
    const eventX = searchParams.get('eventX');
    const eventY = searchParams.get('eventY');

    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const result = await getEventConversionFunnel(
      websiteId,
      start,
      end,
      eventX || undefined,
      eventY || undefined,
    );

    const response = {
      success: true,
      data: {
        websiteId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        eventX: eventX || 'page_view',
        eventY: eventY || 'any_custom_event',
        started_sessions: result.startedSessions,
        converted_sessions: result.convertedSessions,
        conversion_rate: Number(result.conversionRate.toFixed(2)),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error in get-event-conversion-funnel API:', error);

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
