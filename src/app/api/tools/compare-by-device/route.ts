import { NextRequest, NextResponse } from 'next/server';
import { compareByDeviceTool } from '@/app/chat/tools/conversion-drop-insights/compare-by-device';
/* eslint-disable no-console */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[compare-by-device API] Received request:', body);

    // Execute the tool
    const result = await compareByDeviceTool.execute(body);

    console.log('[compare-by-device API] Tool execution completed successfully');

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[compare-by-device API] Error:', error);

    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
