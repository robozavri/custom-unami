import { NextRequest, NextResponse } from 'next/server';
import { checkEventDropChainTool } from '@/app/chat/tools/conversion-drop-insights/check-event-drop-chain';
/* eslint-disable no-console */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await checkEventDropChainTool.execute(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[check-event-drop-chain] API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
