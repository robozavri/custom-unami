import { NextRequest, NextResponse } from 'next/server';
import { compareBySegmentShiftTool } from '@/app/chat/tools/conversion-drop-insights/compare-by-segment-shift';
/* eslint-disable no-console */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await compareBySegmentShiftTool.execute(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[compare-by-segment-shift] API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
