import { authCallback } from '@lib-user/ssr';

export async function GET(request: Request) {
  return await authCallback(request);
}
