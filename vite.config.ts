import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
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
