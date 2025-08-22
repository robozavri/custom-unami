import { NextRequest, NextResponse } from 'next/server';
import { checkDropCorrelatedEventsTool } from '@/app/chat/tools/conversion-drop-insights/check-drop-correlated-events';
/* eslint-disable no-console */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await checkDropCorrelatedEventsTool.execute(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[check-drop-correlated-events] API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
