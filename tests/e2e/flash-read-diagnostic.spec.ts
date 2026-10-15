import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

interface DiagnosticTestState {
  requestCount: number;
  runCount: number;
  closeCount: number;
  abortSeen: boolean;
  runDeferred: boolean;
  failRuns: number[];
  configs: unknown[];
  selectPort?: () => void;
  finishRun?: () => void;
}
declare global { interface Window { __diagnosticTest: DiagnosticTestState } }

// UI ownership/lifecycle only. Fresh ROM/stub hardware is covered separately.
async function mockDiagnostic(page: Page, options: { chooserDeferred?: boolean; runDeferred?: boolean; failRuns?: number[]; locale?: string } = {}) {
  await page.addInitScript(({ chooserDeferred, runDeferred, failRuns, locale }) => {
    window.localStorage.setItem('espconnect-language', locale ?? 'en');
    const state: DiagnosticTestState = { requestCount: 0, runCount: 0, closeCount: 0, abortSeen: false,
      runDeferred: Boolean(runDeferred), failRuns: failRuns ?? [], configs: [] };
    window.__diagnosticTest = state;
    const port = { getInfo: () => ({ usbVendorId: 0x303a, usbProductId: 0x1001 }) };
    Object.defineProperty(navigator, 'serial', { configurable: true, value: {
      requestPort() {
        state.requestCount++;
        return chooserDeferred ? new Promise(resolve => { state.selectPort = () => resolve(port); }) : Promise.resolve(port);
      },
    } });
  }, options);
  await page.route('**/src/services/chunkReadDiagnostic.ts*', route => route.fulfill({
    contentType: 'application/javascript',
    body: `export function clearFlashReadLocalEvidence() {}
      export function getFlashReadLocalAnalysis() { return undefined; }
      export function runFlashReadTrial(port, config, options) {
        const state = window.__diagnosticTest;
        const runNumber = ++state.runCount;
        state.configs.push(config);
        return new Promise(resolve => {
          const abort = () => { state.abortSeen = true; };
          options.signal.addEventListener('abort', abort, { once: true });
          const finish = () => {
            options.signal.removeEventListener('abort', abort);
            state.closeCount++;
            const status = options.signal.aborted ? 'cancelled' : state.failRuns.includes(runNumber) ? 'failed' : 'passed';
            const evidence = { status, config, stage: 'settled', startedAt: new Date().toISOString(), elapsedMs: 100, romSyncVerified: true,
              read: { stage: status === 'passed' ? 'verified' : 'data', received: status === 'passed' ? config.size : 0,
                packets: status === 'passed' ? config.size / config.packetSize : 0, elapsedMs: 10,
                md5: status === 'passed' ? '0123456789abcdef0123456789abcdef' : undefined, acknowledgments: [] },
              failure: status === 'failed' ? 'invalid-data-length' : undefined,
              cleanup: { closed: true, errors: [] } };
            options.onEvidence?.(evidence);
            resolve(evidence);
          };
          if (state.runDeferred) state.finishRun = finish;
          else finish();
        });
      }`,
  }));
}
async function report(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByTestId('diagnostic-save').click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^espconnect-flash-read-suite-.*\.json$/);
  const path = await download.path();
  return JSON.parse(await readFile(path!, 'utf8'));
}

test('opt-in route is isolated, shows compact plan and a realistic provisional budget', async ({ page }, testInfo) => {
  await mockDiagnostic(page);
  const loaded: string[] = [];
  page.on('request', request => loaded.push(request.url()));
  await page.goto('/?flashReadDiagnostic=1');
  await expect(page.getByTestId('diagnostic-start')).toBeVisible();
  await expect(page.getByTestId('connect-btn')).toHaveCount(0);
  expect(loaded.some(url => /\/src\/App\.vue(?:\?|$)/.test(url))).toBe(false);
  await expect(page.getByTestId('diagnostic-save')).toBeDisabled();
  await expect(page.getByTestId('diagnostic-progress')).toContainText('15 total');
  await expect(page.getByText(/15 trials, 110 KiB/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('diagnostic-ready.png'), fullPage: true });
});

test('normal route loads its normal app without the suite runner or hardware engine', async ({ page }) => {
  await mockDiagnostic(page);
  const loaded: string[] = [];
  page.on('request', request => loaded.push(request.url()));
  await page.goto('/?e2e=1');
  await expect(page.getByTestId('connect-btn')).toBeVisible();
  await expect(page.getByTestId('diagnostic-start')).toHaveCount(0);
  expect(loaded.some(url => /\/src\/(FlashReadDiagnostic\.vue|services\/(flashReadSuite|chunkReadDiagnostic)\.ts)(?:\?|$)/.test(url))).toBe(false);
});

test('cancelling a pending chooser locks repeated start and a late port never opens', async ({ page }) => {
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
  await expect(page.getByTestId('diagnostic-save')).toBeEnabled();
});

