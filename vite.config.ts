import { defineConfig, loadEnv } from 'vite';
import { designImageDev } from './scripts/design-image-dev.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const logLevel = process.env.LOG_LEVEL ?? env.LOG_LEVEL ?? '';
  return {
    // The same LOG_LEVEL controls server payload logs at runtime and this debug-only UI at build time.
    define: { __LOG_LEVEL__: JSON.stringify(logLevel) },
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
