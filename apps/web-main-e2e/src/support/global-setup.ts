import { existsSync } from 'node:fs';
import path from 'node:path';
import { infraDir, localStack, RESTORE_SCRIPT } from './local-stack';

/**
 * Refuses to start without a running local stack and the infra restore
 * script, with the reason, before any server starts or test runs.
 */
export default function globalSetup() {
  localStack();
  const script = path.join(infraDir(), RESTORE_SCRIPT);
  if (!existsSync(script)) {
    throw new Error(
      `${script} is missing. The suite restores its test work with it; update the infra checkout.`,
    );
  }
}
