import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

const server = await createServer({
  server: { host: '127.0.0.1', port: 4173 },
  logLevel: 'error'
});

let browser;

try {
  await server.listen();
  const axeSource = await readFile(axePath, 'utf8');
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () => axe.run(document, {
    rules: {
      'color-contrast': { enabled: true }
    }
  }));

  if (results.violations.length) {
    console.error('Accessibility violations found:');
    for (const violation of results.violations) {
      console.error(`\n${violation.id}: ${violation.help}`);
      for (const node of violation.nodes) {
        console.error(`- ${node.target.join(', ')}: ${node.failureSummary?.replace(/\s+/g, ' ').trim()}`);
      }
    }
    process.exitCode = 1;
  } else {
    console.log('Accessibility audit passed.');
  }
} finally {
  await browser?.close();
  await server.close();
}
