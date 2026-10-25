import { handleApi, sweepCredits, type ApiEnvironment } from './api-router';

interface Environment extends ApiEnvironment { ASSETS: { fetch(request: Request): Promise<Response> } }
export default {
  async fetch(request: Request, env: Environment): Promise<Response> {
    return await handleApi(request, env) ?? env.ASSETS.fetch(request);
  },
  async scheduled(_controller: unknown, env: Environment, context: { waitUntil(promise: Promise<unknown>): void }) {
    context.waitUntil(sweepCredits(env));
  },
};
