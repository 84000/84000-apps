import type * as DataAccess from '@eightyfourthousand/data-access';
import type * as Contract from '@eightyfourthousand/lib-editing/policy-editor';

/** `true` only when each type is assignable to the other. */
type MutuallyAssignable<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;

// Enforced by `nx typecheck`, not by jest: the adapter turns data-access
// results (through the policy tools) into the editor's contract, so a drift
// between the two makes one of these `false`, which fails to compile.
const checks: [
  MutuallyAssignable<Contract.PolicyVersion, DataAccess.PolicyVersion>,
  MutuallyAssignable<Contract.PolicyDocument, DataAccess.PolicyDocument>,
  MutuallyAssignable<Contract.PolicyRevision, DataAccess.PolicyRevision>,
  MutuallyAssignable<Contract.PolicyFailure, DataAccess.PolicyFailure>,
  MutuallyAssignable<Contract.PolicyWriteResult, DataAccess.PolicyWriteResult>,
] = [true, true, true, true, true];

describe('PolicySource contract', () => {
  it('matches the data-access policy types', () => {
    expect(checks.every(Boolean)).toBe(true);
  });
});
