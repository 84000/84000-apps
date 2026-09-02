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
 * Re-exported from here rather than left to the main `lib-editing` barrel so a
 * consumer of this subpath does not have to import both: this subpath pulls
 * yjs and y-prosemirror, and loading the library through two entry points is
 * what produces "Yjs was already imported. This breaks constructor checks".
 */
export { NavigationProvider } from '../shared/NavigationProvider';

export * from './passage-source';
export * from './spine-feed';
export * from './PassageStack';
export * from './PassageStackController';
export * from './PerfHUD';
export * from './StackPassageEditor';
export * from './StackRow';
export * from './stack-work';
export * from './types';
