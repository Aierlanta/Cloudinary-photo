# Admin UI sprites → traced SVG (remaining pages)

Continues the Dashboard sample from PR #60: convert the rest of `public/admin/ui/*.webp`
admin chrome sprites to traced SVG, wired like `DashboardSprite`.

**Continued in:** [`designs/login-home-svg/`](../login-home-svg/) (login crest + home medallions).
**Never touched:** bucket ③ / photo content assets, auth, API, upload/gallery data pipelines.

## Approach

Same as Dashboard: crop WebP sheet tiles → downsample to 280² → VTracer (`@neplex/vectorizer` Photo preset) → multipass optimize → static SVG under `public/admin/ui/<page>-svg/`.

- Components: [`src/components/ui/admin-ui-sprites/`](../../src/components/ui/admin-ui-sprites/) (`GallerySprite`, `GroupsSprite`, `LogsSprite`, `ConfigSprite`, `StatusSprite`, `BackupSprite`, `SecuritySprite`, `SwarmSprite`, `UploadSprite`)
- Original WebP sheets kept in `public/admin/ui/` for side-by-side review
- CSS sizing / filters kept; `background-image` WebP sheet refs removed from [`admin-pages.module.css`](../../src/app/admin/admin-pages.module.css)

## Converted sheets

| Former WebP | SVG dir | Notes |
| --- | --- | --- |
| `gallery-actions.webp` | `gallery-svg/` | 4×2 toolbar charms |
| `groups-icons.webp` + `groups-actions.webp` | `groups-svg/` | `icon-*` + `action-*` |
| `logs-actions.webp` + `logs-levels.webp` | `logs-svg/` | toolbar + level-0..3 |
| `config-icons.webp` + `config-actions.webp` | `config-svg/` | |
| `status-icons.webp` | `status-svg/` | |
| `backup-icons.webp` + `backup-actions.webp` | `backup-svg/` | |
| `security-icons.webp` + `security-actions.webp` | `security-svg/` | |
| `swarm-icons.webp` + `swarm-actions.webp` | `swarm-svg/` | |
| `upload-actions.webp` + `upload-hero.webp` | `upload-svg/` | hero is single tile |

Unused on disk (not wired): `logs-icons.webp`. Dashboard sheets already done in PR #60.

## Visual verify (routes)

1. Open [`compare.html`](./compare.html) for tile lists.
2. Run the app and spot-check:
   - `/admin/gallery` + image list bulk toolbar
   - `/admin/images` (upload dropzone hero + action charms)
   - `/admin/groups`
   - `/admin/logs`
   - `/admin/config`
   - `/admin/status`
   - `/admin/backup`
   - `/admin/security`
   - `/admin/swarm`
3. Compare originals at `/admin/ui/<sheet>.webp` vs `/admin/ui/<page>-svg/*.svg`.

Gallery search field keeps the CSS-drawn loupe (`admin-gallery-search-icon`), not a WebP tile.
