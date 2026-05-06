import { createMcpHandler, createReadTools } from '@eightyfourthousand/lib-agent';
import { createAnonServerClient } from '@eightyfourthousand/data-access/ssr';

const client = createAnonServerClient();
const handler = createMcpHandler({ tools: createReadTools(client) });

export const GET = handler.GET;
export const POST = handler.POST;
export const DELETE = handler.DELETE;
