import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Unit tests only (AM3): the riskiest code in Task A is pure logic -- the
 * scheduler's cap/FIFO/priority rules, the job reducer, the SSE-to-phase
 * mapping, and the guarantee that one project's results never touch another.
 * "Build + lint + a manual click-through" cannot cover those.
 *
 * No jsdom and no component testing on purpose: UI is verified in the dev
 * gallery and the browser, per the plan.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
