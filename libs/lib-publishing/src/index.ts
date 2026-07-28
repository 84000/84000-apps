/**
 * Client-safe exports.
 *
 * Types and pure helpers only. Everything that touches Supabase or Node built-ins lives
 * behind the `/ssr` entry point, because the pipeline requires a service_role client.
 */

export * from './lib/types';
export * from './lib/artifact-keys';
export * from './lib/version-label';
export * from './lib/sanitize';
export * from './lib/validate';
