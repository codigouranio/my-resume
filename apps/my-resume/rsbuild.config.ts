import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginReact()],
  output: {
    sourceMap: {
      js: 'source-map',
      css: true,
    },
  },
  tools: {
    postcss: {
      postcssOptions: {
        plugins: ['tailwindcss', 'autoprefixer'],
      },
    },
  },
});
