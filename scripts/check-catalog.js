/* Catalog data integrity check.
 *
 * The catalog is not decoration -- it is the planner's tool library, the affiliate
 * storefront, and the source of the product data the site publishes. A wrong or missing
 * identifier there is a revenue and correctness problem, not a cosmetic one. Nothing else
 * in the test suite reads catalog-data.js, so without this a dead entry or a stripped
 * affiliate tag ships silently and gets found by a user.
 *
 * Two classes of check:
 *   HARD     broken or non-compliant right now. Always fails the build.
 *   RATCHET  a known backlog (missing images/identifiers). Fails only if the count goes UP,
 *            so the backlog can drain without blocking while a regression still fails.
 *            Baseline lives in scripts/catalog-baseline.json.
 *
 * catalog-data.js exposes THREE lists and all three are checked. CATALOG_ITEMS is the
 * floor-placed machinery the planner lays out; SMALL_TOOLS is the handheld tools that are
 * browsable and reviewable but never placed on the floor (tool-catalog.html renders the
 * union of the two); TOOL_SPECS carries the specs, identifiers and buy links that both
 * layer on top. An earlier version of this check read only CATALOG_ITEMS and was blind to
 * 125 SMALL_TOOLS entries -- which are disproportionately the Amazon-linked handhelds.
 *
 * Entries carrying `type: 'element'` are generic shop geometry -- duct runs, blast gates,
 * light fixtures. They are placed in the planner but are not purchasable products, so they
 * are exempt from every product-identity check by design.
 *
 * This parses catalog-data.js by EXECUTING it against a window shim, never by regex. The
 * first version used regex and produced three separate false positives -- it mangled
 * "Oliver 4065.002" into "Oliver 4065&002" and truncated the legitimately escaped name
 * "Husky 18in Contractor\'s Rolling Tool Tote" at the backslash, reporting 30 healthy
 * entries as missing. A JS object literal gets parsed by a JS parser.
 */
function runChecks(TOOL_SPECS, CATALOG_ITEMS, SMALL_TOOLS) {
  const items = [...(CATALOG_ITEMS || []), ...(SMALL_TOOLS || [])];
  const names = Object.keys(TOOL_SPECS);
  const spec = n => TOOL_SPECS[n] || {};
  const isElement = n => spec(n).type === 'element';
  const products = names.filter(n => !isElement(n));

  const hard = [];
  const add = (label, offenders) => hard.push({ label, offenders });

  // A browsable item with no spec entry renders as a card backed by nothing.
  add('catalog items with no spec entry',
      [...new Set(items.map(i => i.name))].filter(n => !(n in TOOL_SPECS)));

  // An Amazon link without the tag earns nothing -- a direct revenue leak.
  add('amazon links missing affiliate tag',
      names.filter(n => (spec(n).buyUrl || '').includes('amazon.com')
                     && !(spec(n).buyUrl || '').includes('tag=kerphplans-20')));

  // Hotlinking Amazon's image CDN breaches the Associates Operating Agreement and puts the
  // whole affiliate account at risk. Those images have to come through PA-API instead.
  add('amazon-hotlinked images (ToS)',
      names.filter(n => /m\.media-amazon\.com|images-amazon\.com/.test(spec(n).image || '')));

  // An ASIN that disagrees with its own buy link means identifier and link have drifted;
  // affiliate reporting would then reconcile against the wrong product.
  add('asin disagrees with buyUrl', names.filter(n => {
    const s = spec(n);
    if (!s.asin || !s.buyUrl) return false;
    const m = s.buyUrl.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
    return m && m[1] !== s.asin;
  }));

  // The same ASIN on two entries means two cards point at one product.
  const byAsin = new Map();
  for (const n of names) {
    const a = spec(n).asin;
    if (!a) continue;
    if (!byAsin.has(a)) byAsin.set(a, []);
    byAsin.get(a).push(n);
  }
  add('duplicate ASINs', [...byAsin].filter(([, v]) => v.length > 1)
                                    .map(([a, v]) => `${a}: ${v.join(' | ')}`));

  // An element is shop geometry, not merchandise -- it must not carry commerce fields.
  add('elements carrying commerce fields',
      names.filter(isElement).filter(n => spec(n).buyUrl || spec(n).asin || spec(n).image));

  const ratchet = {
    noimg: products.filter(n => !spec(n).image).length,
    noid:  products.filter(n => !spec(n).asin && !spec(n).model).length,
    nobuy: products.filter(n => !spec(n).buyUrl).length,
  };

  return {
    counts: {
      catalogItems: (CATALOG_ITEMS || []).length,
      smallTools:   (SMALL_TOOLS || []).length,
      specs: names.length, products: products.length,
      elements: names.length - products.length,
    },
    hard, ratchet,
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { runChecks };

if (typeof module !== 'undefined' && typeof require !== 'undefined' && require.main === module) {
  const fs = require('fs'), path = require('path');
  const root = path.join(__dirname, '..');
  const win = {};
  new Function('window', fs.readFileSync(path.join(root, 'catalog-data.js'), 'utf8'))(win);
  const r = runChecks(win.TOOL_SPECS, win.CATALOG_ITEMS, win.SMALL_TOOLS);
  const base = JSON.parse(fs.readFileSync(path.join(root, 'scripts/catalog-baseline.json'), 'utf8'));

  let fail = false;
  const c = r.counts;
  console.log('=== catalog integrity ===');
  console.log(`  catalog items ${c.catalogItems}   small tools ${c.smallTools}   ` +
              `spec entries ${c.specs}   products ${c.products}   elements ${c.elements}\n`);

  for (const { label, offenders } of r.hard) {
    if (offenders.length) {
      fail = true;
      console.log(`  FAIL  ${label.padEnd(38)} ${offenders.length}`);
      offenders.forEach(o => console.log(`          ${o}`));
    } else console.log(`  ok    ${label.padEnd(38)} 0`);
  }

  console.log('');
  for (const [k, label] of [['noimg', 'products with no image'],
                            ['noid',  'products with no identifier'],
                            ['nobuy', 'products with no buy link']]) {
    const cur = r.ratchet[k], b = base[k];
    if (cur > b) {
      fail = true;
      console.log(`  FAIL  ${label.padEnd(38)} ${cur}  (baseline ${b} -- REGRESSION)`);
    } else {
      console.log(`  ok    ${label.padEnd(38)} ${cur}  (baseline ${b}${cur < b ? ' -- improved, lower it' : ''})`);
    }
  }
  console.log(fail ? '\n  FAILED -- see above' : '\n  PASS');
  process.exit(fail ? 1 : 0);
}
