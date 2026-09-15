/**
 * Probes for a local Supabase stack before the test framework starts.
 *
 * This exists so the convergence suite can use `describe.skip` rather than
 * early-returning from each test body. The distinction matters more than it
 * looks: an early return reports as *passed*, so a run with no stack prints
 * eleven green ticks for the spike's primary gate and no assertion behind any
 * of them. Jest needs the decision synchronously at `describe` time, and a TCP
 * probe is async, so it happens here and lands in an env var.
 */

import { localStackAvailable } from './local-stack';

export const LOCAL_STACK_ENV = 'DEV707_LOCAL_STACK';

export default async function globalSetup(): Promise<void> {
  process.env[LOCAL_STACK_ENV] = (await localStackAvailable()) ? '1' : '0';
}
