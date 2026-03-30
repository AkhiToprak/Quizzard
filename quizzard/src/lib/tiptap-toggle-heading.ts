import { Node, mergeAttributes } from '@tiptap/core';

/**
 * ToggleHeading — a block-level TipTap node for collapsible heading sections.
 *
 * Structure: a wrapper node containing a heading summary and content.
 * The collapsed state is stored as an attribute.
 *
 * Usage:
 *   editor.chain().focus().setToggleHeading({ level: 1 }).run()
 *   editor.chain().focus().toggleToggleHeading({ level: 2 }).run()
 */

export type ToggleLevel = 1 | 2 | 3;

export interface ToggleHeadingOptions {
  HTMLAttributes: Record<string, unknown>;
  levels: ToggleLevel[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggleHeading: {
      setToggleHeading: (attrs: { level: ToggleLevel }) => ReturnType;
      toggleToggleHeading: (attrs: { level: ToggleLevel }) => ReturnType;
      unsetToggleHeading: () => ReturnType;
    };
  }
}

const LEVEL_STYLES: Record<ToggleLevel, { fontSize: string; fontWeight: string; letterSpacing: string }> = {
  1: { fontSize: '30px', fontWeight: '700', letterSpacing: '-0.03em' },
  2: { fontSize: '22px', fontWeight: '700', letterSpacing: '-0.02em' },
  3: { fontSize: '18px', fontWeight: '600', letterSpacing: '0em' },
};

export { LEVEL_STYLES as TOGGLE_HEADING_STYLES };

export const ToggleHeading = Node.create<ToggleHeadingOptions>({
  name: 'toggleHeading',

  group: 'block',

  content: 'block+',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      levels: [1, 2, 3],
    };
  },

  addAttributes() {
    return {
      level: {
        default: 1,
        parseHTML: (element) => {
          const val = element.getAttribute('data-toggle-level');
          return val ? Number(val) : 1;
        },
        renderHTML: (attributes) => ({
          'data-toggle-level': String(attributes.level),
        }),
      },
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-collapsed') === 'true',
        renderHTML: (attributes) => ({
          'data-collapsed': String(attributes.collapsed),
        }),
      },
      summary: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-toggle-summary') || '',
        renderHTML: (attributes) => ({
          'data-toggle-summary': attributes.summary || '',
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-toggle-level]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setToggleHeading:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { level: attrs.level, collapsed: false, summary: '' }),

      toggleToggleHeading:
        (attrs) =>
        ({ commands, editor }) => {
          if (editor.isActive(this.name)) {
            return commands.lift(this.name);
          }
          return commands.wrapIn(this.name, { level: attrs.level, collapsed: false, summary: '' });
        },

      unsetToggleHeading:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },
});
