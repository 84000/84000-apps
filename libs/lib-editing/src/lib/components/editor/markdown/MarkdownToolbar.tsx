'use client';

import type { ChainedCommands, Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  toggleVariants,
} from '@eightyfourthousand/design-system/core';
import { cn } from '@eightyfourthousand/lib-utils';
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  type LucideIcon,
  MinusIcon,
  QuoteIcon,
  Redo2Icon,
  SquareCodeIcon,
  StrikethroughIcon,
  Undo2Icon,
} from 'lucide-react';
import {
  type ComponentProps,
  type FormEvent,
  type MouseEvent,
  useState,
} from 'react';

type Command = {
  label: string;
  icon: LucideIcon;
  /** The keyboard shortcut, with `Mod` for Cmd or Ctrl. */
  keys?: string;
  /** Whether the selection already has it; omitted for one-off actions. */
  active?: (editor: Editor) => boolean;
  apply: (chain: ChainedCommands) => ChainedCommands;
};

/** Markdown-safe commands, grouped as the toolbar shows them. */
const GROUPS: Command[][] = [
  ([1, 2, 3] as const).map((level) => ({
    label: `Heading ${level}`,
    icon: [Heading1Icon, Heading2Icon, Heading3Icon][level - 1],
    keys: `Mod-Alt-${level}`,
    active: (editor) => editor.isActive('heading', { level }),
    apply: (chain) => chain.toggleHeading({ level }),
  })),
  [
    {
      label: 'Bold',
      icon: BoldIcon,
      keys: 'Mod-B',
      active: (editor) => editor.isActive('bold'),
      apply: (chain) => chain.toggleBold(),
    },
    {
      label: 'Italic',
      icon: ItalicIcon,
      keys: 'Mod-I',
      active: (editor) => editor.isActive('italic'),
      apply: (chain) => chain.toggleItalic(),
    },
    {
      label: 'Strikethrough',
      icon: StrikethroughIcon,
      keys: 'Mod-Shift-S',
      active: (editor) => editor.isActive('strike'),
      apply: (chain) => chain.toggleStrike(),
    },
    {
      label: 'Inline code',
      icon: CodeIcon,
      keys: 'Mod-E',
      active: (editor) => editor.isActive('code'),
      apply: (chain) => chain.toggleCode(),
    },
  ],
  [
    {
      label: 'Bulleted list',
      icon: ListIcon,
      keys: 'Mod-Shift-8',
      active: (editor) => editor.isActive('bulletList'),
      apply: (chain) => chain.toggleBulletList(),
    },
    {
      label: 'Numbered list',
      icon: ListOrderedIcon,
      keys: 'Mod-Shift-7',
      active: (editor) => editor.isActive('orderedList'),
      apply: (chain) => chain.toggleOrderedList(),
    },
    {
      label: 'Quote',
      icon: QuoteIcon,
      keys: 'Mod-Shift-B',
      active: (editor) => editor.isActive('blockquote'),
      apply: (chain) => chain.toggleBlockquote(),
    },
    {
      label: 'Code block',
      icon: SquareCodeIcon,
      keys: 'Mod-Alt-C',
      active: (editor) => editor.isActive('codeBlock'),
      apply: (chain) => chain.toggleCodeBlock(),
    },
    {
      label: 'Divider',
      icon: MinusIcon,
      apply: (chain) => chain.setHorizontalRule(),
    },
  ],
  [
    {
      label: 'Undo',
      icon: Undo2Icon,
      keys: 'Mod-Z',
      apply: (chain) => chain.undo(),
    },
    {
      label: 'Redo',
      icon: Redo2Icon,
      keys: 'Mod-Shift-Z',
      apply: (chain) => chain.redo(),
    },
  ],
];

const COMMANDS = GROUPS.flat();

const isMac = () =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

const describe = (label: string, keys?: string) =>
  keys
    ? `${label} (${keys
        .replace('Mod', isMac() ? '⌘' : 'Ctrl')
        .replace('Alt', isMac() ? '⌥' : 'Alt')
        .replace('Shift', isMac() ? '⇧' : 'Shift')
        .replaceAll('-', isMac() ? '' : '+')})`
    : label;

/** Keeps the editor's selection when a toolbar button is pressed. */
const keepSelection = (event: MouseEvent) => event.preventDefault();

const ToolbarButton = ({
  active,
  className,
  ...props
}: ComponentProps<'button'> & { active?: boolean }) => (
  <button
    type="button"
    aria-pressed={active}
    className={cn(
      toggleVariants({ size: 'sm' }),
      'hover:bg-primary/5 hover:text-foreground',
      active &&
        'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
      className,
    )}
    onMouseDown={keepSelection}
    {...props}
  />
);

/**
 * A persistent formatting toolbar for the markdown editor, offering only what
 * markdown can express.
 */
export const MarkdownToolbar = ({ editor }: { editor: Editor }) => {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      active: COMMANDS.map((command) => command.active?.(editor) ?? false),
      enabled: COMMANDS.map((command) =>
        command.apply(editor.can().chain()).run(),
      ),
      link: editor.isActive('link')
        ? String(editor.getAttributes('link').href ?? '')
        : undefined,
      canLink: editor.can().setLink({ href: '#' }),
    }),
  });

  let index = 0;
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="mb-2 flex flex-wrap items-center gap-0.5 border-b pb-2"
    >
      {GROUPS.map((group, groupIndex) => (
        <div key={groupIndex} className="flex items-center gap-0.5">
          {groupIndex > 0 && (
            <Separator orientation="vertical" className="mx-1 h-5" />
          )}
          {group.map((command) => {
            const at = index++;
            const Icon = command.icon;
            const description = describe(command.label, command.keys);
            return (
              <ToolbarButton
                key={command.label}
                aria-label={command.label}
                title={description}
                active={command.active && state.active[at]}
                disabled={!state.enabled[at]}
                onClick={() => command.apply(editor.chain().focus()).run()}
              >
                <Icon />
              </ToolbarButton>
            );
          })}
          {groupIndex === 1 && (
            <LinkButton
              editor={editor}
              href={state.link}
              disabled={!state.canLink}
            />
          )}
        </div>
      ))}
    </div>
  );
};

/** Adds, changes or removes the link at the selection. */
const LinkButton = ({
  editor,
  href,
  disabled,
}: {
  editor: Editor;
  /** The selected link's address, if the selection is in a link. */
  href?: string;
  disabled: boolean;
}) => {
  const [open, setOpen] = useState(false);

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = String(new FormData(event.currentTarget).get('href')).trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (!url) {
      chain.unsetLink().run();
    } else if (href === undefined && editor.state.selection.empty) {
      // Nothing selected to link, so insert the address as the link text.
      chain
        .insertContent({
          type: 'text',
          text: url,
          marks: [{ type: 'link', attrs: { href: url } }],
        })
        .run();
    } else {
      chain.setLink({ href: url }).run();
    }
    setOpen(false);
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolbarButton
          aria-label="Link"
          title={describe('Link')}
          active={href !== undefined}
          disabled={disabled}
        >
          <LinkIcon />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <form onSubmit={apply} className="flex items-center gap-2">
          <Input
            name="href"
            aria-label="Link address"
            placeholder="https://…"
            value={href ?? ''}
            autoComplete="off"
            autoFocus
            className="h-8"
          />
          <Button type="submit" size="xs">
            Apply
          </Button>
          {href !== undefined && (
            <Button type="button" size="xs" variant="outline" onClick={remove}>
              Remove
            </Button>
          )}
        </form>
      </PopoverContent>
    </Popover>
  );
};
