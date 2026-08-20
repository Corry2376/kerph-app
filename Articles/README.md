# Garage Tips Articles

18 articles for Kerph's Garage Tips feature — 15 new ones, plus the 3 already-published
articles rewritten to match the same house rules below (see "Existing articles" at the bottom).

## Folder structure

Each article is its own folder:

```
Articles/
  01-cast-iron-rust-free/
    article.html   <- metadata + body, ready to copy into the site
    cover.svg       <- tile/cover image
  02-cleaning-pitch-resin-blades/
    ...
```

## `article.html` format

Every file starts with an HTML comment holding the metadata, then the article body
immediately after:

```html
<!--
TITLE: ...
CATEGORY: ...
EXCERPT: ...
TAGS: ...
AUTHOR: Kerph Team
-->
<p>body starts here...</p>
```

These map straight to the `garage_tips` table:

| Frontmatter field | DB column | Notes |
|---|---|---|
| TITLE | `title` | |
| CATEGORY | `category` | Must be exactly one of the 10 values below — the site's filter dropdown is hardcoded to this list. |
| EXCERPT | `excerpt` | Card teaser text. |
| TAGS | `tags` | Comma-separated in the file; the DB column is a real array (`text[]`) — split on commas when importing. |
| AUTHOR | `author` | All 18 use `Kerph Team`, matching the existing site convention. |
| *(everything after the closing `-->`)* | `body_html` | Real HTML, not Markdown — the site injects it via `innerHTML` after DOMPurify sanitization, so standard tags (`<p>`, `<h2>`, `<a>`, `<img>`, styled `<div>`) all work as-is. |

Three of the rewritten articles (16–18) also carry a `VIDEO:` field — that's a real
`video_url` column in the DB, not part of the original 15's schema, kept because those three
already had a real embedded video in production.

**Allowed categories** (exact strings, case-sensitive):
`Dust Collection`, `Finishing`, `Tool Maintenance`, `Shop Organization`, `Jigs & Fixtures`,
`Safety`, `Sharpening`, `Wood Selection`, `Beginner Basics`, `Other`

## Amazon affiliate links

Every named product links to an Amazon **search** result, not a direct product page:

```html
<a href="https://www.amazon.com/s?k=Product+Name&tag=kerphplans-20" target="_blank" rel="noopener sponsored">Product Name</a>
```

This is deliberate, not a shortcut: I have no way to verify a real ASIN for most of these
products, and a wrong/guessed ASIN would silently link to the wrong item. The search link
always resolves correctly and still carries the real `kerphplans-20` affiliate tag (the same
one already used throughout the tool catalog). **If you want a specific listing linked
directly** (a particular size, color, or seller), that's an easy manual swap while you're
editing — just replace the `href` with the real product URL, keeping `?tag=kerphplans-20` on
the end.

## Photo placeholders

Wherever a real photo would help, you'll find a block like this instead of a hotlinked image:

```html
<div style="background:#f1f5f9; border:1px dashed #cbd5e1; border-radius:10px; padding:28px 16px; text-align:center; color:#64748b; font-size:13px; margin:16px 0;">
    📷 Photo placeholder — [what the photo should actually show]
</div>
```

No article hotlinks a third-party photo — that was a deliberate call, both for licensing
safety and because a stock photo of the wrong product model looks worse than no photo. Replace
each placeholder `<div>` with a real `<img src="...">` once you've got the shot (site convention
uploads through the article editor, which downscales to 1200px/JPEG automatically).

## Cover images

Each `cover.svg` is an original vector illustration, not a photo — 800×600 (4:3, matching the
card tile's crop), Kerph's navy/orange palette, no baked-in title text (the site renders the
title separately under the image). These are usable as-is, or swap in a real photo instead if
you'd rather — same 4:3 framing applies either way.

## The 15 new articles

| # | Title | Category |
|---|---|---|
| 01 | Keeping Cast Iron Tables Rust-Free | Tool Maintenance |
| 02 | Cleaning Pitch and Resin Off Blades and Bits Safely | Tool Maintenance |
| 03 | How to Tune Up a Table Saw in 30 Minutes | Tool Maintenance |
| 04 | A Realistic Tool Maintenance Schedule You'll Actually Follow | Tool Maintenance |
| 05 | Push Sticks, Push Blocks, and Featherboards: What to Actually Use | Safety |
| 06 | Hearing Protection for the Shop: What's Actually Effective | Safety |
| 07 | Choosing the Right Respirator for Fine Dust and Finishing Fumes | Safety |
| 08 | Oil Finishes vs. Film Finishes: Which Fits Your Project? | Finishing |
| 09 | Food-Safe Finishes for Cutting Boards and Bowls | Finishing |
| 10 | Understanding Grit Numbers for Sandpaper | Beginner Basics |
| 11 | French Cleat Systems: Worth Building? | Shop Organization |
| 12 | Mobile Bases: Which Tools Actually Need to Roll | Shop Organization |
| 13 | Your First Ten Tools: What to Actually Buy | Beginner Basics |
| 14 | Sharpening Chisels and Plane Irons: A Realistic Beginner's System | Sharpening |
| 15 | Humidity Control for Wood Storage Through the Seasons | Other |

Topics pulled from `Kerph Garage Tips - 200 Article Ideas.xlsx` in the repo root, picked for a
mix of general-appeal shop knowledge and product-heavy topics (maintenance, safety gear,
finishing) where affiliate links make sense.

## Existing articles (16–18), rewritten to match

These three are already live in the database. I rewrote their *files* to match the rules
above — real content is preserved, but every hotlinked photo became a labeled placeholder, and
every manufacturer/retailer product link became an Amazon affiliate search link. If you load
these back in, they'll **update the existing rows**, not create duplicates — match on `title`,
same as the original seed scripts do.

| # | Title | Category |
|---|---|---|
| 16 | Top 10 Most Popular Table Saws in 2026 | Other |
| 17 | The Shop Maintenance Guide: Table Saw, Band Saw & Jointer/Planer | Tool Maintenance |
| 18 | Dust Collection Setup: Tips & Tricks for a Shop That Actually Breathes | Dust Collection |

## Loading these into the site

Two options once you're done editing:
1. **Manual** — copy each article's title/excerpt/category/tags/body into the Garage Tips
   admin editor by hand (fine for a few at a time).
2. **Batch** — tell me to write a SQL import script (same pattern as the existing
   `sql/garage-tips-articles.sql`) that reads these files and inserts/updates all 18 at once,
   after you've finished editing and uploading real cover/inline photos to replace the SVGs
   and placeholders you want to swap out.
