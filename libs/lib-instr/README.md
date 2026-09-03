# @eightyfourthousand/lib-instr

Feature flag and instrumentation helpers for 84000 applications.

This package contains shared feature-gating and instrumentation utilities used by frontend applications and companion libraries.

## Pinning a flag locally

`next.config.js` proxies `/ingest` to PostHog in every environment, so a local
dev server evaluates flags against the live project. What a checkout does then
depends on remote config that is not visible from the repo, and because a local
browser is anonymous (`person_profiles: 'identified_only'`), a percentage
rollout resolves differently per browser profile.

`NEXT_PUBLIC_FEATURE_FLAG_OVERRIDES` pins flags instead — a comma-separated
list where `flag` forces it on and `flag=false` forces it off:

```sh
NEXT_PUBLIC_FEATURE_FLAG_OVERRIDES="per-passage-docs,show-reader-header=false"
```

An override also bypasses the `apps` payload check, which is the other thing
that silently reports a flag as off: `useFeatureFlagEnabled` compares the
payload's `apps` list against `NEXT_PUBLIC_APPLICATION_NAME`, and a local
`.env.local` does not always carry the name the flag was scoped to.

Ignored in production builds. A flag that cannot be turned off from PostHog is
not a feature flag, so a stale value in a deployed environment must not pin one
— which also means previews cannot use this.

## Waiting for flags

`useFeatureFlagEnabled` reports false both for a flag that is off and for one
whose value has not arrived yet, so a caller that renders the un-flagged path
on the difference builds it and throws it away a moment later.
`useFeatureFlagsReady` tells the two apart.

It reports ready immediately when PostHog is not configured, and after a short
timeout when it is configured but silent — an ad blocker stops the flags
arriving at all, and a caller holding a skeleton until they do would hold it
for good.

## Running unit tests

Run `nx test lib-instr` to execute the unit tests via [Jest](https://jestjs.io).
