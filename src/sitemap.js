/**
 * The canonical Bondy site map.
 *
 * This is the single source of truth for the top-level navigation. Every
 * Bondy property renders the same list and marks its own entry active, so a
 * new section is added here once rather than in each site's theme.
 *
 * ── Why entries carry an origin ──────────────────────────────────────────
 *
 * The properties are separate deploys on separate hosts:
 *
 *   website  bondy.io              bondy_website
 *   docs     developer.bondy.io    bondy_docs  (the docs portal; Router and
 *                                               WAMP today, BAMP later)
 *   lang     lang.bondy.io         bondy_lang  (generated from Bondy source)
 *
 * A bare `/language` therefore cannot work everywhere: on developer.bondy.io
 * it would 404, and on the docs host `/router` is ambiguous between the
 * marketing page and the router documentation.
 *
 * So each entry records WHICH property owns it, and `resolveLinks(self)`
 * turns that into an href for the site asking. A link to your own property
 * stays relative — which keeps VitePress's client-side routing and, more
 * importantly, keeps `vitepress dev` on localhost from sending you to
 * production the moment you click the nav. Everything else becomes absolute.
 */

export const ORIGINS = {
  website: 'https://bondy.io',
  docs: 'https://developer.bondy.io',
  lang: 'https://lang.bondy.io'
}

/** Top-level navigation, in bar order. `site` names the owning property. */
export const SITE_LINKS = [
  { id: 'home', text: 'Home', site: 'website', path: '/' },
  { id: 'language', text: 'Language', site: 'website', path: '/language' },
  { id: 'router', text: 'Fabric', site: 'website', path: '/router' },
  { id: 'docs', text: 'Docs', site: 'docs', path: '/' },
  { id: 'dispatches', text: 'Dispatches', site: 'website', path: '/blog/' },
  { id: 'community', text: 'Community', site: 'website', path: '/community/' },
  { id: 'support', text: 'Support', site: 'website', path: '/support' }
]

/**
 * Documentation sets, for the portal index on developer.bondy.io.
 *
 * The router and protocol sets live on the docs host itself; the language
 * docs are generated from Bondy source and deploy separately.
 *
 * The protocol is a set of its own because its reader is not the router's:
 * someone writing a WAMP component does not need to know how Bondy is
 * configured or operated. It is also where BAMP will slot in, as a fourth
 * entry and no other change.
 */
export const DOC_SETS = [
  {
    id: 'router-docs',
    text: 'Bondy Fabric',
    blurb: 'Run, configure and operate the router.',
    site: 'docs',
    path: '/router'
  },
  {
    id: 'wamp-docs',
    text: 'WAMP',
    blurb: 'The protocol: routed RPC and publish/subscribe, for developers writing components.',
    site: 'docs',
    path: '/wamp'
  },
  {
    id: 'lang-docs',
    text: 'Bondy Language',
    blurb: 'The language reference, generated from source.',
    site: 'lang',
    path: '/'
  }
]

/**
 * The Pagefind bundles that make up site-wide search.
 *
 * Each deploy indexes its own built output at deploy time and publishes the
 * bundle beside its pages; the search box merges them in the browser at query
 * time. That is what keeps search site-wide WITHOUT recoupling the builds —
 * no repo needs another repo's pages to index its own.
 *
 * Reading another property's bundle is now a cross-origin request, so each
 * site must serve `/pagefind/*` with `Access-Control-Allow-Origin`. Without
 * it the fetch fails and that group silently returns nothing — see the
 * `public/_headers` file in each site.
 */
export const SEARCH_BUNDLES = [
  { id: 'website', label: 'bondy.io', site: 'website' },
  { id: 'docs', label: 'Docs', site: 'docs' },
  { id: 'lang', label: 'Language docs', site: 'lang' }
]

/**
 * Resolve an entry's href for the property doing the rendering.
 *
 * `self` is one of the ORIGINS keys. Own-property links stay relative;
 * everything else gets the owning property's origin.
 */
function href(entry, self) {
  return entry.site === self ? entry.path : ORIGINS[entry.site] + entry.path
}

export function resolveLinks(self = 'website') {
  return SITE_LINKS.map((l) => ({ ...l, href: href(l, self) }))
}

export function resolveDocSets(self = 'website') {
  return DOC_SETS.map((d) => ({ ...d, href: href(d, self) }))
}

/**
 * Bundle paths for the property doing the rendering. The own bundle is
 * relative so it works under `vitepress dev` and `preview`; the other two
 * are absolute and depend on the CORS headers described above.
 */
export function resolveBundles(self = 'website') {
  return SEARCH_BUNDLES.map((b) => {
    const origin = b.site === self ? '' : ORIGINS[b.site]
    return { ...b, bundlePath: `${origin}/pagefind/`, baseUrl: `${origin}/` }
  })
}

export const GITHUB = 'https://github.com/bondy-io'
export const GITHUB_ROUTER = 'https://github.com/bondy-io/bondy'
export const LEAPSIGHT = 'https://leapsight.com'
export const LICENSE = 'https://www.apache.org/licenses/LICENSE-2.0'
