import { groupUsage, type Command } from '../../command';
import { checkTrackedCommand } from './check-tracked';

const commands: Command[] = [checkTrackedCommand];

/** `eft docx`: Word files. */
export const docx: Command = {
  name: 'docx',
  summary: 'Word files: check a tracked-changes copy.',
  usage: groupUsage('eft docx', 'eft docx: Word files.', commands),
  commands,
};
