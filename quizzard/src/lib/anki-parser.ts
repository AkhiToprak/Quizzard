import JSZip from 'jszip';
import Database from 'better-sqlite3';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';

export interface AnkiCard {
  question: string;
  answer: string;
}

export async function parseAnkiFile(buffer: Buffer): Promise<AnkiCard[]> {
  const zip = await JSZip.loadAsync(buffer);

  // Find the SQLite database file (collection.anki2 or collection.anki21)
  const dbFile = zip.file('collection.anki2') || zip.file('collection.anki21');
  if (!dbFile) throw new Error('Invalid .apkg file: no database found');

  const dbBuffer = await dbFile.async('nodebuffer');

  if (dbBuffer.length > 100 * 1024 * 1024) {
    throw new Error('Anki database too large');
  }

  // Write to temp file (better-sqlite3 needs a file path)
  const tmpPath = join(tmpdir(), `anki-${randomUUID()}.db`);
  writeFileSync(tmpPath, dbBuffer);

  try {
    const db = new Database(tmpPath, { readonly: true });
    const rows = db.prepare('SELECT flds FROM notes LIMIT 10000').all() as { flds: string }[];
    db.close();

    return rows
      .map((row) => {
        const fields = row.flds.split('\x1f');
        return {
          question: stripHtml(fields[0] || ''),
          answer: stripHtml(fields[1] || ''),
        };
      })
      .filter((card) => card.question.trim() && card.answer.trim());
  } finally {
    unlinkSync(tmpPath);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}
