# Login crest + home medallions → traced SVG

Continues PR #60/#61: convert **login crest** and **home medallions** decorative
PNG sheets to traced SVG, wired like `DashboardSprite` / admin UI sprites.

**Out of scope:** `home-preview-controls.png` (bow + refresh heart), bucket ③ /
photo content, auth/API/upload pipelines. Original PNGs kept on disk.

## Approach

Crop sheet tiles → downsample to 280² → VTracer (`@neplex/vectorizer` Photo preset)
→ multipass optimize → static SVG.

- Components: [`src/components/ui/login-home-sprites/`](../../src/components/ui/login-home-sprites/)
  (`LoginSprite`, `HomeSprite`)
- Login wired in [`LoginForm.tsx`](../../src/components/admin/LoginForm.tsx)
- Home wired in [`src/app/page.tsx`](../../src/app/page.tsx)
- CSS sizing / filters kept; sheet `background-image` removed

## Converted assets

| Former PNG | SVG | Component kind |
| --- | --- | --- |
| `public/admin/ui/login-crest.png` | `public/admin/ui/login-svg/crest.svg` | `LoginSprite` `crest` |
| `public/home/ui/home-nav-medallions.png` (2×1) | `home-svg/nav-{docs,github}.svg` | `HomeSprite` |
| `public/home/ui/home-admin-medallion.png` | `home-svg/admin.svg` | `HomeSprite` `admin` |
| `public/home/ui/home-stat-medallions.png` (2×2) | `home-svg/stat-{picture,album,shield}.svg` (+ unused `stat-br.svg`) | `HomeSprite` |
| `public/home/ui/home-footer-medallions.png` (2×2) | `home-svg/footer-{language,sun,moon,github}.svg` | `HomeSprite` |

## Reviewer checklist — options must NOT shrink

Decorative art only. Confirm these **selectable / interactive** controls still exist
and behave the same:

### Login (`/admin` login)

- Password field
- Submit / login button (incl. loading state)
- Back-to-home link
- Error alert when login fails
- Forgot-password hint (non-interactive copy)

### Home (`/`)

- Nav: API Docs link, GitHub link, Admin / management panel link
- Endpoint copy button (`GET /api/random`) when base URL is set
- Preview refresh heart button
- Footer: language toggle, theme toggle (sun/moon), GitHub link
- Stats cards remain display-only (labels/values unchanged)

## Visual verify

1. Screenshots: [`screenshots/png-vs-traced-svg.png`](./screenshots/png-vs-traced-svg.png) (280² PNG tile vs traced SVG)
2. Open [`compare.html`](./compare.html)
3. Run the app → `/` and admin login
4. Open originals next to SVGs:
   - `/admin/ui/login-crest.png` vs `/admin/ui/login-svg/crest.svg`
   - `/home/ui/home-*-medallion*.png` vs `/home/ui/home-svg/*.svg`
