import type Anthropic from '@anthropic-ai/sdk';

// ── Typed interfaces for tool inputs ──

export interface FlashcardToolInput {
  title: string;
  flashcards: { question: string; answer: string }[];
}

export interface QuizToolInput {
  title: string;
  questions: {
    question: string;
    options: string[];
    correctIndex: number;
    hint?: string;
    correctExplanation?: string;
    wrongExplanation?: string;
  }[];
}

export interface MindmapToolInput {
  title: string;
  markdown: string;
}

export interface StudyPlanToolInput {
  title: string;
  description: string;
  phases: {
    title: string;
    description: string;
    durationDays: number;
    materials: { type: 'page' | 'flashcard_set' | 'quiz_set' | 'document'; referenceId: string; title: string }[];
  }[];
}

// ── Tool definitions ──

export const FLASHCARD_TOOL: Anthropic.Messages.Tool = {
  name: 'create_flashcards',
  description:
    'Create a set of study flashcards. Use this tool when the user asks you to create, generate, or make flashcards from their notes or on a topic. Each flashcard has a question on the front and an answer on the back.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'A short, descriptive title for the flashcard set (e.g. "Cell Biology Key Terms")',
      },
      flashcards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The question or prompt on the front of the card',
            },
            answer: {
              type: 'string',
              description: 'The answer on the back of the card. Can use bullet points or numbered lists for complex answers.',
            },
          },
          required: ['question', 'answer'],
        },
        description: 'Array of flashcard objects with question and answer',
        minItems: 1,
      },
    },
    required: ['title', 'flashcards'],
  },
};

export const QUIZ_TOOL: Anthropic.Messages.Tool = {
  name: 'create_quiz',
  description:
    'Create a multiple-choice quiz. Use this tool when the user asks you to create, generate, or make a quiz, test, or multiple-choice questions from their notes or on a topic. Each question has 4 options with one correct answer.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'A short, descriptive title for the quiz (e.g. "Cell Biology Quiz")',
      },
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The question text',
            },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: 'Exactly 4 answer choices',
              minItems: 4,
              maxItems: 4,
            },
            correctIndex: {
              type: 'number',
              description: 'The 0-based index of the correct answer (0-3)',
            },
            hint: {
              type: 'string',
              description: 'An optional hint to help the student',
            },
            correctExplanation: {
              type: 'string',
              description: 'Explanation shown when the student answers correctly',
            },
            wrongExplanation: {
              type: 'string',
              description: 'Explanation shown when the student answers incorrectly',
            },
          },
          required: ['question', 'options', 'correctIndex'],
        },
        description: 'Array of quiz question objects',
        minItems: 1,
      },
    },
    required: ['title', 'questions'],
  },
};

export const MINDMAP_TOOL: Anthropic.Messages.Tool = {
  name: 'create_mindmap',
  description:
    'Create an interactive mind map. Use this tool when the user asks you to create, generate, or make a mind map, concept map, or topic overview from their notes or on a topic. The mindmap is defined as Markdown with heading hierarchy (# for root, ## for branches, ### for sub-branches, etc.).',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'A short title for the mind map',
      },
      markdown: {
        type: 'string',
        description: 'The mind map content as Markdown using heading levels (# root, ## branches, ### sub-branches, #### details). Use only headings (# ## ### ####) to define the hierarchy. Keep node text concise. Example:\n# Biology\n## Cells\n### Prokaryotic\n### Eukaryotic\n## Genetics\n### DNA\n### RNA',
      },
    },
    required: ['title', 'markdown'],
  },
};

export const STUDY_PLAN_TOOL: Anthropic.Messages.Tool = {
  name: 'create_study_plan',
  description:
    'Create a structured study plan with phases and materials. Use this tool when the user asks you to create, generate, or make a study plan, study schedule, or revision plan from their notebook materials. Each phase has a title, description, duration, and a list of materials to study.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'A short, descriptive title for the study plan (e.g. "Biology Midterm Prep")',
      },
      description: {
        type: 'string',
        description: 'A brief description of the study plan goals and approach',
      },
      phases: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Phase title (e.g. "Week 1: Foundations")',
            },
            description: {
              type: 'string',
              description: 'What the student should focus on in this phase',
            },
            durationDays: {
              type: 'number',
              description: 'How many days this phase should last',
            },
            materials: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['page', 'flashcard_set', 'quiz_set', 'document'],
                    description: 'The type of study material',
                  },
                  referenceId: {
                    type: 'string',
                    description: 'The exact ID of the resource from the notebook inventory',
                  },
                  title: {
                    type: 'string',
                    description: 'The title of the resource',
                  },
                },
                required: ['type', 'referenceId', 'title'],
              },
              description: 'Materials to study in this phase',
            },
          },
          required: ['title', 'description', 'durationDays', 'materials'],
        },
        description: 'Sequential phases of the study plan',
        minItems: 1,
      },
    },
    required: ['title', 'description', 'phases'],
  },
};

export const ALL_TOOLS = [FLASHCARD_TOOL, QUIZ_TOOL, MINDMAP_TOOL, STUDY_PLAN_TOOL];

// ── Helper to extract tool uses from Anthropic response ──

export function extractToolUses(content: Anthropic.Messages.ContentBlock[]) {
  let text = '';
  let flashcard: { id: string; input: FlashcardToolInput } | null = null;
  let quiz: { id: string; input: QuizToolInput } | null = null;
  let mindmap: { id: string; input: MindmapToolInput } | null = null;
  let studyPlan: { id: string; input: StudyPlanToolInput } | null = null;

  for (const block of content) {
    if (block.type === 'text') {
      text += block.text;
    } else if (block.type === 'tool_use') {
      if (block.name === 'create_flashcards') {
        flashcard = { id: block.id, input: block.input as FlashcardToolInput };
      } else if (block.name === 'create_quiz') {
        quiz = { id: block.id, input: block.input as QuizToolInput };
      } else if (block.name === 'create_mindmap') {
        mindmap = { id: block.id, input: block.input as MindmapToolInput };
      } else if (block.name === 'create_study_plan') {
        studyPlan = { id: block.id, input: block.input as StudyPlanToolInput };
      }
    }
  }

  return { text, flashcard, quiz, mindmap, studyPlan };
}
