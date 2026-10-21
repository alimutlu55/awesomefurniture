import { defineConfig } from 'vite';
import { designImageDev } from './scripts/design-image-dev.ts';

export default defineConfig({
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
});
