import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import fs from 'fs';
import path from 'path';

// Read package.json to get version
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, './package.json'), 'utf-8')
);

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginReact()],
  server: {
    port: 3001,
  },
  html: {
    template: './index.html',
  },
  output: {
    sourceMap: {
      js: 'source-map',
      css: true,
    },
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
  },
  tools: {
    postcss: {
      postcssOptions: {
        plugins: ['tailwindcss', 'autoprefixer'],
      },
    },
  },
});
