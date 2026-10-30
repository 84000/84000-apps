import { Editor, Range } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import tippy, { Instance } from 'tippy.js';
import MentionList, { MentionListHandle } from './MentionList';
import { MentionSearchResult } from './useMentionSearch';

export const mentionSuggestionPluginKey = new PluginKey('mentionSuggestion');

/**
 * `@`-triggered suggestion that inserts a Mention referencing a searched entity.
 * Data is fetched inside <MentionList> (debounced lib-search); the items list is
 * intentionally empty here since results are query-driven and async.
 */
export const mentionSuggestion: Omit<
  SuggestionOptions<MentionSearchResult>,
  'editor'
> = {
  char: '@',
  pluginKey: mentionSuggestionPluginKey,
  // Entity labels (work titles, glossary terms, etc.) contain spaces, so the
  // query must survive them. Without this, the first space ends the match and
  // closes the popup.
  allowSpaces: true,
  items: () => [],
  command: ({
    editor,
    range,
    props,
  }: {
    editor: Editor;
    range: Range;
    props: MentionSearchResult;
  }) => {
    // Seed displayText with the picker label for immediate display. It is not
    // persisted, so the canonical label resolves on load (e.g. folios render as
    // "[F.x.y]"); a persisted override can be set via the mention hover card.
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .setMention(
        props.entity,
        props.linkType,
        props.label,
        props.linkType !== 'work',
      )
      .run();
  },
  render: () => {
    // Both stay unset until `onStart`, which the plugin calls only after an
    // async `items` lookup. Its view can be torn down in between (the stack
    // re-keys its BubbleMenu when focus moves), calling `onExit` first, so
    // every hook tolerates them being missing.
    let component:
      | ReactRenderer<MentionListHandle, SuggestionProps<MentionSearchResult>>
      | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let popup: Instance<any>[] | undefined;

    return {
      onStart: (props) => {
        // A start that lands after its editor is gone would leave a popup
        // nothing exits; one that lands twice replaces the first.
        if (props.editor.isDestroyed) return;
        component?.destroy();
        popup?.[0]?.destroy();

        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        // Use the live clientRect function so the popup tracks the caret from
        // the first frame instead of anchoring to a stale snapshot.
        const getReferenceClientRect = props.clientRect
          ? () => props.clientRect?.() ?? new DOMRect()
          : null;
        popup = tippy('body', {
          getReferenceClientRect,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          appendTo: () => document.body,
        });
      },

      onUpdate(props) {
        component?.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup?.[0]?.setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide();
          return true;
        }
        return component?.ref?.onKeyDown(props) ?? false;
      },

      onExit() {
        component?.destroy();
        popup?.[0]?.destroy();
        component = undefined;
        popup = undefined;
      },
    };
  },
};
