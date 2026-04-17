import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Absolute URL of the bundled pdfjs worker file. The worker is copied
 * into src/lib/vendor/pdfjs-worker.mjs by the `prebuild` script — a
 * `new URL(..., import.meta.url)` reference is the one pattern that
 * @vercel/nft reliably treats as a static asset dependency, which gets
 * the file shipped into the serverless output.
 *
 * On Vercel the resolved file path lives inside /var/task but may not
 * be a valid ESM specifier (pdfjs does a dynamic import on it). We
 * therefore copy the content to a stable /tmp path on first use and
 * point GlobalWorkerOptions.workerSrc at the file:// URL of that copy.
 */
const WORKER_URL = new URL('./vendor/pdfjs-worker.mjs', import.meta.url);

let workerTmpPath: string | null = null;

function ensureWorkerOnDisk(): string {
  if (workerTmpPath && fs.existsSync(workerTmpPath)) return workerTmpPath;

  const srcPath = fileURLToPath(WORKER_URL);
  const destPath = path.join(os.tmpdir(), 'pdfjs-pdf.worker.mjs');
  if (!fs.existsSync(destPath)) {
    fs.copyFileSync(srcPath, destPath);
  }
  workerTmpPath = destPath;
  return destPath;
}

let workerConfigured = false;

async function getPdfjs(): Promise<any> {
  const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs');

  if (!workerConfigured) {
    try {
      const workerPath = ensureWorkerOnDisk();
      pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[pdfjs-node] Failed to set worker src:', err);
    }
    workerConfigured = true;
  }

  return pdfjsLib;
}

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/**
 * Reconstruct a single page's text layout from pdfjs text items.
 *
 * pdfjs returns positioned glyph runs, not logical text — naive
 * concatenation produces garbage like "T ECHNIK UND U MWELT" from
 * letter-spaced headings and drops all paragraph structure. We:
 *
 *   1. Group items into lines by y-coordinate.
 *   2. Inside each line, insert a space only when the horizontal gap
 *      between two runs exceeds a fraction of the run's character
 *      width — catches real word gaps without inflating tracked text.
 *   3. Merge consecutive lines into the same paragraph when their
 *      vertical gap looks like normal leading; emit a blank line
 *      where the gap is larger (paragraph break).
 */
function reconstructPageText(items: PdfTextItem[]): string {
  if (items.length === 0) return '';

  // Group items into lines keyed by rounded y-coordinate.
  const lineMap = new Map<number, PdfTextItem[]>();
  const LINE_Y_TOLERANCE = 2;
  for (const item of items) {
    if (!item.str) continue;
    const y = item.transform[5];
    let key: number | null = null;
    for (const existingKey of lineMap.keys()) {
      if (Math.abs(existingKey - y) <= LINE_Y_TOLERANCE) {
        key = existingKey;
        break;
      }
    }
    if (key === null) key = y;
    const bucket = lineMap.get(key);
    if (bucket) bucket.push(item);
    else lineMap.set(key, [item]);
  }

  // PDF y grows upward, so sort descending to get top-to-bottom order.
  const sortedLines = Array.from(lineMap.entries()).sort((a, b) => b[0] - a[0]);

  const lineRows: { y: number; text: string; fontSize: number }[] = [];

  for (const [y, lineItems] of sortedLines) {
    lineItems.sort((a, b) => a.transform[4] - b.transform[4]);

    let text = '';
    let prevEndX = Number.NEGATIVE_INFINITY;
    let maxFontSize = 0;

    for (const item of lineItems) {
      const x = item.transform[4];
      const w = item.width ?? 0;
      const fontSize = Math.abs(item.transform[0] || item.height || 10);
      if (fontSize > maxFontSize) maxFontSize = fontSize;

      if (text.length > 0) {
        const gap = x - prevEndX;
        const charWidth = item.str.length > 0 ? w / item.str.length : fontSize * 0.5;
        const endsWithSpace = /\s$/.test(text);
        const startsWithSpace = /^\s/.test(item.str);
        // Insert a space for real word gaps; ignore tiny kerning jitters.
        if (!endsWithSpace && !startsWithSpace && gap > charWidth * 0.3) {
          text += ' ';
        }
      }
      text += item.str;
      prevEndX = x + w;
    }

    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned) lineRows.push({ y, text: cleaned, fontSize: maxFontSize });
  }

  if (lineRows.length === 0) return '';

  // Merge lines into paragraphs based on vertical gap vs font size.
  const paragraphs: string[] = [];
  let current = lineRows[0].text;
  let prevRow = lineRows[0];

  for (let i = 1; i < lineRows.length; i++) {
    const row = lineRows[i];
    const gap = prevRow.y - row.y;
    const expectedLeading = Math.max(prevRow.fontSize, row.fontSize) * 1.25;

    if (gap > expectedLeading * 1.6) {
      paragraphs.push(current);
      current = row.text;
    } else {
      current += ' ' + row.text;
    }
    prevRow = row;
  }
  if (current) paragraphs.push(current);

  return paragraphs.map(collapseLetterSpacing).join('\n\n');
}

/**
 * Heuristic post-process that fixes a common pdfjs artefact where the
 * first glyph of a letter-spaced heading is emitted as its own item
 * (e.g. "T ECHNIK UND U MWELT" → "TECHNIK UND UMWELT") and fully
 * letter-spaced runs ("T E C H N I K") are reassembled into words.
 */
function collapseLetterSpacing(paragraph: string): string {
  let out = paragraph;
  // Fully spaced sequences: "A B C D" (3+ single uppercase letters) → "ABCD"
  out = out.replace(/(?:\b[A-ZÄÖÜ] ){2,}[A-ZÄÖÜ]\b/g, (match) => match.replace(/ /g, ''));
  // Leading lone uppercase glued to next uppercase word: "T ECHNIK" → "TECHNIK"
  out = out.replace(/\b([A-ZÄÖÜ]) ([A-ZÄÖÜ]{2,})\b/g, '$1$2');
  return out;
}

/**
 * Extract plain text from a PDF buffer, page by page, with a best-effort
 * reconstruction of paragraphs and word spacing.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjsLib = await getPdfjs();

  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = (content.items as any[]).filter(
      (item) => typeof item.str === 'string'
    ) as PdfTextItem[];

    const pageText = reconstructPageText(items);
    if (pageText) pages.push(pageText);

    page.cleanup();
  }

  await doc.destroy();

  return pages.join('\n\n');
}

/**
 * Shared pdfjs loader — other helpers (image extractor) reuse this so
 * the worker is configured exactly once per lambda instance.
 */
export async function loadPdfjs(): Promise<any> {
  return getPdfjs();
}
