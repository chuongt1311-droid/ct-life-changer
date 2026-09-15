import { test, expect } from '@playwright/test';

/** Visual inventory: a shot of every screen, so design work looks at the real
 * thing instead of guessing. Not an assertion suite, and skipped by default so
 * `npm run test:e2e` stays the four real flows.
 *
 *   SHOTS=1 npx playwright test e2e/screens.spec.ts            # iPhone width
 *   SHOTS=1 SHOT_WIDE=1 npx playwright test e2e/screens.spec.ts # desktop
 *   SHOT_DIR=some/dir                                          # where they land
 */

const OUT = process.env.SHOT_DIR ?? 'screenshots';

const SCREENS: { path: string; name: string }[] = [
  { path: '/', name: '01-today' },
  { path: '/card', name: '02-card' },
  { path: '/checkin/morning', name: '03-checkin-morning' },
  { path: '/checkin/evening', name: '04-checkin-evening' },
  { path: '/mentor', name: '05-mentor' },
  { path: '/history', name: '06-history' },
  { path: '/weekly', name: '07-weekly' },
  { path: '/settings', name: '08-settings' },
  { path: '/templates', name: '09-templates' },
  { path: '/reentry', name: '10-reentry' },
  { path: '/day-changed', name: '11-day-changed' },
];

const WIDE = process.env.SHOT_WIDE === '1';

test.use({ viewport: WIDE ? { width: 1280, height: 900 } : { width: 390, height: 844 } });

for (const screen of SCREENS) {
  test(`shot ${screen.name}`, async ({ page }) => {
    test.skip(process.env.SHOTS !== '1', 'visual inventory — run with SHOTS=1');
    await page.goto(screen.path);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${screen.name}.png`, fullPage: true });
    // Viewport-accurate shot too: `position: sticky` renders at its flow position
    // in a fullPage capture, which makes the thumb bar look misplaced when it is not.
    await page.screenshot({ path: `${OUT}/viewport/${screen.name}.png` });
    expect(page.url()).toBeTruthy();
  });
}
