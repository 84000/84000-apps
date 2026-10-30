import { StackController } from './StackController';
import { stackEditing } from './stack-editing';
import type { PassageStackControllerOptions } from './types';

export type { PassageStackControllerOptions } from './types';

/**
 * A stack view that can edit: `StackController` with the editing layer.
 *
 * The editor's view. A reader builds a `StackController`, which leaves the
 * editor out of its module graph; this one imports it.
 */
export class PassageStackController extends StackController {
  constructor(options: PassageStackControllerOptions) {
    super({ ...options, editing: stackEditing });
  }
}
