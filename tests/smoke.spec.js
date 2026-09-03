// Kerph smoke suite.
//
// This is deliberately NOT an attempt at coverage. It is a tripwire on the handful of things
// whose breakage would be both silent and expensive: a page that throws on load, a core tool
// that fails to initialise, a calculator that quietly returns the wrong number, the plan gate
// falling open, or the share metadata disappearing.
//
// Nothing here needs credentials. Everything that would require a real account (saving a
// layout, generating a quote) is left out on purpose rather than stubbed — a fake login proves
// nothing about the real one, and adding test credentials to CI is a security decision that
// should be made deliberately, not smuggled in with a test suite.

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Page inventory. Hardcoded rather than globbed from disk so that a page going
// missing is a test failure, not a silently smaller run.
// ---------------------------------------------------------------------------
const PUBLIC_PAGES = [
  'index.html',
  'pricing.html',
  'help.html',
  'terms.html',
  'follow.html',
  'garage-tips.html',
  'tool-catalog.html',
  'shop-showcase.html',
  'find-a-builder.html',
  'print-library.html',
  'cutlist-optimizer.html',
  'workshop-planner.html',
  'shop-jigs.html',
  'shop-jigs-board-feet.html',
  'shop-jigs-add-fractions.html',
  'shop-jigs-fraction-converter.html',
  'shop-jigs-angle-chart.html',
  'shop-jigs-wood-movement.html',
  'shop-jigs-speeds-feeds.html',
  'shop-jigs-sharpening-angles.html',
  'shop-jigs-table-saw-setup.html',
  'shop-jigs-part-finder.html',
];

// Pages behind a plan gate. Loaded with an entitlement set so the page itself is exercised;
// the gate's own behaviour is tested separately in "plan gate" below.
const GATED_PAGES = [
  'project-designer.html',
  'shop-3d-viewer.html',
  'portfolio.html',
  'quote-builder.html',
];

// Console noise that says nothing about whether the page works. Kept deliberately short —
// every entry here is a class of failure the suite can no longer see, so the bar for adding
// one is "this is provably unrelated to Kerph's own code".
const IGNORED_CONSOLE = [
  /favicon/i,
  /net::ERR_INTERNET_DISCONNECTED/,
  // The static file server used in CI has no directory index for paths the app never requests.
  /Failed to load resource: the server responded with a status of 404 \(File not found\)/,
];

function watchForErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    errors.push(`console: ${text}`);
  });
  page.on('pageerror', (err) => errors.push(`uncaught: ${err.message}`));
  return errors;
}

// Grants an entitlement before any page script runs, so gated pages render instead of
// redirecting. Mirrors how the gate reads localStorage at parse time.
async function grantPlan(page, plan = 'premier') {
  await page.addInitScript((p) => {
    try { window.localStorage.setItem('kerphPlan', p); } catch (e) { /* private mode */ }
  }, plan);
}

