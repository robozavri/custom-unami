import { NextRequest, NextResponse } from 'next/server';
import { getEventComparison } from '@/queries/sql/events/getEventComparison';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { websiteId, startDate, endDate, addEventName, checkoutEventName } = body;

    // Validate required parameters
    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Execute the query
    const result = await getEventComparison(
      websiteId,
      start,
      end,
      addEventName || 'add_to_cart',
      checkoutEventName || 'checkout_success',
    );

    const response = {
      success: true,
      data: {
        websiteId,
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
        events: {
          addToCart: {
            name: addEventName || 'add_to_cart',
            count: result.addToCartCount,
          },
          checkout: {
            name: checkoutEventName || 'checkout_success',
            count: result.checkoutCount,
          },
        },
        metrics: {
          totalEvents: result.totalEvents,
          successRate: `${result.successRate.toFixed(2)}%`,
          conversionRatio: `${result.checkoutCount}:${result.addToCartCount}`,
        },
        analysis: {
          question: 'How many successful checkout events were there vs. add_to_cart events?',
          answer: `During the analyzed period, there were ${
            result.addToCartCount
          } add_to_cart events and ${
            result.checkoutCount
          } checkout_success events. The conversion rate is ${result.successRate.toFixed(2)}%.`,
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
    const addEventName = searchParams.get('addEventName');
    const checkoutEventName = searchParams.get('checkoutEventName');

    // Validate required parameters
    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Execute the query
    const result = await getEventComparison(
      websiteId,
      start,
      end,
      addEventName || 'add_to_cart',
      checkoutEventName || 'checkout_success',
    );

    const response = {
      success: true,
      data: {
        websiteId,
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
        events: {
          addToCart: {
            name: addEventName || 'add_to_cart',
            count: result.addToCartCount,
          },
          checkout: {
            name: checkoutEventName || 'checkout_success',
            count: result.checkoutCount,
          },
        },
        metrics: {
          totalEvents: result.totalEvents,
          successRate: `${result.successRate.toFixed(2)}%`,
          conversionRatio: `${result.checkoutCount}:${result.addToCartCount}`,
        },
        analysis: {
          question: 'How many successful checkout events were there vs. add_to_cart events?',
          answer: `During the analyzed period, there were ${
            result.addToCartCount
          } add_to_cart events and ${
            result.checkoutCount
          } checkout_success events. The conversion rate is ${result.successRate.toFixed(2)}%.`,
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
