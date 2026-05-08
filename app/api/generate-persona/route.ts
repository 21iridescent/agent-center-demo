import { NextResponse } from 'next/server';
import { generatePersonaImages } from '@/lib/openai-image';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface RequestBody {
  name?: string;
  traits?: string;
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          'OPENAI_API_KEY missing — 请在 .env.local 设置 OpenAI 直连 key 后重启 dev 服务',
      },
      { status: 500 },
    );
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }

  try {
    const result = await generatePersonaImages({ name, traits: body.traits });
    return NextResponse.json(result);
  } catch (e) {
    console.error('generate persona failed', e);
    const msg = e instanceof Error ? e.message : 'image gen failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
