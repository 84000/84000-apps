import { z } from 'zod';

export const AgentDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  systemPrompt: z.string().min(1),
  tools: z.array(z.string().min(1)),
  requiredRole: z.enum([
    'reader',
    'scholar',
    'translator',
    'editor',
    'admin',
  ]),
  model: z.string().optional(),
});

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
