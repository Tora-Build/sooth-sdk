import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '../.metamask/extension');

console.log('Extension path:', extensionPath);

async function main() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  console.log('Browser launched, waiting for pages...');
  
  // Wait a bit for extension to initialize
  await new Promise(r => setTimeout(r, 5000));
  
  const pages = context.pages();
  console.log('Pages:', pages.length);
  for (const p of pages) {
    console.log(' -', await p.url());
  }

  // Check background pages
  const backgroundPages = context.backgroundPages();
  console.log('Background pages:', backgroundPages.length);
  
  // Check service workers
  const serviceWorkers = context.serviceWorkers();
  console.log('Service workers:', serviceWorkers.length);

  await context.close();
  console.log('Done');
}

main().catch(console.error);

