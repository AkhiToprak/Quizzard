import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { TipTapNode } from '@/lib/contentConverter';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Absolute URL of the bundled pdfjs worker file. The worker is copied
 * into src/lib/vendor/pdfjs-worker.mjs at next.config.ts load time —
 * a `new URL(..., import.meta.url)` reference is the one pattern that
 * @vercel/nft reliably treats as a static asset dependency, which gets
 * the file shipped into the serverless output.
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

interface Cell {
  text: string;
  startX: number;
  endX: number;
}

interface Line {
  y: number;
  fontSize: number;
  cells: Cell[];
}

// How large a horizontal gap between two runs must be, relative to a
// run's character width, before we split them into separate cells.
// Word gaps are typically ~0.3–1x charWidth; table-column gaps are
// visibly larger. 3.5x is conservative — avoids false-positives on
// body text with a tab or long space.
const CELL_GAP_MULTIPLIER = 3.5;

/**
 * Group pdfjs text items on one visual line into cells. A cell is a
 * run of glyphs with normal word-spacing; a gap that looks like a tab
 * / column boundary starts a new cell.
 */
function buildLineCells(lineItems: PdfTextItem[]): { cells: Cell[]; fontSize: number } {
  lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
  const cells: Cell[] = [];
  let current: Cell | null = null;
  let maxFontSize = 0;

  for (const item of lineItems) {
    const x = item.transform[4];
    const w = item.width ?? 0;
    const fontSize = Math.abs(item.transform[0] || item.height || 10);
    if (fontSize > maxFontSize) maxFontSize = fontSize;

    const charWidth = item.str.length > 0 ? w / item.str.length : fontSize * 0.5;

    if (!current) {
      current = { text: item.str, startX: x, endX: x + w };
      continue;
    }

    const gap = x - current.endX;
    if (gap > charWidth * CELL_GAP_MULTIPLIER || gap > fontSize * 2.5) {
      cells.push(current);
      current = { text: item.str, startX: x, endX: x + w };
      continue;
    }

    if (gap > charWidth * 0.3 && !/\s$/.test(current.text) && !/^\s/.test(item.str)) {
      current.text += ' ';
    }
    current.text += item.str;
    current.endX = x + w;
  }
  if (current) cells.push(current);

  // Tidy whitespace inside each cell
  const cleaned = cells
    .map((c) => ({ ...c, text: c.text.replace(/\s+/g, ' ').trim() }))
    .filter((c) => c.text.length > 0);

  return { cells: cleaned, fontSize: maxFontSize };
}

/**
 * Group positioned items into visual lines by y-coordinate.
 */
function buildLines(items: PdfTextItem[]): Line[] {
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

  // PDF y grows upward — sort descending to get top-to-bottom order.
  const sortedEntries = Array.from(lineMap.entries()).sort((a, b) => b[0] - a[0]);

  const lines: Line[] = [];
  for (const [y, lineItems] of sortedEntries) {
    const { cells, fontSize } = buildLineCells(lineItems);
    if (cells.length === 0) continue;
    lines.push({ y, fontSize, cells });
  }
  return lines;
}

/** Is two x-coordinates "the same column"? */
const COLUMN_X_TOLERANCE = 6;

/**
 * Find a run of consecutive lines starting at `startIdx` that look like
 * one table: multiple multi-cell rows whose cell-start x-coordinates
 * align. Single-cell lines are folded in as continuations of the cell
 * whose startX they match. Returns the end index (exclusive) and the
 * table rows, or null if no plausible table is found.
 */
