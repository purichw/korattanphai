# เกษตรทันภัย SEO / Indexing Contract

## Current State

FACT:

- The app is a Vite SPA served at `/`.
- `index.html` includes basic title/meta and Google Fonts.
- There is no route-specific metadata.
- There is no `robots.txt`.
- There is no sitemap.
- There is no explicit noindex tag.

## Public Indexing Decision

needs audit:

- Confirm whether the prototype should be indexed by search engines.
- If it remains a prototype or uses synthetic public-safety data, consider
  adding `noindex` until operational ownership is confirmed.

## Metadata Requirements

Current title should represent the product:

- `เกษตรทันภัย`

Future public production metadata should include:

- Thai title.
- Plain-language description.
- Canonical URL.
- Open Graph image if the site is intended for public sharing.
- Clear indication of prototype vs official status until official launch.

## Public-Safety Search Rules

- Do not use SEO copy that suggests official emergency authority unless that is
  legally and operationally true.
- Do not index outdated alert detail pages without clear expiry/correction
  behavior.
- Do not allow synthetic prototype risk pages to appear as real warnings.

## Route Indexing

Current route:

- `/`: index behavior needs audit.

Future route classes:

- Public current alerts: index only if official and fresh.
- Archived alerts: index only with clear archive timestamp and no active-action
  confusion.
- Operator/admin pages: noindex and protected.
- API/docs/debug pages: noindex unless intentionally public.

## Verification

Before changing SEO/indexing:

```bash
npm run build
```

Then inspect the deployed HTML and response headers after authorized deploy.
