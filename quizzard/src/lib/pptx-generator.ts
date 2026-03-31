import PptxGenJS from 'pptxgenjs';

export interface SlideData {
  title: string;
  content: string;
  notes?: string;
}

// Purple accent #8c52ff, dark background #0d0c20, text #ede9ff
const BRAND_COLORS = {
  bg: '0d0c20',
  accent: '8c52ff',
  text: 'ede9ff',
  subtext: 'a09cb5',
};

export async function generateFlashcardPptx(
  setTitle: string,
  flashcards: { question: string; answer: string }[]
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Quizzard';
  pptx.title = setTitle;

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: BRAND_COLORS.bg };
  titleSlide.addText(setTitle, { x: 0.5, y: 2.0, w: '90%', fontSize: 36, color: BRAND_COLORS.text, bold: true, align: 'center' });
  titleSlide.addText(`${flashcards.length} Flashcards`, { x: 0.5, y: 3.2, w: '90%', fontSize: 18, color: BRAND_COLORS.subtext, align: 'center' });

  // Each card gets 2 slides (question + answer)
  for (let i = 0; i < flashcards.length; i++) {
    const fc = flashcards[i];

    // Question slide
    const qSlide = pptx.addSlide();
    qSlide.background = { color: BRAND_COLORS.bg };
    qSlide.addText(`Card ${i + 1} / ${flashcards.length}`, { x: 0.5, y: 0.3, w: '90%', fontSize: 12, color: BRAND_COLORS.subtext });
    qSlide.addText('Question', { x: 0.5, y: 0.7, w: '90%', fontSize: 14, color: BRAND_COLORS.accent, bold: true });
    qSlide.addText(fc.question, { x: 0.5, y: 1.2, w: '90%', h: 4, fontSize: 24, color: BRAND_COLORS.text, valign: 'middle', align: 'center' });

    // Answer slide
    const aSlide = pptx.addSlide();
    aSlide.background = { color: BRAND_COLORS.bg };
    aSlide.addText(`Card ${i + 1} / ${flashcards.length}`, { x: 0.5, y: 0.3, w: '90%', fontSize: 12, color: BRAND_COLORS.subtext });
    aSlide.addText('Answer', { x: 0.5, y: 0.7, w: '90%', fontSize: 14, color: BRAND_COLORS.accent, bold: true });
    aSlide.addText(fc.answer, { x: 0.5, y: 1.2, w: '90%', h: 4, fontSize: 20, color: BRAND_COLORS.text, valign: 'middle', align: 'center' });
  }

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return output as Buffer;
}

export async function generateQuizPptx(
  setTitle: string,
  questions: { question: string; options: string[]; correctIndex: number; hint?: string | null }[]
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Quizzard';
  pptx.title = setTitle;

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: BRAND_COLORS.bg };
  titleSlide.addText(setTitle, { x: 0.5, y: 2.0, w: '90%', fontSize: 36, color: BRAND_COLORS.text, bold: true, align: 'center' });
  titleSlide.addText(`${questions.length} Questions`, { x: 0.5, y: 3.2, w: '90%', fontSize: 18, color: BRAND_COLORS.subtext, align: 'center' });

  const OPTION_LABELS = ['A', 'B', 'C', 'D'];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const slide = pptx.addSlide();
    slide.background = { color: BRAND_COLORS.bg };

    slide.addText(`Question ${i + 1} / ${questions.length}`, { x: 0.5, y: 0.3, w: '90%', fontSize: 12, color: BRAND_COLORS.subtext });
    slide.addText(q.question, { x: 0.5, y: 0.8, w: '90%', fontSize: 22, color: BRAND_COLORS.text, bold: true });

    // Options
    q.options.forEach((opt, j) => {
      slide.addText(`${OPTION_LABELS[j]}.  ${opt}`, {
        x: 1.0, y: 2.2 + j * 0.8, w: '80%',
        fontSize: 18,
        color: BRAND_COLORS.text,
      });
    });

    // Speaker notes with correct answer
    slide.addNotes(`Correct answer: ${OPTION_LABELS[q.correctIndex]}. ${q.options[q.correctIndex]}${q.hint ? `\nHint: ${q.hint}` : ''}`);
  }

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return output as Buffer;
}

export async function generatePagesPptx(
  notebookTitle: string,
  pages: { title: string; textContent: string }[]
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Quizzard';
  pptx.title = notebookTitle;

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: BRAND_COLORS.bg };
  titleSlide.addText(notebookTitle, { x: 0.5, y: 2.0, w: '90%', fontSize: 36, color: BRAND_COLORS.text, bold: true, align: 'center' });
  titleSlide.addText(`${pages.length} Pages`, { x: 0.5, y: 3.2, w: '90%', fontSize: 18, color: BRAND_COLORS.subtext, align: 'center' });

  for (const page of pages) {
    const slide = pptx.addSlide();
    slide.background = { color: BRAND_COLORS.bg };
    slide.addText(page.title, { x: 0.5, y: 0.3, w: '90%', fontSize: 28, color: BRAND_COLORS.accent, bold: true });
    // Truncate long text content to fit on a slide
    const truncatedContent = page.textContent.slice(0, 2000);
    slide.addText(truncatedContent, { x: 0.5, y: 1.2, w: '90%', h: 5.5, fontSize: 14, color: BRAND_COLORS.text, valign: 'top' });
  }

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return output as Buffer;
}

// Convert SlideData array to PPTX (used by slide editor)
export async function generateSlidesAsPptx(title: string, slides: SlideData[]): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Quizzard';
  pptx.title = title;

  for (const slideData of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: BRAND_COLORS.bg };
    slide.addText(slideData.title, { x: 0.5, y: 0.3, w: '90%', fontSize: 28, color: BRAND_COLORS.accent, bold: true });
    slide.addText(slideData.content, { x: 0.5, y: 1.2, w: '90%', h: 5.5, fontSize: 16, color: BRAND_COLORS.text, valign: 'top' });
    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }
  }

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return output as Buffer;
}