function detectTableFrom(
  lines: Line[],
  startIdx: number
): { endIdx: number; rows: Cell[][] } | null {
  const first = lines[startIdx];
  if (first.cells.length < 2) return null;

  const columnXs = first.cells.map((c) => c.startX);
  const rows: Cell[][] = [first.cells.slice()];
  let i = startIdx + 1;
  let multiCellRowCount = 1;

  while (i < lines.length) {
    const line = lines[i];

    // Paragraph break: much larger vertical gap than normal → table ends.
    const prevY = lines[i - 1].y;
    const gap = prevY - line.y;
    const leading = Math.max(lines[i - 1].fontSize, line.fontSize) * 1.25;
    if (gap > leading * 2.5) break;

    if (line.cells.length >= 2) {
      // Must share at least one column with the table header/first row.
      const sharesColumn = line.cells.some((c) =>
        columnXs.some((x) => Math.abs(c.startX - x) < COLUMN_X_TOLERANCE)
      );
      if (!sharesColumn) break;
      // Extend unknown columns
      for (const c of line.cells) {
        if (!columnXs.some((x) => Math.abs(c.startX - x) < COLUMN_X_TOLERANCE)) {
          columnXs.push(c.startX);
        }
      }
      rows.push(line.cells.slice());
      multiCellRowCount++;
      i++;
      continue;
    }

    // Single-cell line: treat as continuation of a column in the current row.
    const only = line.cells[0];
    const matchIdx = columnXs.findIndex((x) => Math.abs(only.startX - x) < COLUMN_X_TOLERANCE);
    if (matchIdx === -1) break;

    const currentRow = rows[rows.length - 1];
    // Find the cell in currentRow that sits in column `matchIdx`.
    const targetCell = currentRow.find(
      (c) => Math.abs(c.startX - columnXs[matchIdx]) < COLUMN_X_TOLERANCE
    );
    if (targetCell) {
      // Soft-hyphen repair across wrapped table-cell lines.
      const endsWithSoftHyphen = /[a-zäöüß]-$/.test(targetCell.text);
      const nextStartsLower = /^[a-zäöüß]/.test(only.text);
      if (endsWithSoftHyphen && nextStartsLower) {
        targetCell.text = targetCell.text.slice(0, -1) + only.text;
      } else {
        targetCell.text += ' ' + only.text;
      }
    } else {
      currentRow.push({ ...only });
    }
    i++;
  }

  // Qualify as a table only if it has real tabular structure.
  if (multiCellRowCount < 2 || rows.length < 2) return null;
  return { endIdx: i, rows };
}

/** Sort cells within a row by x so they render left-to-right. */
function sortRowCells(rows: Cell[][]): Cell[][] {
  return rows.map((r) => [...r].sort((a, b) => a.startX - b.startX));
}

/** Normalize every row to the same column count (pad with empty cells). */
function padRowsToSameWidth(rows: Cell[][]): Cell[][] {
  const maxCols = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => {
    const copy = r.slice();
    while (copy.length < maxCols) copy.push({ text: '', startX: 0, endX: 0 });
    return copy;
  });
}

function makeTableNode(rows: Cell[][]): TipTapNode {
  const sorted = sortRowCells(rows);
  const padded = padRowsToSameWidth(sorted);

  const tableRows: TipTapNode[] = padded.map((row, rowIdx) => ({
    type: 'tableRow',
    content: row.map((cell) => ({
      type: rowIdx === 0 ? 'tableHeader' : 'tableCell',
      attrs: { colspan: 1, rowspan: 1, colwidth: null },
      content: [
        {
          type: 'paragraph',
          content: cell.text ? [{ type: 'text', text: cell.text }] : undefined,
        },
      ],
    })),
  }));

  return { type: 'table', content: tableRows };
}

/**
 * Merge text-only lines (single-cell) into paragraph strings, then
 * hand off to pdfTextToTipTapJSON for heading / bullet / page-chrome
 * handling.
 */
