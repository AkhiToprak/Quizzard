import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { unauthorizedResponse, badRequestResponse, internalErrorResponse } from '@/lib/api-response';
import { generateSlidesAsPptx } from '@/lib/pptx-generator';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const body = await request.json();
    const { title, slides } = body as { title?: string; slides?: { title: string; content: string; notes?: string }[] };

    if (!title || !slides || !Array.isArray(slides) || slides.length === 0) {
      return badRequestResponse('Title and slides array are required');
    }
    if (slides.length > 500) {
      return badRequestResponse('Too many slides (max 500)');
    }

    const buffer = await generateSlidesAsPptx(title, slides);
    const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pptx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('PPTX export error:', error);
    return internalErrorResponse();
  }
}
