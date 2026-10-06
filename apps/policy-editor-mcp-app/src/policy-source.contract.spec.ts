import type * as DataAccess from '@eightyfourthousand/data-access';
import type * as Contract from './policy-source.contract';

/** `true` only when each type is assignable to the other. */
type MutuallyAssignable<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;

// Enforced by `nx typecheck`, not by jest: a drift between the mirror and the
// data-access types makes one of these `false`, which fails to compile.
const checks: [
  MutuallyAssignable<Contract.PolicyVersion, DataAccess.PolicyVersion>,
  MutuallyAssignable<Contract.PolicyDocument, DataAccess.PolicyDocument>,
  MutuallyAssignable<Contract.PolicyRevision, DataAccess.PolicyRevision>,
  MutuallyAssignable<Contract.PolicyFailure, DataAccess.PolicyFailure>,
  MutuallyAssignable<Contract.PolicyWriteResult, DataAccess.PolicyWriteResult>,
] = [true, true, true, true, true];

describe('policy-source contract mirror', () => {
  it('matches the data-access policy types', () => {
    expect(checks.every(Boolean)).toBe(true);
  });
});