function textLinesToParagraphText(lines: Line[]): string {
  if (lines.length === 0) return '';

  const rows = lines.map((l) => ({
    y: l.y,
    fontSize: l.fontSize,
    text: l.cells.map((c) => c.text).join(' '),
  }));

  const paragraphs: string[] = [];
  let current = rows[0].text;
  let prev = rows[0];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const gap = prev.y - row.y;
    const expectedLeading = Math.max(prev.fontSize, row.fontSize) * 1.25;

    if (gap > expectedLeading * 1.6) {
      paragraphs.push(current);
      current = row.text;
    } else {
      const endsWithSoftHyphen = /[a-zäöüß]-$/.test(current);
      const nextStartsLower = /^[a-zäöüß]/.test(row.text);
      if (endsWithSoftHyphen && nextStartsLower) {
        current = current.slice(0, -1) + row.text;
      } else {
        current += ' ' + row.text;
      }
    }
    prev = row;
  }
  if (current) paragraphs.push(current);

  return paragraphs.map(collapseLetterSpacing).join('\n\n');
}

/**
 * Conservative post-process that fixes the common pdfjs artefact where
 * a letter-spaced heading is emitted glyph-by-glyph — "T E C H N I K" →
 * "TECHNIK". Does NOT attempt to merge a lone cap onto the following
 * word, because that false-positives on phrases like "FÜR DIE".
 */
function collapseLetterSpacing(paragraph: string): string {
  return paragraph.replace(/(?:\b[A-ZÄÖÜ] ){2,}[A-ZÄÖÜ]\b/g, (match) =>
    match.replace(/ /g, '')
  );
}

/**
 * Main structured extractor. Returns TipTap nodes that preserve
 * table structure, paragraph structure, and flat text. Callers that
 * only need search text should use extractPdfText.
 */
export async function extractPdfTipTapNodes(buffer: Buffer): Promise<TipTapNode[]> {
  // Lazy dep to avoid a hard cycle — contentConverter imports nothing
  // from pdfjs-node but we import types from it at the top.
  const { pdfTextToTipTapJSON } = await import('@/lib/contentConverter');

  const pdfjsLib = await getPdfjs();
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  const allNodes: TipTapNode[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as any[]).filter(
      (it) => typeof it.str === 'string'
    ) as PdfTextItem[];
    const lines = buildLines(items);

    // Walk lines, peeling off tables where we find them; everything else
    // accumulates as text and is flushed through pdfTextToTipTapJSON.
    let i = 0;
    let textBuffer: Line[] = [];

    const flushText = () => {
      if (textBuffer.length === 0) return;
      const text = textLinesToParagraphText(textBuffer);
      textBuffer = [];
      if (!text.trim()) return;
      const doc = pdfTextToTipTapJSON(text);
      for (const node of doc.content) allNodes.push(node);
    };

    while (i < lines.length) {
      const table = detectTableFrom(lines, i);
      if (table) {
        flushText();
        allNodes.push(makeTableNode(table.rows));
        i = table.endIdx;
        continue;
      }
      textBuffer.push(lines[i]);
      i++;
    }
    flushText();

    page.cleanup();
  }

  await doc.destroy();
  return allNodes;
}

/**
 * Plain-text extractor used for the search/textContent field. Renders
 * tables as "cell | cell | cell" lines so search finds them.
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

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as any[]).filter(
      (it) => typeof it.str === 'string'
    ) as PdfTextItem[];
    const lines = buildLines(items);

    let i = 0;
    const chunks: string[] = [];
    let textBuffer: Line[] = [];

    const flush = () => {
      if (textBuffer.length === 0) return;
      chunks.push(textLinesToParagraphText(textBuffer));
      textBuffer = [];
    };

    while (i < lines.length) {
      const table = detectTableFrom(lines, i);
      if (table) {
        flush();
        const sorted = sortRowCells(table.rows);
        const padded = padRowsToSameWidth(sorted);
        chunks.push(padded.map((r) => r.map((c) => c.text).join(' | ')).join('\n'));
        i = table.endIdx;
        continue;
      }
      textBuffer.push(lines[i]);
      i++;
    }
    flush();

    const pageText = chunks.filter(Boolean).join('\n\n');
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