test('cancel waits for cleanup and explicit reconnect before continuing with next pending trial', async ({ page }, testInfo) => {
  await mockDiagnostic(page, { runDeferred: true });
  await page.goto('/?flashReadDiagnostic=1');
  const start = page.getByTestId('diagnostic-start');
  await start.click();
  await expect(page.getByTestId('diagnostic-status')).toContainText('Diagnostic running');
  await expect(page.getByTestId('diagnostic-save')).toBeEnabled();
  await page.getByTestId('diagnostic-cancel').click();
  await expect(start).toBeDisabled();
  expect(await page.evaluate(() => window.__diagnosticTest.abortSeen)).toBe(true);
  expect(await page.evaluate(() => window.__diagnosticTest.closeCount)).toBe(0);
  await page.evaluate(() => window.__diagnosticTest.finishRun?.());
  await expect(page.getByTestId('diagnostic-recovery')).toBeVisible();
  await expect(start).toBeDisabled();
  expect(await page.evaluate(() => window.__diagnosticTest.runCount)).toBe(1);
  await page.screenshot({ path: testInfo.outputPath('diagnostic-recovery.png'), fullPage: true });
  await page.getByTestId('diagnostic-recovery-confirm').getByRole('checkbox').check();
  await expect(start).toBeEnabled();
  await page.evaluate(() => { window.__diagnosticTest.runDeferred = false; });
  await start.click();
  await expect(page.getByTestId('diagnostic-status')).toContainText('Suite finished');
  expect(await page.evaluate(() => window.__diagnosticTest.requestCount)).toBe(2);
  expect(await page.evaluate(() => window.__diagnosticTest.runCount)).toBe(15);
  const saved = await report(page);
  expect(saved.summary.counts.cancelled).toBe(1);
  expect(saved.summary.counts.passed).toBe(14);
  expect(saved.summary.allPassed).toBe(false);
});

test('failed recovery pauses again and preserves first failure in the partial report', async ({ page }) => {
  await mockDiagnostic(page, { failRuns: [1, 2] });
  await page.goto('/?flashReadDiagnostic=1');
  await page.getByTestId('diagnostic-start').click();
  await expect(page.getByTestId('diagnostic-recovery')).toBeVisible();
  await page.getByTestId('diagnostic-recovery-confirm').getByRole('checkbox').check();
  await page.getByTestId('diagnostic-start').click();
  await expect(page.getByTestId('diagnostic-start')).toBeDisabled();
  expect(await page.evaluate(() => window.__diagnosticTest.runCount)).toBe(2);
  const saved = await report(page);
  expect(saved.firstFailureId).toBe('target-alone-1');
  expect(saved.trials[0].status).toBe('failed');
  expect(saved.trials[1].status).toBe('failed');
  expect(saved.summary.counts.pending).toBe(13);
  expect(saved.recoveryCount).toBe(1);
});

test('metadata checkpoint survives reload, keeps partial results and requires recovery', async ({ page }) => {
  await mockDiagnostic(page, { failRuns: [1] });
  await page.goto('/?flashReadDiagnostic=1');
  await page.getByTestId('diagnostic-start').click();
  await expect(page.getByTestId('diagnostic-recovery')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('diagnostic-restored')).toBeVisible();
  await expect(page.getByTestId('diagnostic-start')).toBeDisabled();
  await expect(page.getByTestId('diagnostic-trial-target-alone-1')).toContainText('Failed');
  const saved = await report(page);
  expect(saved.firstFailureId).toBe('target-alone-1');
  expect(saved.summary.counts.failed).toBe(1);
  expect(saved.summary.complete).toBe(false);
  expect(await page.evaluate(() => window.__diagnosticTest.runCount)).toBe(0);
});

test('skips are explicit, complete reports are local JSON and reset starts a new suite', async ({ page }) => {
  await mockDiagnostic(page, { locale: 'fr' });
  await page.goto('/?flashReadDiagnostic=1');
  await expect(page.getByTestId('diagnostic-start')).toHaveText('Choose port and begin suite');
  await page.getByTestId('diagnostic-skip').click();
  await expect(page.getByTestId('diagnostic-trial-target-alone-1')).toContainText('Skipped (not a success)');
  await page.getByTestId('diagnostic-start').click();
  await expect(page.getByTestId('diagnostic-status')).toContainText('Suite finished');
  const saved = await report(page);
  expect(saved.summary.counts.skipped).toBe(1);
  expect(saved.summary.counts.passed).toBe(14);
  expect(saved.summary.allPassed).toBe(false);
  expect(saved.summary.complete).toBe(true);
  expect(saved.environment.usbVendorId).toBe(0x303a);
  expect(JSON.stringify(saved)).not.toMatch(/rawBytes|decodedBytes|serialNumber/);
  await page.getByTestId('diagnostic-reset').click();
  await expect(page.getByTestId('diagnostic-start')).toHaveText('Choose port and begin suite');
  await expect(page.getByTestId('diagnostic-save')).toBeDisabled();
  expect(await page.evaluate(() => sessionStorage.getItem('espconnect-flash-read-suite-v2'))).toBeNull();
});

test('partial report is downloadable before a running trial settles', async ({ page }) => {
  await mockDiagnostic(page, { runDeferred: true });
  await page.goto('/?flashReadDiagnostic=1');
  await page.getByTestId('diagnostic-start').click();
  await expect(page.getByTestId('diagnostic-save')).toBeEnabled();
  const saved = await report(page);
  expect(saved.summary.counts.running).toBe(1);
  expect(saved.summary.complete).toBe(false);
  await page.getByTestId('diagnostic-cancel').click();
  await page.evaluate(() => window.__diagnosticTest.finishRun?.());
  await expect(page.getByTestId('diagnostic-recovery')).toBeVisible();
});
