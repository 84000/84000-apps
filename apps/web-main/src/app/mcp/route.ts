import { after } from 'next/server';
import {
  MCP_CORS_HEADERS,
  corsPreflightResponse,
  createFeedbackTools,
  createMcpHandler,
  createHarnessTools,
  createOpenPolicyEditorTool,
  createProfileTools,
  createPolicyEditorResource,
  createReadTools,
  createSessionTools,
  createWriteTools,
  hasRole,
  linearFeedbackConfigFromEnv,
  onboardingCheck,
  studioInstructions,
  validateBearerToken,
  withCorsHeaders,
  withInstrumentation,
  withOnboardingNote,
} from '@eightyfourthousand/lib-agent';
import { createServerCapture } from '@eightyfourthousand/lib-instr/ssr';
// The app's build output, a generated HTML string, not its source; `build` and
// `dev` depend on `policy-editor-mcp-app:build` to generate it. `dev` builds it
// once and does not watch it: rerun `nx run policy-editor-mcp-app:build` after
// editing the app.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { POLICY_EDITOR_APP_HTML } from '@eightyfourthousand/policy-editor-mcp-app/html';

const description =
  'Authenticated access to the 84000 translation studio — reading, glossary, bibliography, and entity tools scoped to the current user.';

/**
 * Runs `flush` once the response is sent, so the function stays alive until
 * the events have left without the caller waiting on them. Outside a request
 * scope `after` throws; the flush then just runs unawaited.
 */
function flushAfterResponse(flush: () => Promise<void>) {
  try {
    after(flush);
  } catch {
    void flush();
  }
}

export async function OPTIONS() {
  return corsPreflightResponse();
}

export async function GET() {
  return new Response('Method not allowed', {
    status: 405,
    headers: MCP_CORS_HEADERS,
  });
}

export async function POST(req: Request) {
  const auth = await validateBearerToken(req);
  if (!auth.ok) {
    return auth.response;
  }

  // Read tools are always available. Write tools are listed only for editor+
  // roles; each write handler still performs its own `hasPermission` check as
  // the authoritative gate.
  //
  // Policy, session, feedback and profile tools are listed for everyone, because their audience
  // does not follow the role hierarchy: translators author policy and drive the
  // sessions, and managers read policy though they rank below translators.
  // Their `harness.*` checks decide. `open-policy-editor` is listed with
  // them, and with the editor app's resource it links to. The profile tools
  // need no permission: they read and tag only the caller's own profile.
  const tools = [
    ...createReadTools(auth.client),
    ...createHarnessTools(auth.client),
    createOpenPolicyEditorTool(auth.client),
    ...createSessionTools(auth.client, auth.userId),
    ...createFeedbackTools({
      client: auth.client,
      submitter: { userId: auth.userId, email: auth.email },
      linear: linearFeedbackConfigFromEnv(),
    }),
    ...createProfileTools(auth.client, auth.userId),
    ...(hasRole(auth.role, 'editor') ? createWriteTools(auth.client) : []),
  ];
  // Report each call to PostHog, keyed by the user's uuid. Innermost, so the
  // duration is the tool's own and not the onboarding lookup's. The wrapper
  // never alters a result or an error, and `after` below flushes the events
  // once the response is on its way, so analytics never delays a tool call.
  const analytics = createServerCapture();
  const instrumentedTools = withInstrumentation(tools, {
    emit: analytics.capture,
    distinctId: auth.userId,
    properties: {
      server: 'studio',
      role: auth.role,
      app: process.env.NEXT_PUBLIC_APPLICATION_NAME ?? null,
    },
  });
  // Until an internal user (manager and above) is onboarded, tool results
  // carry a short note offering onboarding. Scholars and readers are not
  // internal users and are never prompted. The tag is read lazily, once per
  // request.
  const servedTools = hasRole(auth.role, 'manager')
    ? withOnboardingNote(
        instrumentedTools,
        onboardingCheck(auth.client, auth.userId),
      )
    : instrumentedTools;
  const handler = createMcpHandler({
    description,
    instructions: studioInstructions,
    tools: servedTools,
    resources: [createPolicyEditorResource(POLICY_EDITOR_APP_HTML)],
  });
  try {
    return withCorsHeaders(await handler.POST(req));
  } finally {
    flushAfterResponse(analytics.flush);
  }
}

export async function DELETE() {
  return new Response('Method not allowed', {
    status: 405,
    headers: MCP_CORS_HEADERS,
  });
}
