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
    let component: ReactRenderer<
      MentionListHandle,
      SuggestionProps<MentionSearchResult>
    >;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let popup: Instance<any>[];

    return {
      onStart: (props) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        const clientRect = props.clientRect?.();
        const getReferenceClientRect = clientRect ? () => clientRect : null;
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
        component.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup[0].hide();
          return true;
        }
        return component.ref?.onKeyDown(props) ?? false;
      },

      onExit() {
        component.destroy();
        popup[0].destroy();
      },
    };
  },
};
