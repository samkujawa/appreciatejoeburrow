import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { parseHeadersFile } from './scripts/headers.ts';

// `npm run preview` serves the same security headers as production, so CSP problems
// show up locally instead of after a deploy.
const productionHeaders = parseHeadersFile(readFileSync('public/_headers', 'utf8'))['/*'];

export default defineConfig({
  build: {
    target: 'es2022',
    // Pages: the wall, stats and the 404 page. check.html is dev-only and deliberately left out.
    rollupOptions: {
      input: {
        main: 'index.html',
        stats: 'stats.html',
        notFound: '404.html',
      },
    },
  },
  server: {
    // The Appreciate counter lives in the Worker. Run `npm run worker:dev` alongside `npm run dev`
    // to use it locally; without it the count just stays hidden.
    proxy: { '/api': 'http://localhost:8787' },
  },
  preview: {
    headers: productionHeaders ?? {},
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
