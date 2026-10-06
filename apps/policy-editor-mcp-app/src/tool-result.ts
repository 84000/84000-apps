/**
 * The part of the ext-apps `App` that calls server tools through the host.
 * Structural, so specs can pass a fake.
 */
export interface ToolCaller {
  callServerTool(params: {
    name: string;
    arguments?: Record<string, unknown>;
  }): Promise<unknown>;
}

/** A tool result's JSON body, or why it could not be read. */
export type ParsedToolResult =
  | { ok: true; isError: boolean; body: Record<string, unknown> }
  | { ok: false; text?: string };

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads the JSON object in a tool result's first text content block.
 * `structuredContent` is ignored on purpose: some hosts strip it before the app
 * sees it, so `content` is the only field every host delivers.
 */
export function parseToolResult(result: unknown): ParsedToolResult {
  if (!isRecord(result) || !Array.isArray(result.content)) return { ok: false };
  const block = result.content.find(
    (item): item is { text: string } =>
      isRecord(item) && item.type === 'text' && typeof item.text === 'string',
  );
  if (!block) return { ok: false };

  try {
    const body: unknown = JSON.parse(block.text);
    if (isRecord(body)) {
      return { ok: true, isError: result.isError === true, body };
    }
  } catch {
    // Not JSON; fall through.
  }
  return { ok: false, text: block.text };
}
