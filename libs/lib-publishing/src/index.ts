/**
 * Client-safe exports.
 *
 * Types and pure helpers only. Everything that touches Supabase or Node built-ins lives
 * behind the `/ssr` entry point, because the pipeline requires a service_role client.
 *
 * Note the validation RULES are not here: they live in SQL
 * (`validate_work_for_publish`), so there is exactly one implementation, and the
 * editor cannot disagree with the publish gate. This entry point carries the finding
 * TYPES for rendering them.
 */

export * from './lib/types';
export * from './lib/artifact-keys';
export * from './lib/version-label';
export * from './lib/findings';
