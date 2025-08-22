import { NextRequest, NextResponse } from 'next/server';
import { getMostFrequentEvents } from '@/queries/sql/events/getMostFrequentEvents';
/* eslint-disable no-console */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('websiteId') || '5801af32-ebe2-4273-9e58-89de8971a2fd';
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // eslint-disable-next-line no-console
    console.log(`🧪 Testing Most Frequent Events Tool via API`);
    // eslint-disable-next-line no-console
    console.log(`🌐 Website ID: ${websiteId}`);
    // eslint-disable-next-line no-console
    console.log(
      `📅 Date Range: ${startDate.toISOString().split('T')[0]} to ${
        endDate.toISOString().split('T')[0]
      }`,
    );
    // eslint-disable-next-line no-console
    console.log(`📊 Limit: ${limit}`);

    // Execute the query
    const result = await getMostFrequentEvents(websiteId, startDate, endDate, limit);

    // Format response
    const response = {
      success: true,
      tool: 'get-most-frequent-events',
      question: 'რომელი event-ებია ყველაზე ხშირად გამოყენებული?',
      question_en: 'Which events are used most frequently?',
      params: {
        websiteId,
        days,
        limit,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
      result: {
        totalEvents: result.totalEvents,
        period: result.period,
        mostFrequentEvents: result.events.map(event => ({
          event_name: event.eventName,
          event_count: event.eventCount,
          percentage: Math.round(event.percentage * 100) / 100,
        })),
      },
      analysis: {
        topEvent: result.events[0]?.eventName || 'No events',
        topEventPercentage: result.events[0]
          ? Math.round(result.events[0].percentage * 100) / 100
          : 0,
        totalUniqueEvents: result.events.length,
        eventsCovering80Percent: (() => {
          let cumulativeCount = 0;
          let eventsTo80Percent = 0;
          for (const event of result.events) {
            cumulativeCount += event.eventCount;
            const percentage = (cumulativeCount / result.totalEvents) * 100;
            if (percentage <= 80) {
              eventsTo80Percent++;
            }
          }
          return eventsTo80Percent;
        })(),
      },
      timestamp: new Date().toISOString(),
    };

    console.log(`✅ Tool executed successfully`);
    console.log(`📊 Found ${result.totalEvents} total events`);
    console.log(
      `🏆 Top event: ${result.events[0]?.eventName} (${result.events[0]?.eventCount} events)`,
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('❌ Error testing most frequent events tool:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
