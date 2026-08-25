import {
  createMcpHandler,
  createReadTools,
  joinInstructions,
  readToolInstructions,
} from '@eightyfourthousand/lib-agent';
import { createAnonServerClient } from '@eightyfourthousand/data-access/ssr';

const client = createAnonServerClient();
const handler = createMcpHandler({
  description:
    'Read-only access to the 84000 library of Tibetan Buddhist texts translated into modern languages.',
  instructions: joinInstructions([
    'This server provides read-only access to the 84000 translation library — a long-term initiative to translate the Tibetan Buddhist canon (Kangyur and Tengyur) into modern languages.',
    readToolInstructions({
      translations:
        'published translations of canonical Tibetan texts, each containing structured passages (title pages, homage, body, colophon, notes, etc.)',
    }),
  ]),
  tools: createReadTools(client),
});

export const GET = handler.GET;
export const POST = handler.POST;
export const DELETE = handler.DELETE;
