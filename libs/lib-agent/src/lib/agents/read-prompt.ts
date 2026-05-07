import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readPrompt(agentDir: string, filename = 'prompt.md'): string {
  return readFileSync(join(agentDir, filename), 'utf-8');
}
