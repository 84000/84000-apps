import { Extension, type Editor } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';
import type { ParameterAnnotationValue } from '@eightyfourthousand/lib-doc-model';

/**
 * Builds the tiptap extension for a parameter annotation — one that has no node
 * or mark of its own and rides as an attribute on whichever block hosts it.
 *
 * The attribute is a single `{ uuid, toh }` object rather than the `hasX` /
 * `xUuid` / `xToh` triple it replaces. Presence, identity and Tohoku scope then
 * move together: no code path can copy the flag without the uuid, and adding
 * the scope did not mean adding a third name to four separate lists.
 */
export type ParameterAnnotationConfig = {
  /** Extension name, e.g. `indent`. */
  name: string;
  /** Node attribute the value is stored under. Usually the same as `name`. */
  attr: string;
  /** Block types that may host it. */
  types: string[];
  /** Classes applied to a host block that carries the annotation. */
  className: string;
  /** Prefix for the `data-*-uuid` / `data-*-toh` HTML attributes. */
  dataPrefix: string;
};

/** Whether any block in the current selection carries `attr`. */
export const isParameterAnnotationActive = (
  editor: Editor,
  attr: string,
): boolean => {
  const { from, to } = editor.state.selection;
  let active = false;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (active) {
      return false;
    }
    if (node.attrs?.[attr]) {
      active = true;
      return false;
    }
    return true;
  });
  return active;
};

export const createParameterAnnotationExtension = ({
  name,
  attr,
  types,
  className,
  dataPrefix,
}: ParameterAnnotationConfig) =>
  Extension.create<{ types: string[] }>({
    name,

    addOptions() {
      return { types };
    },

    addGlobalAttributes() {
      return [
        {
          types: this.options.types,
          attributes: {
            [attr]: {
              default: undefined,

              // Parsed only when the uuid attribute is present. Minting one
              // here instead would hand every parse of the same HTML a
              // different identity, which the save path reads as a new
              // annotation on every load.
              parseHTML: (element: HTMLElement) => {
                const uuid = element.getAttribute(`data-${dataPrefix}-uuid`);
                if (!uuid) {
                  return undefined;
                }
                const toh =
                  element.getAttribute(`data-${dataPrefix}-toh`) || undefined;
                return { uuid, ...(toh ? { toh } : {}) };
              },

              renderHTML: (attributes: Record<string, unknown>) => {
                const value = attributes[attr] as
                  | ParameterAnnotationValue
                  | undefined;
                if (!value?.uuid) {
                  return {};
                }
                return {
                  class: className,
                  [`data-${dataPrefix}-uuid`]: value.uuid,
                  // Drives the reader's toh-visibility rule, which hides any
                  // `[data-toh]` outside the active Tohoku text.
                  ...(value.toh
                    ? {
                        [`data-${dataPrefix}-toh`]: value.toh,
                        'data-toh': value.toh,
                      }
                    : {}),
                };
              },
            },
          },
        },
      ];
    },

    addCommands() {
      return {
        [`set${name[0].toUpperCase()}${name.slice(1)}`]:
          () =>
          ({ commands }: { commands: Record<string, CallableFunction> }) =>
            this.options.types
              .map((type) =>
                commands.updateAttributes(type, { [attr]: { uuid: uuidv4() } }),
              )
              .every(Boolean),

        [`unset${name[0].toUpperCase()}${name.slice(1)}`]:
          () =>
          ({ commands }: { commands: Record<string, CallableFunction> }) =>
            this.options.types
              .map((type) => commands.resetAttributes(type, [attr]))
              .every(Boolean),

        [`toggle${name[0].toUpperCase()}${name.slice(1)}`]:
          () =>
          ({
            editor,
            commands,
          }: {
            editor: Editor;
            commands: Record<string, CallableFunction>;
          }) =>
            isParameterAnnotationActive(editor, attr)
              ? commands[`unset${name[0].toUpperCase()}${name.slice(1)}`]()
              : commands[`set${name[0].toUpperCase()}${name.slice(1)}`](),
      };
    },
  });
