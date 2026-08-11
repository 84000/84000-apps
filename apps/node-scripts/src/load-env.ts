/**
 * Loads `apps/node-scripts/.env` into the environment.
 *
 * Imported for its side effect and nothing else, so it belongs first in a script's import
 * list — though in practice any top-level position works, since credentials are read when
 * `createServiceRoleClient()` is called rather than at import time.
 *
 * The path is resolved relative to this module rather than left to dotenv's default. These
 * scripts are documented as being run from the repo root:
 *
 *   npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/<script>.ts
 *
 * so `process.cwd()` is the repo root, not this directory, and the default lookup would
 * miss the file — silently, because a missing file is a returned error object, not a throw.
 *
 * Real environment variables win: dotenv does not overwrite anything already set, so an
 * exported `SUPABASE_URL` still beats the file. That ordering matters here, since it is
 * what lets an operator point a run at a different project without editing the file.
 */

import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

config({
  path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env'),
  // The startup banner is noise in an operational command's output.
  quiet: true,
});
