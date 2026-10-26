import { defineConfig, loadEnv } from 'vite';
import { designImageDev } from './scripts/design-image-dev.ts';
import { PRODUCTION_SUPABASE_PROJECT } from './src/infrastructure/supabase/project-config.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const logLevel = process.env.LOG_LEVEL ?? env.LOG_LEVEL ?? '';
  const productionProject = process.env.WORKERS_CI_BRANCH === 'main'
    && !env.VITE_SUPABASE_URL && !env.VITE_SUPABASE_PUBLISHABLE_KEY
    ? PRODUCTION_SUPABASE_PROJECT : null;
  return {
    // The same LOG_LEVEL controls server payload logs at runtime and this debug-only UI at build time.
    define: {
      __LOG_LEVEL__: JSON.stringify(logLevel),
      ...(productionProject ? {
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(productionProject.url),
        'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(productionProject.publishableKey),
      } : {}),
    },
    plugins: [designImageDev()],
    build: {
      rolldownOptions: {
        input: {
          main: 'index.html',
          editor: 'editor.html',
          examples: 'examples/multiple-editors.html',
        },
      },
    },
  };
});
