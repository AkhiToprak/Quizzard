import fs from 'fs/promises';
import path from 'path';
import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from '@/lib/api-response';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const AVATARS_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars');

// Magic byte signatures for allowed image types
const MAGIC_BYTES: { ext: string; bytes: number[] }[] = [
  { ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] }, // PNG
  { ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },         // JPEG
  { ext: 'webp', bytes: [0x52, 0x49, 0x46, 0x46] },  // WebP (RIFF header)
];

function detectImageType(buffer: Buffer): string | null {
  for (const { ext, bytes } of MAGIC_BYTES) {
    if (bytes.every((b, i) => buffer[i] === b)) return ext;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const formData = await request.formData();
    const file = formData.get('avatar') || formData.get('file');

    if (!file || !(file instanceof File)) {
      return badRequestResponse('No file provided');
    }

    if (file.size > MAX_SIZE) {
      return badRequestResponse('File too large. Maximum size is 5MB');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = detectImageType(buffer);
    if (!ext) {
      return badRequestResponse('Invalid file type. Allowed: PNG, JPEG, WebP');
    }

    await fs.mkdir(AVATARS_DIR, { recursive: true });

    const fileName = `${userId}.${ext}`;
    const filePath = path.join(AVATARS_DIR, fileName);

    await fs.writeFile(filePath, buffer);

    const avatarUrl = `/uploads/avatars/${fileName}`;

    await db.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    return successResponse({ avatarUrl });
  } catch {
    return internalErrorResponse();
  }
}
