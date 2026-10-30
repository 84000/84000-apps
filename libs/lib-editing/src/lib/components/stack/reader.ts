// The stack for reading, without the editor: nothing here imports the
// live-editor components, their menus, or the collaboration and y-sync
// plugins. `stack-reader-graph.spec.ts` holds it to that.
export { NavigationProvider } from '../shared/NavigationProvider';
export { useNavigation } from '../shared/NavigationContext';
export { PassageStack } from './PassageStack';
export { StackController } from './StackController';
export { StackReaderProvider } from './StackReaderProvider';
export { StackTab } from './StackTab';
export { useStackWork, type StackWork } from './stack-work-context';
