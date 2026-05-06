# web-reader — Public Translation Reader

Public-facing reader for published translations. Minimal authentication (optional sign-in for library features).

## Route Structure

- `/[slug]` — primary reading route with parallel routes (`@left`, `@main`, `@right`) for side-by-side layout
- `/entity/[type]/[slug]` — glossary terms, authorities, and other entity detail pages
- `/translation/[slug]` — translation-specific route
- `/api/feedback` — user feedback endpoint
- `/api/mcp` — Model Context Protocol endpoint for AI tool access

## Layout

Simple fixed-position container with overflow scrolling. No dashboard layout or complex provider stack — intentionally lightweight compared to `web-main`.
