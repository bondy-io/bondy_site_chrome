# @bondy/site-chrome

The navigation bar, footer and palette worn by every Bondy property.

The Bondy sites deploy independently — marketing ships `bondy_website` without
ever compiling Bondy Lang — and the CDN routes one origin across the deploys:

```
/                bondy_website
/docs/           documentation hub  (bondy_website)
/docs/router/    bondy_docs
/docs/lang/      bondy_lang
```

This package is what makes those separate deploys read as one site. It is a
**build-time dependency, not a runtime include**, so adopting a nav change
costs a version bump and a redeploy in each repo rather than a coupled build.

## Install

```jsonc
// package.json
"dependencies": {
  "@bondy/site-chrome": "git+https://github.com/bondy-io/bondy_site_chrome.git#v0.9.8"
}
```

Every site must track the **same tag**. Skew is how the nav drifted before.

### Working on it locally

`npm` installs a `file:` dependency as a **symlink**, so Vite resolves this
package's `vue` import from its real path outside the consuming project and
the build fails with `Rollup failed to resolve import "vue"`. Install a packed
tarball instead, which is what the git install produces anyway:

```sh
cd bondy_site_chrome && npm pack
cd ../bondy_website && npm install ../bondy_site_chrome/bondy-site-chrome-<version>.tgz
```

`yarn` copies `file:` dependencies rather than symlinking them, so
`file:../bondy_site_chrome` works there directly.

Consuming sites must also declare:

```js
vite: { ssr: { noExternal: ['@bondy/site-chrome'] } }
```

because the package ships raw `.vue` source for Vite to compile.

## Use

```js
// .vitepress/theme/index.js
import '@bondy/site-chrome/styles/chrome.css'
import './brand.css'   // site-specific, loaded after
```

```vue
<script setup>
import { SiteNav, SiteFooter, SiteSearch } from '@bondy/site-chrome'
</script>

<template>
  <SiteNav active="docs" self="docs" layout="docs">
    <template #search><SiteSearch self="docs" /></template>
  </SiteNav>
</template>
```

### `<SiteNav>`

| prop | default | |
|---|---|---|
| `active` | `''` | id from `SITE_LINKS` marking which section this site is |
| `self` | `'website'` | which property this site is (an `ORIGINS` key); links to it stay relative |
| `layout` | `'sticky'` | `sticky` for a site with its own layout; `docs` replaces VitePress's `VPNav` |
| `github` | org URL | GitHub link target |

Slots: `search`, `cta`, `mobileExtra`. The bar is one row; page-level context
such as a breadcrumb or version picker belongs with the page.

Both layouts behave the same way on screen. At 1025px and wider the bar starts
transparent and full width, and once the page scrolls past 50px it floats as a
blurred, rounded pill. At 1024px and below it is a fixed, full-width glass bar,
with the links in a burger drawer below 1150px.

`layout="docs"` also declares `--vp-nav-height` as 64px and hides `VPNav`, so
every VitePress offset (sidebar, content, local nav) stays correct. The pill
floats inside a fixed box, so that height does not change on scroll.

### `<SiteSearch>`

Site-wide search. Each deploy publishes its own Pagefind bundle
(`npm run index` after the build); this component loads every bundle in
`SEARCH_BUNDLES` and queries each one, grouping the results by deploy.

It deliberately does **not** use Pagefind's `mergeIndex()`. Merging blends
results into one ranked list, but each bundle scores terms against its own
corpus, so a term rare in one and common in another ranks by the rare corpus
first. Measured on the real content: "realm" via `mergeIndex` put the Router
docs' own realms page at #15 with no Router results in the top 12; querying
each bundle separately puts it back at #1.

| prop | default | |
|---|---|---|
| `self` | `'website'` | which property this site is; its own bundle is relative and listed first |
| `bundles` | `SEARCH_BUNDLES` | every bundle to query |
| `perGroup` | `5` | results shown per deploy |

### `<SiteFooter>`

`columns` (`[{ title, links: [{ text, href }] }]`), `blurb`, `note`, `layout`.
Slots: `blurb`, `extra`. The column set is genuinely per-site; the grid, type
and bottom rule are shared.

## What lives here, and what does not

**Here:** the palette tokens, the bar, the footer, the wordmark.

**Not here:** page-level design (heroes, feature grids, the Diataxis home) and
anything one site alone needs. Those stay with the site.

Palette tokens are declared on `:root`, not on a wrapper class, so existing
page CSS that consumes `--paper` / `--ink` / `--blue` keeps working unchanged.

## Notes

The wordmark is inlined as a single SVG with `fill="currentColor"`. It replaces
`bondy-logo.svg` + `bondy-logo-light.svg`, which were identical apart from
their fill and were swapped by `display:none` rules keyed off `html.dark`.
The wordmark now inherits the surrounding ink, which removes those rules, two
HTTP requests, and the per-site `public/` copies that had to be kept in sync.

`SITE_LINKS` hrefs are origin-absolute and must **not** be passed through
VitePress's `withBase`: a site built with `base: '/docs/router/'` would
otherwise turn `/language` into `/docs/router/language`.
