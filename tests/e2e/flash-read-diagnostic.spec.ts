import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

interface DiagnosticTestState {
  requestCount: number;
  runCount: number;
  closeCount: number;
  abortSeen: boolean;
  lastScenario?: string;
  selectPort?: () => void;
  finishRun?: () => void;
}

declare global {
  interface Window {
    __diagnosticTest: DiagnosticTestState;
  }
}

// These tests exercise only UI ownership and lifecycle; no ESP device is involved.
async function mockDiagnostic(page: Page, options: { chooserDeferred?: boolean; runDeferred?: boolean; locale?: string } = {}) {
  await page.addInitScript(({ chooserDeferred, runDeferred, locale }) => {
    window.localStorage.setItem('espconnect-language', locale ?? 'en');
    const state = { requestCount: 0, runCount: 0, closeCount: 0, abortSeen: false, runDeferred };
    window.__diagnosticTest = state;
    const port = { getInfo: () => ({ usbVendorId: 1234, usbProductId: 5678 }) };
    Object.defineProperty(navigator, 'serial', {
      configurable: true,
      value: {
        requestPort() {
          state.requestCount += 1;
          return chooserDeferred
            ? new Promise((resolve) => { window.__diagnosticTest.selectPort = () => resolve(port); })
            : Promise.resolve(port);
        },
      },
    });
  }, options);
  await page.route('**/src/services/chunkReadDiagnostic.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export function runChunkReadDiagnostic(port, scenario, options) {
      const state = window.__diagnosticTest;
      state.runCount += 1;
      state.lastScenario = scenario;
      return new Promise((resolve, reject) => {
        const abort = () => { state.abortSeen = true; };
        options.signal.addEventListener('abort', abort, { once: true });
        const finish = () => {
          options.signal.removeEventListener('abort', abort);
          state.closeCount += 1;
          options.log('Mock receive diagnostics: session closed.');
          if (options.signal.aborted) reject(new DOMException('Diagnostic cancelled.', 'AbortError'));
          else resolve({ scenario, reads: [{ address: 32768, size: 1024, md5: '0123456789abcdef0123456789abcdef' }] });
        };
        if (state.runDeferred) state.finishRun = finish;
        else finish();
      });
    }`,
  }));
}

test('diagnostic route loads its root without importing the normal app', async ({ page }) => {
  await mockDiagnostic(page);
  const loaded: string[] = [];
  page.on('request', (request) => loaded.push(request.url()));
  await page.goto('/?flashReadDiagnostic=1');
  await expect(page.getByTestId('diagnostic-start')).toBeVisible();
  await expect(page.getByTestId('connect-btn')).toHaveCount(0);
  expect(loaded.some((url) => /\/src\/App\.vue(?:\?|$)/.test(url))).toBe(false);
  await expect(page.getByTestId('diagnostic-save')).toBeDisabled();
});

test('normal route still loads the normal app only', async ({ page }) => {
  await mockDiagnostic(page);
  const loaded: string[] = [];
  page.on('request', (request) => loaded.push(request.url()));
  await page.goto('/?e2e=1');
  await expect(page.getByTestId('connect-btn')).toBeVisible();
  await expect(page.getByTestId('diagnostic-start')).toHaveCount(0);
  expect(loaded.some((url) => /\/src\/FlashReadDiagnostic\.vue(?:\?|$)/.test(url))).toBe(false);
});

test('cancelling a pending chooser prevents a late port from starting a session', async ({ page }) => {
  await mockDiagnostic(page, { chooserDeferred: true });
  await page.goto('/?flashReadDiagnostic=1');
  const start = page.getByTestId('diagnostic-start');
  await start.click();
  await expect(start).toBeDisabled();
  await page.getByTestId('diagnostic-cancel').click();
  await expect(start).toBeDisabled();
  await expect(page.getByTestId('diagnostic-cancel')).toBeDisabled();
  await expect(page.getByTestId('diagnostic-status')).toContainText('Cancelling');
  await page.evaluate(() => window.__diagnosticTest.selectPort?.());
  await expect(start).toBeEnabled();
  expect(await page.evaluate(() => window.__diagnosticTest.runCount)).toBe(0);
  await expect(page.getByTestId('diagnostic-log')).toContainText('no session was opened');
  await start.click();
  expect(await page.evaluate(() => window.__diagnosticTest.requestCount)).toBe(2);
  await page.getByTestId('diagnostic-cancel').click();
  await page.evaluate(() => window.__diagnosticTest.selectPort?.());
});

test('cancel keeps a run locked until owned session cleanup settles', async ({ page }) => {
  await mockDiagnostic(page, { runDeferred: true });
  await page.goto('/?flashReadDiagnostic=1');
  const start = page.getByTestId('diagnostic-start');
  await start.click();
  await expect(page.getByTestId('diagnostic-status')).toContainText('Diagnostic running');
  await page.getByTestId('diagnostic-cancel').click();
  await expect(start).toBeDisabled();
  await expect(page.getByTestId('diagnostic-save')).toBeDisabled();
  expect(await page.evaluate(() => window.__diagnosticTest.abortSeen)).toBe(true);
  expect(await page.evaluate(() => window.__diagnosticTest.closeCount)).toBe(0);
  await page.evaluate(() => window.__diagnosticTest.finishRun?.());
  await expect(start).toBeEnabled();
  expect(await page.evaluate(() => window.__diagnosticTest.closeCount)).toBe(1);
  await start.click();
  expect(await page.evaluate(() => window.__diagnosticTest.runCount)).toBe(2);
  await page.getByTestId('diagnostic-cancel').click();
  await page.evaluate(() => window.__diagnosticTest.finishRun?.());
  await expect(start).toBeEnabled();
});

test('selected scenario creates a local English text report after settlement', async ({ page }) => {
  await mockDiagnostic(page, { locale: 'fr' });
  await page.goto('/?flashReadDiagnostic=1');
  await expect(page.getByTestId('diagnostic-start')).toContainText('Choisir le port');
  await page.getByTestId('diagnostic-scenario').click();
  await page.getByRole('option', { name: 'C · nouvelle session : lire 64 Ko à 0x810000' }).click();
  await page.getByTestId('diagnostic-start').click();
  await expect(page.getByTestId('diagnostic-save')).toBeEnabled();
  expect(await page.evaluate(() => window.__diagnosticTest.lastScenario)).toBe('C');
  await expect(page.getByTestId('diagnostic-log')).toContainText('Application version:');
  await expect(page.getByTestId('diagnostic-log')).toContainText('MD5=0123456789abcdef0123456789abcdef');
  const downloadEvent = page.waitForEvent('download');
  await page.getByTestId('diagnostic-save').click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^espconnect-preview6-scenario-C-.*\.txt$/);
  const path = await download.path();
  expect(path).not.toBeNull();
  const report = await readFile(path!, 'utf8');
  expect(report).toContain('Run settled: complete.');
  expect(report).toContain('not proof of a hardware fix');
});

test('untranslated locales fall back to English diagnostic labels', async ({ page }) => {
  await mockDiagnostic(page, { locale: 'de' });
  await page.goto('/?flashReadDiagnostic=1');
  await expect(page.getByTestId('diagnostic-start')).toHaveText('Choose port and start');
});
