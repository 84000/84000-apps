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

**Do not edit `NEXT_PUBLIC_APPLICATION_NAME` to turn a flag on.** It is not a
per-flag lever — it is the identity every `apps` payload is matched against, so
renaming the app to reach one flag silently turns off every other flag scoped
to the old name. That is what the override is for.

Ignored in production builds. A flag that cannot be turned off from PostHog is
not a feature flag, so a stale value in a deployed environment must not pin one.

That excludes Vercel previews, which build as production — deliberately, since
they have a real flag source: previews evaluate against the **sandbox** PostHog
project. Scope a flag there for every app that will exercise it, not just the
one you are testing from, or it reads as off in the others.

## Static flags

Not everything belongs in PostHog. `isStaticFeatureEnabled`, from
`@eightyfourthousand/lib-instr/static`, resolves a flag from
`NEXT_PUBLIC_APPLICATION_NAME` alone — no network call, and a value during SSR,
which PostHog cannot give.

Use it when a feature must not be able to fail off. A PostHog flag reads as off
when the flags do not arrive, and an ad blocker or Firefox's tracking
protection stops them arriving; that is acceptable for a rollout and not for a
notice the reader is entitled to see.

Each static flag names either the apps it applies to (`apps`) or the apps it
does not (`exceptApps`). The difference only shows when an app leaves
`NEXT_PUBLIC_APPLICATION_NAME` unset or misspells it: an allow list is then off
and a deny list is on. Choose whichever of those two is the harmless one.

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
