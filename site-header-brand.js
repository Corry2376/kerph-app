// Shared header markup: logo, page-nav dropdown, and Shop Jigs dropdown.
// One file instead of ~26 hand-copied blocks — edit this, not every page.
//
// Loaded as a plain (non-async, non-defer) <script src> placed exactly where this content
// belongs inside <header>. document.write() from a synchronous script like this inserts HTML
// inline during initial parsing — same trick classic server-side includes used, still valid
// for a script tag that isn't async/deferred, and it means zero flash/placeholder gap.
//
// index.html keeps its own hand-written header (no page-nav dropdown, plus a Reminders
// checkbox in the sign-in form) — it's the one deliberately different page, not worth forcing
// into this shared template. coming-soon.html has no app header at all.
// Mobile header rules, injected once here rather than copied into ~26 pages' own <style>
// blocks. Selectors match each page's existing desktop rules exactly (header, .logo-image,
// etc.) so — since this <style> lands later in document order than each page's own inline
// <style> in <head> — same-specificity rules here win on the cascade without needing !important
// or edits to every page's existing CSS. See site-header-tail.js for the matching mobile rules
// for the sign-in form / account button / quick links (that file loads second, so its <style>
// wins over both the page's own CSS and this file's, for the handful of selectors both touch).
document.write(`
<style>
@media (max-width: 1100px) {
    header {
        height: auto;
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
        padding: 12px 14px;
    }
    .brand-assembly {
        height: auto;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
    .logo-spotlight { width: 150px; height: 41px; }
    .logo-image { width: 150px; height: 41px; }
    .logo-tm { display: none; }
    .page-title-select { flex: 1 1 160px; min-width: 0; }
    .jigs-dropdown { margin-left: 0; }
    .jigs-dropdown-menu { left: auto; right: 0; }
}
</style>
`);

document.write(`
<div class="brand-assembly">
    <div class="logo-spotlight">
        <a href="index.html" class="logo-link" title="Kerph Home">
            <img src="logo.png" alt="Kerph Logo" class="logo-image">
        </a>
        <span class="logo-tm">&trade;</span>
    </div>
    <select class="page-title-select" id="pageNavSelect">
        <option value="index.html">Home</option>
        <option value="workshop-planner.html">Workshop Layout Planner</option>
        <option value="project-designer.html">Project Designer</option>
        <option value="cutlist-optimizer.html">Cut List Optimizer</option>
        <option value="quote-builder.html">Quote Builder</option>
        <option value="find-a-builder.html">Find a Builder</option>
        <option value="shop-3d-viewer.html">3D Shop Viewer</option>
        <option value="tool-catalog.html">Tool Catalog &amp; Reviews</option>
        <option value="shop-showcase.html">Shop Showcase</option>
        <option value="garage-tips.html">Shop Tricks and How-To's</option>
        <option value="portfolio.html">Portfolio</option>
        <option value="print-library.html">3D Print Library</option>
    </select>
    <div class="jigs-dropdown" id="jigsDropdown">
        <button type="button" class="jigs-dropdown-btn" id="jigsDropdownBtn">Shop Jigs <span class="jigs-dropdown-caret">&#9662;</span></button>
        <div class="jigs-dropdown-menu">
            <a href="shop-jigs-fraction-converter.html">Measurement Converter</a>
            <a href="shop-jigs-add-fractions.html">Add &amp; Subtract Fractions</a>
            <a href="shop-jigs-board-feet.html">Board Foot Calculator</a>
            <a href="shop-jigs-angle-chart.html">Polygon Angle Chart</a>
            <a href="shop-jigs-wood-movement.html">Wood Movement Calculator</a>
            <a href="shop-jigs-speeds-feeds.html">Speeds &amp; Feeds</a>
            <a href="shop-jigs-sharpening-angles.html">Sharpening Angle Chart</a>
            <a href="shop-jigs-table-saw-setup.html">Table Saw Setup Checklist</a>
            <div class="jigs-dropdown-menu-sep"></div>
            <a href="shop-jigs.html">All Shop Jigs &rarr;</a>
        </div>
    </div>
</div>
`);

// Two things every page used to bake into its own copy of this markup as static per-file
// differences (a `selected` option, a `class="current"` link) — set dynamically instead so
// the shared block above can stay identical everywhere.
(function () {
    var current = location.pathname.split('/').pop() || 'index.html';
    var select = document.getElementById('pageNavSelect');
    if (select) {
        for (var i = 0; i < select.options.length; i++) {
            if (select.options[i].value === current) { select.value = current; break; }
        }
    }
    var jigsLink = document.querySelector('.jigs-dropdown-menu a[href="' + current + '"]');
    if (jigsLink) jigsLink.classList.add('current');
})();
