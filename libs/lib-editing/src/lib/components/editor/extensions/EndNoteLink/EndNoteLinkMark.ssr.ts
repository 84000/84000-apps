import { Mark, mergeAttributes } from '@tiptap/core';
import { cn } from '@eightyfourthousand/lib-utils';

export interface EndNoteLinkSSROptions {
  HTMLAttributes: Record<string, unknown>;
}

interface EndNoteItem {
  uuid: string;
  location?: string;
  toh?: string;
  endNote: string;
  label?: string;
}

const isEndNoteItem = (value: unknown): value is EndNoteItem => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.uuid === 'string' && typeof v.endNote === 'string';
};

export const EndNoteLinkMarkSSR = Mark.create<EndNoteLinkSSROptions>({
  name: 'endNoteLink',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      notes: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('notes'),
      },
    };
  },

  renderHTML({ mark }) {
    const raw = mark.attrs.notes;
    const notes: EndNoteItem[] = Array.isArray(raw) ? raw.filter(isEndNoteItem) : [];
    notes.sort((a, b) => (a.label || '').localeCompare(b.label || ''));

    const sup = (note: EndNoteItem, marginClass: string) => {
      const itemLabel = note.label?.split('.').pop() || '';
      return [
        'sup',
        {
          class: cn('end-note-link', note.toh, marginClass),
          type: 'endNoteLink',
          endNote: note.endNote,
          uuid: note.uuid,
        },
        itemLabel,
      ] as unknown;
    };

    const startSups = notes
      .filter((n) => n.location === 'start')
      .map((n) => sup(n, 'me-0.75'));
    const endSups = notes
      .filter((n) => n.location !== 'start')
      .map((n) => sup(n, ''));

    return ['span', mergeAttributes(this.options.HTMLAttributes, {}), ...startSups, 0, ...endSups];
  },
});

export default EndNoteLinkMarkSSR;
