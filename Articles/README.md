# Garage Tips Articles

19 articles for Kerph's Garage Tips feature — 16 new ones, plus the 3 already-published
articles rewritten to match the same house rules below (see "Existing articles" at the bottom).

## Folder structure

Each article is its own folder:

```
Articles/
  01-cast-iron-rust-free/
    article.docx        <- EDIT THIS. Real Word doc: title, cover photo, and body text.
    article.html         <- source of truth for reimport (regenerated from your .docx edits)
    cover.jpg             <- real photo, also embedded at the top of article.docx
    cover-source.txt        <- where the photo came from, for reference
  02-cleaning-pitch-resin-blades/
    ...
```

**Edit `article.docx`.** Open it in Word, change whatever you want — title, wording, swap the
cover photo, delete a section, whatever. It's a real, normal Word document (headings, bold,
real clickable hyperlinks, the cover photo embedded at the top) — no HTML or code visible
anywhere. When you're done, save it and tell me; I'll read your changes back out of the .docx
and update `article.html` to match before we import, so you never have to touch the HTML file
yourself.

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

## Cover photos

Every article has a real `cover.jpg` — free-license stock photography (Pexels/Pixabay,
commercial use allowed, no attribution required), same convention as the 3 original articles'
covers (`images/garage-tips/*.jpg`, see `sql/garage-tips-covers.sql`). Each folder's
`cover-source.txt` names where it came from. The cover is embedded right at the top of
`article.docx` so you can see it (and swap it, if you've got a better one) while you edit.

**If you have your own photos — for a cover or anywhere in the body — just hand them to me**
(attach them in chat, or tell me a file path) and say which article they belong to. Your own
shop/product photos beat generic stock photography, especially for anything showing a specific
product.

## In-body photo placeholders

Inside the body text (in both `article.docx` and `article.html`), wherever a real photo would
help, you'll find a labeled placeholder instead of a made-up or hotlinked image — e.g. in the
Word doc, a boxed note like:

> 📷 Photo placeholder — a close-up of a hearing protection product label showing the NRR
> rating, next to a pair of earmuffs

No article hotlinks a third-party photo anywhere — deliberate, both for licensing safety and
because a stock photo of the wrong product looks worse than no photo. Replace each placeholder
with a real photo (yours, or one you hand me) once you've got the shot; the site's own upload
path downscales to 1200px/JPEG automatically.

## The 16 new articles

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
| 19 | Kickback: Why It Happens and How to Prevent It | Safety |

Topics 01–15 pulled from `Kerph Garage Tips - 200 Article Ideas.xlsx` in the repo root, picked
for a mix of general-appeal shop knowledge and product-heavy topics (maintenance, safety gear,
finishing) where affiliate links make sense. Article 19 was added by request as an extensive,
standalone treatment of kickback — mechanics, all 9 real causes, and prevention. Its injury
statistic (workpiece kickback/jump present in 40.5% of table/bench saw ER-treated injuries) is
cited directly to the CPSC's own 2007–2008 stationary saw injury survey and was independently
checked against the source PDF text, not just quoted from a secondary summary.

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

1. **Edit** whatever you want in `article.docx` per folder (or hand me photos to drop in).
2. **Tell me you're done** — I'll pull your edits back out of the .docx into `article.html` and
   confirm the results with you.
3. **Import** — I'll write a SQL script (same pattern as the existing
   `sql/garage-tips-articles.sql`) that inserts/updates all 19 into `garage_tips` at once,
   uploading each real cover photo to the site's storage bucket along the way.
