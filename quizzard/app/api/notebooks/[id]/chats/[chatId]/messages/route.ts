import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { anthropic, AI_MODEL, MONTHLY_TOKEN_LIMIT } from '@/lib/anthropic';
import {
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  notFoundResponse,
  tooManyRequestsResponse,
  internalErrorResponse,
} from '@/lib/api-response';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

/** Tool definition for structured flashcard creation */
const FLASHCARD_TOOL: Anthropic.Messages.Tool = {
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

/** Tool definition for structured quiz creation */
const QUIZ_TOOL: Anthropic.Messages.Tool = {
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

/** Tool definition for mindmap generation */
const MINDMAP_TOOL: Anthropic.Messages.Tool = {
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

type Params = { params: Promise<{ id: string; chatId: string }> };

/**
 * GET – list messages for a chat (paginated if needed later)
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const { id: notebookId, chatId } = await params;

    const notebook = await db.notebook.findFirst({ where: { id: notebookId, userId } });
    if (!notebook) return notFoundResponse('Notebook not found');

    const chat = await db.notebookChat.findFirst({ where: { id: chatId, notebookId } });
    if (!chat) return notFoundResponse('Chat not found');

    const messages = await db.chatMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        tokens: true,
        createdAt: true,
      },
    });

    return successResponse(messages);
  } catch {
    return internalErrorResponse();
  }
}

/**
 * POST – send a user message and get an AI response
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    // Per-IP request rate limit: 20 requests per minute
    const ip = getClientIp(request);
    const reqLimit = rateLimit(`ai-chat:${ip}`, 20, 60_000);
    if (!reqLimit.success) {
      return tooManyRequestsResponse('Too many requests. Please slow down.', reqLimit.retryAfterMs);
    }

    const { id: notebookId, chatId } = await params;

    const notebook = await db.notebook.findFirst({ where: { id: notebookId, userId } });
    if (!notebook) return notFoundResponse('Notebook not found');

    const chat = await db.notebookChat.findFirst({ where: { id: chatId, notebookId } });
    if (!chat) return notFoundResponse('Chat not found');

    // ── Token budget check (1M tokens/month per user) ──
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const tokenUsage = await db.chatMessage.aggregate({
      where: {
        userId,
        createdAt: { gte: startOfMonth },
        tokens: { not: null },
      },
      _sum: { tokens: true },
    });

    const usedTokens = tokenUsage._sum.tokens ?? 0;
    if (usedTokens >= MONTHLY_TOKEN_LIMIT) {
      return tooManyRequestsResponse(
        `Monthly token limit reached (${MONTHLY_TOKEN_LIMIT.toLocaleString()} tokens). Resets on the 1st of next month.`
      );
    }

    // ── Parse user message ──
    const body = await request.json().catch(() => ({}));
    const { message } = body as { message?: string };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return badRequestResponse('Message cannot be empty');
    }
    if (message.length > 10_000) {
      return badRequestResponse('Message is too long (max 10,000 characters)');
    }

    // ── Build context from selected pages & documents ──
    const contextParts: string[] = [];

    if (chat.contextPageIds.length > 0) {
      const pages = await db.page.findMany({
        where: { id: { in: chat.contextPageIds } },
        select: { title: true, textContent: true },
      });
      for (const page of pages) {
        if (page.textContent) {
          contextParts.push(`[Page: ${page.title}]\n${page.textContent}`);
        }
      }
    }

    if (chat.contextDocIds.length > 0) {
      const docs = await db.document.findMany({
        where: { id: { in: chat.contextDocIds } },
        select: { fileName: true, textContent: true },
      });
      for (const doc of docs) {
        if (doc.textContent) {
          contextParts.push(`[Document: ${doc.fileName}]\n${doc.textContent}`);
        }
      }
    }

    // ── Load conversation history ──
    const history = await db.chatMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });

    const conversationMessages = history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Add the new user message
    conversationMessages.push({ role: 'user', content: message.trim() });

    // ── Build system prompt ──
    const systemParts = [
      'You are Scholar, an AI study assistant embedded in the Quizzard notebook app.',
      'Help the user study, understand, and review their notes and documents.',
      'Be concise, clear, and educational. Use markdown formatting when helpful.',
      '',
      'You have access to a `create_flashcards` tool. When the user asks you to create, generate, or make flashcards, use this tool. Create high-quality flashcards with clear questions and concise answers. For complex answers, use bullet points or numbered lists.',
      '',
      'You also have access to a `create_quiz` tool. When the user asks you to create, generate, or make a quiz, test, or multiple-choice questions, use this tool. Create challenging but fair questions with 4 options each. Always provide hints and explanations for both correct and incorrect answers to help students learn.',
      '',
      'You also have access to a `create_mindmap` tool. When the user asks you to create, generate, or make a mind map, concept map, or topic overview, use this tool. Structure the content using Markdown headings (# for root, ## for main branches, ### for sub-branches, #### for details). Keep node text concise.',
    ];

    if (contextParts.length > 0) {
      systemParts.push(
        '\nThe user has provided the following context from their notebook:\n',
        contextParts.join('\n\n---\n\n')
      );
    }

    // ── Call Anthropic API (with tools) ──
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      system: systemParts.join('\n'),
      messages: conversationMessages,
      tools: [FLASHCARD_TOOL, QUIZ_TOOL, MINDMAP_TOOL],
    });

    const totalTokens = response.usage.input_tokens + response.usage.output_tokens;

    // ── Extract text and tool_use blocks from response ──
    let assistantText = '';
    let flashcardToolUse: { id: string; input: { title: string; flashcards: { question: string; answer: string }[] } } | null = null;
    let quizToolUse: {
      id: string;
      input: {
        title: string;
        questions: {
          question: string;
          options: string[];
          correctIndex: number;
          hint?: string;
          correctExplanation?: string;
          wrongExplanation?: string;
        }[];
      };
    } | null = null;
    let mindmapToolUse: { id: string; input: { title: string; markdown: string } } | null = null;

    for (const block of response.content) {
      if (block.type === 'text') {
        assistantText += block.text;
      } else if (block.type === 'tool_use' && block.name === 'create_flashcards') {
        flashcardToolUse = {
          id: block.id,
          input: block.input as { title: string; flashcards: { question: string; answer: string }[] },
        };
      } else if (block.type === 'tool_use' && block.name === 'create_quiz') {
        quizToolUse = {
          id: block.id,
          input: block.input as {
            title: string;
            questions: {
              question: string;
              options: string[];
              correctIndex: number;
              hint?: string;
              correctExplanation?: string;
              wrongExplanation?: string;
            }[];
          },
        };
      } else if (block.type === 'tool_use' && block.name === 'create_mindmap') {
        mindmapToolUse = {
          id: block.id,
          input: block.input as { title: string; markdown: string },
        };
      }
    }

    // ── If tool_use: create flashcards in DB ──
    let flashcardSetData: { id: string; title: string; cardCount: number } | null = null;

    if (flashcardToolUse) {
      const { title: setTitle, flashcards } = flashcardToolUse.input;

      // Validate
      if (!setTitle || !Array.isArray(flashcards) || flashcards.length === 0) {
        // Fallback: treat as text-only response
        assistantText = assistantText || 'I tried to create flashcards but the format was invalid. Please try again.';
      } else {
        // Create flashcard set + cards in a transaction, along with messages
        const result = await db.$transaction(async (tx) => {
          // Save user message
          const userMsg = await tx.chatMessage.create({
            data: {
              notebookId,
              userId,
              chatId,
              role: 'user',
              content: message.trim(),
              tokens: response.usage.input_tokens,
            },
          });

          // Create flashcard set
          const fSet = await tx.flashcardSet.create({
            data: {
              notebookId,
              chatId,
              messageId: '', // placeholder, updated below
              title: setTitle,
              flashcards: {
                create: flashcards.map((fc, i) => ({
                  question: fc.question,
                  answer: fc.answer,
                  sortOrder: i,
                })),
              },
            },
            include: { flashcards: true },
          });

          // Build assistant content with marker
          const markerText = assistantText
            ? `${assistantText}\n\n[flashcard_set:${fSet.id}]`
            : `I've created a flashcard set "${setTitle}" with ${flashcards.length} cards.\n\n[flashcard_set:${fSet.id}]`;

          // Save assistant message
          const assistantMsg = await tx.chatMessage.create({
            data: {
              notebookId,
              userId,
              chatId,
              role: 'assistant',
              content: markerText,
              tokens: response.usage.output_tokens,
            },
          });

          // Update flashcard set with message ID
          await tx.flashcardSet.update({
            where: { id: fSet.id },
            data: { messageId: assistantMsg.id },
          });

          await tx.notebookChat.update({
            where: { id: chatId },
            data: { updatedAt: new Date() },
          });

          return { userMsg, assistantMsg, fSet };
        });

        flashcardSetData = {
          id: result.fSet.id,
          title: result.fSet.title,
          cardCount: result.fSet.flashcards.length,
        };

        return successResponse({
          userMessage: {
            id: result.userMsg.id,
            role: result.userMsg.role,
            content: result.userMsg.content,
            createdAt: result.userMsg.createdAt,
          },
          assistantMessage: {
            id: result.assistantMsg.id,
            role: result.assistantMsg.role,
            content: result.assistantMsg.content,
            createdAt: result.assistantMsg.createdAt,
          },
          flashcardSet: flashcardSetData,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens,
            monthlyUsed: usedTokens + totalTokens,
            monthlyLimit: MONTHLY_TOKEN_LIMIT,
          },
        });
      }
    }

    // ── If tool_use: create quiz in DB ──
    if (quizToolUse) {
      const { title: quizTitle, questions } = quizToolUse.input;

      if (!quizTitle || !Array.isArray(questions) || questions.length === 0) {
        assistantText = assistantText || 'I tried to create a quiz but the format was invalid. Please try again.';
      } else {
        const result = await db.$transaction(async (tx) => {
          const userMsg = await tx.chatMessage.create({
            data: {
              notebookId,
              userId,
              chatId,
              role: 'user',
              content: message.trim(),
              tokens: response.usage.input_tokens,
            },
          });

          const qSet = await tx.quizSet.create({
            data: {
              notebookId,
              chatId,
              messageId: '',
              title: quizTitle,
              questions: {
                create: questions.map((q, i) => ({
                  question: q.question,
                  options: q.options,
                  correctIndex: q.correctIndex,
                  hint: q.hint ?? null,
                  correctExplanation: q.correctExplanation ?? null,
                  wrongExplanation: q.wrongExplanation ?? null,
                  sortOrder: i,
                })),
              },
            },
            include: { questions: true },
          });

          const markerText = assistantText
            ? `${assistantText}\n\n[quiz_set:${qSet.id}]`
            : `I've created a quiz "${quizTitle}" with ${questions.length} questions.\n\n[quiz_set:${qSet.id}]`;

          const assistantMsg = await tx.chatMessage.create({
            data: {
              notebookId,
              userId,
              chatId,
              role: 'assistant',
              content: markerText,
              tokens: response.usage.output_tokens,
            },
          });

          await tx.quizSet.update({
            where: { id: qSet.id },
            data: { messageId: assistantMsg.id },
          });

          await tx.notebookChat.update({
            where: { id: chatId },
            data: { updatedAt: new Date() },
          });

          return { userMsg, assistantMsg, qSet };
        });

        return successResponse({
          userMessage: {
            id: result.userMsg.id,
            role: result.userMsg.role,
            content: result.userMsg.content,
            createdAt: result.userMsg.createdAt,
          },
          assistantMessage: {
            id: result.assistantMsg.id,
            role: result.assistantMsg.role,
            content: result.assistantMsg.content,
            createdAt: result.assistantMsg.createdAt,
          },
          quizSet: {
            id: result.qSet.id,
            title: result.qSet.title,
            questionCount: result.qSet.questions.length,
          },
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens,
            monthlyUsed: usedTokens + totalTokens,
            monthlyLimit: MONTHLY_TOKEN_LIMIT,
          },
        });
      }
    }

    // ── If tool_use: embed mindmap markdown inline in message ──
    if (mindmapToolUse) {
      const { title: mapTitle, markdown: mapMarkdown } = mindmapToolUse.input;

      if (mapTitle && mapMarkdown) {
        const markerText = (assistantText ? `${assistantText}\n\n` : '')
          + `[mindmap_start:${mapTitle}]\n${mapMarkdown}\n[mindmap_end]`;

        const [userMsg, assistantMsg] = await db.$transaction([
          db.chatMessage.create({
            data: {
              notebookId,
              userId,
              chatId,
              role: 'user',
              content: message.trim(),
              tokens: response.usage.input_tokens,
            },
          }),
          db.chatMessage.create({
            data: {
              notebookId,
              userId,
              chatId,
              role: 'assistant',
              content: markerText,
              tokens: response.usage.output_tokens,
            },
          }),
        ]);

        await db.notebookChat.update({
          where: { id: chatId },
          data: { updatedAt: new Date() },
        });

        return successResponse({
          userMessage: {
            id: userMsg.id,
            role: userMsg.role,
            content: userMsg.content,
            createdAt: userMsg.createdAt,
          },
          assistantMessage: {
            id: assistantMsg.id,
            role: assistantMsg.role,
            content: assistantMsg.content,
            createdAt: assistantMsg.createdAt,
          },
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens,
            monthlyUsed: usedTokens + totalTokens,
            monthlyLimit: MONTHLY_TOKEN_LIMIT,
          },
        });
      }
    }

    // ── Standard text-only response path ──
    const [userMsg, assistantMsg] = await db.$transaction([
      db.chatMessage.create({
        data: {
          notebookId,
          userId,
          chatId,
          role: 'user',
          content: message.trim(),
          tokens: response.usage.input_tokens,
        },
      }),
      db.chatMessage.create({
        data: {
          notebookId,
          userId,
          chatId,
          role: 'assistant',
          content: assistantText,
          tokens: response.usage.output_tokens,
        },
      }),
    ]);

    // Touch chat updatedAt
    await db.notebookChat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    return successResponse({
      userMessage: {
        id: userMsg.id,
        role: userMsg.role,
        content: userMsg.content,
        createdAt: userMsg.createdAt,
      },
      assistantMessage: {
        id: assistantMsg.id,
        role: assistantMsg.role,
        content: assistantMsg.content,
        createdAt: assistantMsg.createdAt,
      },
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens,
        monthlyUsed: usedTokens + totalTokens,
        monthlyLimit: MONTHLY_TOKEN_LIMIT,
      },
    });
  } catch (error: unknown) {
    console.error('[AI Chat] Error:', error);

    // Surface Anthropic API errors with useful messages
    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as { status: number; error?: { message?: string } };
      const msg = apiError.error?.message ?? 'AI service error';

      if (apiError.status === 400 && msg.includes('credit balance')) {
        return badRequestResponse('AI service billing issue. Please check your Anthropic API credits.');
      }
      if (apiError.status === 401) {
        return badRequestResponse('Invalid Anthropic API key. Please check your configuration.');
      }
      if (apiError.status === 429) {
        return tooManyRequestsResponse('AI service rate limit reached. Please wait a moment and try again.');
      }
      if (apiError.status === 529 || apiError.status === 503) {
        return internalErrorResponse('AI service is temporarily overloaded. Please try again in a moment.');
      }
    }

    return internalErrorResponse();
  }
}
