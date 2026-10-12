import {
  MCP_CORS_HEADERS,
  corsPreflightResponse,
  createFeedbackTools,
  createMcpHandler,
  createHarnessTools,
  createOpenPolicyEditorTool,
  createPolicyEditorResource,
  createReadTools,
  createSessionTools,
  createWriteTools,
  hasRole,
  linearFeedbackConfigFromEnv,
  studioInstructions,
  validateBearerToken,
  withCorsHeaders,
} from '@eightyfourthousand/lib-agent';
// The app's build output, a generated HTML string, not its source; `build` and
// `dev` depend on `policy-editor-mcp-app:build` to generate it. `dev` builds it
// once and does not watch it: rerun `nx run policy-editor-mcp-app:build` after
// editing the app.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { POLICY_EDITOR_APP_HTML } from '@eightyfourthousand/policy-editor-mcp-app/html';

const description =
  'Authenticated access to the 84000 translation studio — reading, glossary, bibliography, and entity tools scoped to the current user.';

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
  // Policy, session and feedback tools are listed for everyone, because their audience
  // does not follow the role hierarchy: translators author policy and drive the
  // sessions, and managers read policy without appearing in ROLE_HIERARCHY at
  // all. Their `harness.*` checks decide. `open-policy-editor` is listed with
  // them, and with the editor app's resource it links to.
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
    ...(hasRole(auth.role, 'editor') ? createWriteTools(auth.client) : []),
  ];
  const handler = createMcpHandler({
    description,
    instructions: studioInstructions,
    tools,
    resources: [createPolicyEditorResource(POLICY_EDITOR_APP_HTML)],
  });
  return withCorsHeaders(await handler.POST(req));
}

export async function DELETE() {
  return new Response('Method not allowed', {
    status: 405,
    headers: MCP_CORS_HEADERS,
  });
}
