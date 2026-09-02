/**
 * `NavigationProvider` re-exported deliberately.
 *
 * The stack's bubble menu contains an `EndNoteSelector` that reads
 * `useNavigation()`, so a host must supply that provider — the stack does not
 * mount it itself, because `web-main` already does (through
 * `EditorContextProvider`) and a nested one would shadow it with a different
 * work.
 *
 * Without it the menu still renders and every selector still opens: the
 * context has a full default object. What breaks is using the endnote picker,
 * whose work uuid would be `''` and whose fetch throws.
 *
 * `useNavigation` and `useTohToggle` come with it, because a host also owes the
 * stack a toh-visibility rule. `web-main` installs one from `LeftPanel`; a host
 * without that panel has to do it itself, or every toh-scoped annotation shows
 * at once — two endnote markers numbered 10, one per Tohoku text. Not applied
 * by the stack itself: with no provider above it the active toh would be
 * `undefined`, and the rule for that hides *all* scoped markup, which is worse
 * than doing nothing.
 *
 * Re-exported from here rather than left to the main `lib-editing` barrel so a
 * consumer of this subpath does not have to import both: this subpath pulls
 * yjs and y-prosemirror, and loading the library through two entry points is
 * what produces "Yjs was already imported. This breaks constructor checks".
 */
export { NavigationProvider } from '../shared/NavigationProvider';
export { useNavigation } from '../shared/NavigationContext';
export { useTohToggle } from '../shared/hooks/useTohToggle';
export { useStackTohVisibility } from './useStackTohVisibility';

export * from './passage-source';
export * from './spine-feed';
export * from './PassageStack';
export * from './PassageStackController';
export * from './PerfHUD';
export * from './StackPassageEditor';
export * from './StackRow';
export * from './stack-work';
export * from './types';
