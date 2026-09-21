# Dashboard UI sprites → SVG sample

Sample-first recreation of **Dashboard** ornate UI sprites as SVG, targeting visual **1:1** against the WebP sources (leather grain, stitching, flower motifs). Other admin pages stay on WebP.

## Approach

Each Dashboard sprite tile was cropped from the WebP sheets, then traced to optimized SVG (color vectorization + multipass optimize) so the leather / stitch / flower silhouette stays faithful — not flat Lucide approximations.

- SVG assets: [`public/admin/ui/dashboard-svg/`](../../public/admin/ui/dashboard-svg/)
- Component wrapper: [`src/components/ui/dashboard-sprites/`](../../src/components/ui/dashboard-sprites/) (`DashboardSprite`)
- Wired only on: [`src/app/admin/page.tsx`](../../src/app/admin/page.tsx)
- Layout sizes / breakpoints unchanged in [`admin-pages.module.css`](../../src/app/admin/admin-pages.module.css) (~760 / 980 / 1180; shell ~1100)
- Color tokens (sampled from tiles): [`tokens.ts`](../../src/components/ui/dashboard-sprites/tokens.ts)

## Replaced on `/admin` (Dashboard only)

| Former WebP sheet | Tiles | SVG files / `kind` |
| --- | --- | --- |
| `public/admin/ui/dashboard-stat-icons.webp` | photo / folder / clock / shield | `stat-photo`, `stat-folder`, `stat-clock`, `stat-shield` |
| `public/admin/ui/dashboard-action-icons.webp` | upload / folder / api / crest | `action-upload`, `action-folder`, `action-api`, `action-crest` |
| `public/admin/ui/dashboard-action-arrows.webp` | pink / lavender / mint | `arrow-pink`, `arrow-lavender`, `arrow-mint` |

Original WebP sheets remain in `public/admin/ui/` for review. Dashboard CSS no longer loads them via `background-image`.

## Visual compare

1. Screenshots in this PR: [`screenshots/webp-vs-traced-svg.png`](./screenshots/webp-vs-traced-svg.png) (tile vs SVG) and [`screenshots/webp-tiles-before.png`](./screenshots/webp-tiles-before.png).
2. Open [`compare.html`](./compare.html) (lists each traced SVG + which WebP tile it replaces).
3. Open originals side-by-side with SVGs in the running app:
   - WebP sheets: `/admin/ui/dashboard-stat-icons.webp`, `dashboard-action-icons.webp`, `dashboard-action-arrows.webp`
   - SVG tiles: `/admin/ui/dashboard-svg/*.svg`
4. Visit `/admin` and review hover on quick-action rows (brightness / shadow lift kept).

## Out of scope (this sample)

- Gallery / other admin pages still use their WebP sprites
- Bucket ③: mascots, Cloudinary content images, gallery thumbnails, subject cast — untouched
- Deleting the original WebP files (kept for side-by-side review)
