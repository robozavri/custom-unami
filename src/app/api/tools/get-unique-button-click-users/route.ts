import { NextRequest, NextResponse } from 'next/server';
import { getUniqueButtonClickUsers } from '@/queries/sql/events/getUniqueButtonClickUsers';
/* eslint-disable no-console */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('websiteId') || '5801af32-ebe2-4273-9e58-89de8971a2fd';
    const days = parseInt(searchParams.get('days') || '30');
    const eventName = searchParams.get('event_name') || 'cta_button';

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    console.log(`🧪 Testing Unique Button Click Users Tool via API`);
    console.log(`🌐 Website ID: ${websiteId}`);
    console.log(
      `📅 Date Range: ${startDate.toISOString().split('T')[0]} to ${
        endDate.toISOString().split('T')[0]
      }`,
    );
    console.log(`🎯 Event Name: ${eventName}`);

    // Execute the query
    const result = await getUniqueButtonClickUsers(websiteId, startDate, endDate, eventName);

    // Format response
    const response = {
      success: true,
      tool: 'get-unique-button-click-users',
      question: 'რამდენმა მომხმარებელმა დააჭირა კონკრეტულ ღილაკს?',
      question_en: 'How many users clicked a specific button?',
      params: {
        websiteId,
        days,
        event_name: eventName,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
      result: {
        event_name: result.eventName,
        unique_users: result.uniqueUsers,
        total_clicks: result.totalClicks,
        period: result.period,
        clicks_per_user:
          result.totalClicks > 0 ? (result.totalClicks / result.uniqueUsers).toFixed(2) : '0.00',
      },
      analysis: {
        buttonName: result.eventName,
        uniqueUserCount: result.uniqueUsers,
        totalClickCount: result.totalClicks,
        averageClicksPerUser:
          result.totalClicks > 0 ? (result.totalClicks / result.uniqueUsers).toFixed(2) : '0.00',
        engagementLevel: (() => {
          if (result.uniqueUsers === 0) return 'No engagement';
          const avgClicks = result.totalClicks / result.uniqueUsers;
          if (avgClicks >= 2.0) return 'High engagement (multiple clicks per user)';
          if (avgClicks >= 1.5) return 'Medium-high engagement';
          if (avgClicks >= 1.1) return 'Medium engagement';
          return 'Low engagement (mostly single clicks)';
        })(),
      },
      timestamp: new Date().toISOString(),
    };

    console.log(`✅ Tool executed successfully`);
    console.log(`👥 Found ${result.uniqueUsers} unique users`);
    console.log(`🎯 Total clicks: ${result.totalClicks}`);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('❌ Error testing unique button click users tool:', error);

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
