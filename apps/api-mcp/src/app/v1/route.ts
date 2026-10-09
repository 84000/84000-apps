import {
  createMcpHandler,
  createReadTools,
  publicInstructions,
} from '@eightyfourthousand/lib-agent';
import { createAnonServerClient } from '@eightyfourthousand/data-access/ssr';

const client = createAnonServerClient();
const handler = createMcpHandler({
  description:
    'Read-only access to the 84000 library of Tibetan Buddhist texts translated into modern languages.',
  instructions: publicInstructions,
  tools: createReadTools(client),
});

export const GET = handler.GET;
export const POST = handler.POST;
export const DELETE = handler.DELETE;