// ---------------------------------------------------------------------------
// 1. Every public page loads without throwing.
// ---------------------------------------------------------------------------
test.describe('pages load clean', () => {
  for (const path of [...PUBLIC_PAGES, ...GATED_PAGES]) {
    test(`${path} loads with no console or page errors`, async ({ page }) => {
      const errors = watchForErrors(page);
      await grantPlan(page);

      const response = await page.goto(`/${path}`, { waitUntil: 'load' });
      expect(response, `no response for ${path}`).toBeTruthy();
      expect(response.status(), `${path} did not return 200`).toBe(200);

      // Give deferred work (module scripts, Supabase bootstrap) a moment to throw.
      await page.waitForTimeout(1200);

      await expect(page).toHaveTitle(/\S/);
      expect(errors, `${path} produced errors:\n${errors.join('\n')}`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. The plan gate actually gates. A gate that silently stops redirecting is
//    revenue walking out of the door, and nothing about the page would look wrong.
// ---------------------------------------------------------------------------
test.describe('plan gate', () => {
  for (const path of ['project-designer.html', 'shop-3d-viewer.html']) {
    test(`${path} redirects a free visitor to pricing`, async ({ page }) => {
      await page.addInitScript(() => {
        try { window.localStorage.removeItem('kerphPlan'); } catch (e) { /* ignore */ }
      });
      await page.goto(`/${path}`, { waitUntil: 'load' });
      await page.waitForURL(/pricing\.html/, { timeout: 10_000 });
      expect(page.url()).toContain('pricing.html');
      expect(page.url()).toContain('locked=');
    });
  }

  test('an entitled visitor is not redirected', async ({ page }) => {
    await grantPlan(page);
    await page.goto('/project-designer.html', { waitUntil: 'load' });
    await page.waitForTimeout(800);
    expect(page.url()).toContain('project-designer.html');
  });
});

// ---------------------------------------------------------------------------
// 3. Calculators return the right answer. A calculator that renders but computes
//    wrongly is the worst failure mode here: it looks fine and it costs someone
//    real lumber.
// ---------------------------------------------------------------------------
test.describe('calculators', () => {
  // Two cases rather than one, so a bug that happens to produce the right answer for a
  // single input can't pass. Asserted against the labelled total rather than "a 4 appears
  // somewhere" -- the results grid renders as "Total board feet4 bf1 board" with no word
  // boundary before the number, which is what made the first version of this test fail.
  const BOARD_FEET_CASES = [
    { thickness: '1', width: '6', length: '8', expected: 4 },   // (1 x 6 x 96) / 144
    { thickness: '2', width: '12', length: '10', expected: 20 }, // (2 x 12 x 120) / 144
  ];

  for (const c of BOARD_FEET_CASES) {
    test(`board feet: ${c.thickness}in x ${c.width}in x ${c.length}ft = ${c.expected} bf`, async ({ page }) => {
      const errors = watchForErrors(page);
      await page.goto('/shop-jigs-board-feet.html', { waitUntil: 'load' });

      await page.fill('#bfThickness', c.thickness);
      await page.fill('#bfWidth', c.width);
      await page.fill('#bfLength', c.length);
      // Nudge any change-driven recalculation.
      await page.locator('#bfLength').blur();

      const results = page.locator('#bfResults');
      await expect(results).not.toBeEmpty();
      await expect(results).toContainText(new RegExp(`Total board feet\\s*${c.expected}(\\.0+)?\\s*bf`));
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// 4. The two heaviest tools actually initialise. These exercise the module
//    graph, the import map and the CDN — the places where a dependency change
//    breaks everything at once and the page still returns 200.
// ---------------------------------------------------------------------------
test.describe('core tools initialise', () => {
  test('workshop planner renders its board', async ({ page }) => {
    const errors = watchForErrors(page);
    await grantPlan(page);
    await page.goto('/workshop-planner.html', { waitUntil: 'load' });

    const board = page.locator('#workshopBoard');
    await expect(board).toBeVisible();
    const box = await board.boundingBox();
    expect(box, 'workshop board has no layout box').toBeTruthy();
    expect(box.width).toBeGreaterThan(50);
    expect(box.height).toBeGreaterThan(50);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('3D shop viewer builds a WebGL canvas from a saved layout', async ({ page }) => {
    const errors = watchForErrors(page);
    await grantPlan(page);
    // Seed a minimal layout so the viewer builds a scene instead of showing its empty state.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('kerphCurrentLayout', JSON.stringify({
          id: 'smoke', name: 'Smoke Test Shop',
          widthFeet: 20, lengthFeet: 24, ceilingHeightFt: 9,
          scale: '1', unitSystem: 'imperial', shapeMode: 'rectangle', shapePoints: [],
          tools: [], wallFeatures: [],
        }));
      } catch (e) { /* ignore */ }
    });

    await page.goto('/shop-3d-viewer.html', { waitUntil: 'load' });

    // three.js loads as a module from a CDN, so allow real network time.
    const canvas = page.locator('#viewer3dCanvas canvas');
    await expect(canvas).toBeVisible({ timeout: 25_000 });
    const box = await canvas.boundingBox();
    expect(box.width).toBeGreaterThan(50);
    expect(box.height).toBeGreaterThan(50);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('project designer loads three.js and the CSG bundles', async ({ page }) => {
    const errors = watchForErrors(page);
    await grantPlan(page);
    await page.goto('/project-designer.html', { waitUntil: 'load' });

    // The module script assigns these once it has executed to completion, so their presence
    // proves every import in the graph resolved — including the bundled CSG builds.
    await expect
      .poll(async () => page.evaluate(() => typeof window.init3DPreviewScene), { timeout: 25_000 })
      .toBe('function');
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. Share metadata. Silent to a visitor, but its absence quietly degrades every
//    link posted anywhere — which is exactly the kind of regression nobody notices.
// ---------------------------------------------------------------------------
test.describe('share metadata', () => {
  const SAMPLE = ['index.html', 'workshop-planner.html', 'garage-tips.html', 'shop-jigs-board-feet.html'];
  for (const path of SAMPLE) {
    test(`${path} has Open Graph tags`, async ({ page }) => {
      await grantPlan(page);
      await page.goto(`/${path}`, { waitUntil: 'domcontentloaded' });
      for (const prop of ['og:title', 'og:description', 'og:image', 'og:url']) {
        const content = await page.locator(`meta[property="${prop}"]`).getAttribute('content');
        expect(content, `${path} is missing ${prop}`).toBeTruthy();
      }
      const desc = await page.locator('meta[name="description"]').getAttribute('content');
      expect(desc, `${path} is missing a meta description`).toBeTruthy();
    });
  }
});
