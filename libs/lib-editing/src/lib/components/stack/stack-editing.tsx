'use client';

import { rowKindOf } from '@eightyfourthousand/lib-doc-model';
import { ySyncPluginKey } from '@tiptap/y-tiptap';

import { MentionAdvancedOverlay } from '../editor/extensions/Mention/MentionAdvancedOverlay';
import { BibliographyBubbleMenu, TranslationBubbleMenu } from '../editor/menus';
import { BibliographyRowMenu } from './BibliographyRowMenu';
import { GlossaryEntryPanel } from './GlossaryEntryPanel';
import { GlossaryRowMenu } from './GlossaryRowMenu';
import { StackPassageEditor } from './StackPassageEditor';
import { StackPassageMenu } from './StackPassageMenu';
import { buildBibliographyEditorExtensions } from './bibliography-editor-extensions';
import { buildGlossaryEditorExtensions } from './glossary-editor-extensions';
import { buildStackEditorExtensions } from './stack-editor-extensions';
import type { StackEditing, StackEditingMenusProps } from './types';

/**
 * The editing controls drawn once for a whole stack.
 *
 * One of each, bound to the focused passage: only one passage is editable at
 * a time, so a copy per row would watch nothing. The bubble and mention menus
 * are keyed so they rebind rather than hold a stale editor, and prefixed, or
 * the two keyed siblings would share a key.
 */
const StackEditingMenus = ({
  controller,
  editor,
  target,
  onClose,
}: StackEditingMenusProps) => {
  const focused = controller.getFocusedUuid() ?? 'none';
  const focusedMeta = controller.getMeta(controller.getFocusedUuid() ?? '');
  const focusedKind = focusedMeta ? rowKindOf(focusedMeta.type) : null;
  // A reader may look at an entry, but not edit it.
  if (controller.isReadOnly()) {
    return (
      controller.getRows() === 'glossary' && (
        <>
          <GlossaryRowMenu
            controller={controller}
            target={target}
            onClose={onClose}
          />
          <GlossaryEntryPanel controller={controller} />
        </>
      )
    );
  }
  return (
    <>
      {controller.getRows() === 'bibliography' ? (
        // A heading is plain text: there is nothing to format.
        <BibliographyBubbleMenu
          key={`bubble-${focused}`}
          editor={focusedKind === 'entry' ? editor : null}
        />
      ) : controller.getRows() === 'glossary' ? (
        // A definition has the bibliography's inline marks.
        <BibliographyBubbleMenu key={`bubble-${focused}`} editor={editor} />
      ) : (
        <TranslationBubbleMenu key={`bubble-${focused}`} editor={editor} />
      )}
      {controller.restructures() && (
        <StackPassageMenu
          controller={controller}
          target={target}
          onClose={onClose}
        />
      )}
      {controller.editsOutline() && (
        <BibliographyRowMenu
          controller={controller}
          target={target}
          onClose={onClose}
        />
      )}
      {controller.getRows() === 'glossary' && (
        <>
          <GlossaryRowMenu
            controller={controller}
            target={target}
            onClose={onClose}
          />
          <GlossaryEntryPanel controller={controller} />
        </>
      )}
      {editor && (
        <MentionAdvancedOverlay key={`mention-${focused}`} editor={editor} />
      )}
    </>
  );
};

/** The stack's editing layer, which `PassageStackController` hands its views. */
export const stackEditing: StackEditing = {
  textOrigin: ySyncPluginKey,
  passageExtensions: buildStackEditorExtensions,
  bibliographyExtensions: buildBibliographyEditorExtensions,
  glossaryExtensions: buildGlossaryEditorExtensions,
  PassageEditor: StackPassageEditor,
  Menus: StackEditingMenus,
};
