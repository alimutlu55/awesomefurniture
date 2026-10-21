import { handleDesignImage, type ImageServiceEnvironment } from '../infrastructure/gemini/design-image-handler';

interface Environment extends ImageServiceEnvironment { ASSETS: { fetch(request: Request): Promise<Response> } }
export default {
  async fetch(request: Request, env: Environment): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/api/design-images') return handleDesignImage(request, env);
    if (path.startsWith('/api/')) return Response.json({ error: { code: 'NOT_FOUND', message: 'Unknown API endpoint.' } }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
