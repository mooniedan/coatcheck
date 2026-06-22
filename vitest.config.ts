import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['{lib,app,components}/**/*.test.ts'],
    alias: {
      // Neutralize the `server-only` import guard so server modules are testable in node.
      'server-only': fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)),
    },
  },
});
