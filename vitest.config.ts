// vitest.config.ts
// 2 projets parallèles :
//   - unit      : jsdom, tests/unit/**/*.test.ts(x) + src/**/*.test.ts(x), setup MSW
//   - storybook : run les *.stories.tsx via @storybook/addon-vitest (browser chromium)

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

const dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./tests/unit/setup.ts'],
          include: [
            'tests/unit/**/*.{test,spec}.{ts,tsx}',
            'src/**/*.{test,spec}.{ts,tsx}',
          ],
          exclude: [
            'tests/e2e/**',
            'node_modules/**',
            'dist/**',
            '.storybook/**',
            'src/stories/**',
          ],
          coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            exclude: [
              'node_modules/', 'tests/', 'src/stories/',
              '**/*.stories.{ts,tsx}', '**/*.config.{ts,js}',
            ],
          },
        },
      },
      {
        extends: true,
        plugins: [
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: 'playwright',
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
