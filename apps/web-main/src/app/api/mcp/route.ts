import { createMcpHandler, createReadTools } from '@eightyfourthousand/lib-agent';
import { createServerClient } from '@eightyfourthousand/data-access/ssr';

export async function GET() {
  return new Response('Method not allowed', { status: 405 });
}

export async function POST(req: Request) {
  const client = await createServerClient();
  const { POST } = createMcpHandler({ tools: createReadTools(client) });
  return POST(req);
}

export async function DELETE() {
  return new Response('Method not allowed', { status: 405 });
}
