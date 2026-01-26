import type { NextRequest } from 'next/server';

export interface GraphQLContext {
  req: NextRequest;
}

export async function createContext(req: NextRequest): Promise<GraphQLContext> {
  return {
    req,
  };
}
