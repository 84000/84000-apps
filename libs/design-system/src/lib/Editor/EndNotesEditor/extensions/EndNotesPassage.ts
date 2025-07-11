import { PassageNode } from '../../TranslationEditor/extensions/Passage';

export const EndNotesPassage = PassageNode.extend({
  group: 'block',
  content: '(endNote|heading)*',
});
