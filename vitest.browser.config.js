import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.browser.test.js'],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }]
    }
  }
});
