import { compareByPathTool } from '@/app/chat/tools/conversion-drop-insights/compare-by-path';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const params = await req.json();

    // Optional: restrict to development unless explicitly allowed
    if (process.env.NODE_ENV !== 'development' && !process.env.ALLOW_TOOL_API) {
      return new Response(
        JSON.stringify({ error: 'Direct tool API disabled. Set ALLOW_TOOL_API=1 to enable.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const result = await compareByPathTool.execute(params);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error?.message || 'Unknown error',
        details: {
          name: error?.name,
          code: error?.code,
          meta: error?.meta,
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
