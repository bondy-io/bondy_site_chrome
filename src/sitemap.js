/**
 * The canonical Bondy site map.
 *
 * This is the single source of truth for the top-level navigation. Every
 * Bondy property renders the same list and marks its own entry active, so a
 * new section is added here once rather than in each site's theme.
 *
 * The three deploys share one origin (the CDN routes /docs/router/ and
 * /docs/lang/ to the bondy_docs and bondy_lang deploys), so these hrefs are
 * origin-absolute and must NOT be passed through VitePress's `withBase`:
 * a site built with `base: '/docs/router/'` would otherwise turn `/language`
 * into `/docs/router/language`.
 */
export const SITE_LINKS = [
  { id: 'home', text: 'Home', href: '/' },
  { id: 'language', text: 'Language', href: '/language' },
  { id: 'router', text: 'Router', href: '/router' },
  { id: 'docs', text: 'Docs', href: '/docs/' },
  { id: 'dispatches', text: 'Dispatches', href: '/blog/' },
  { id: 'community', text: 'Community', href: '/community/' },
  { id: 'support', text: 'Support', href: '/support' }
]

/** Documentation sets, for the /docs/ hub and any "see also" chrome. */
export const DOC_SETS = [
  { id: 'router-docs', text: 'Bondy Router', href: '/docs/router/' },
  { id: 'lang-docs', text: 'Bondy Language', href: '/docs/lang/' }
]

export const GITHUB = 'https://github.com/bondy-io'
export const GITHUB_ROUTER = 'https://github.com/bondy-io/bondy'
export const LEAPSIGHT = 'https://leapsight.com'
export const LICENSE = 'https://www.apache.org/licenses/LICENSE-2.0'

/**
 * The Pagefind bundles that make up site-wide search.
 *
 * Each deploy indexes its own built output at deploy time and publishes the
 * bundle beside its pages; the search box merges them in the browser at query
 * time (pagefind.mergeIndex). That is what keeps search site-wide WITHOUT
 * recoupling the builds — no repo needs another repo's pages to index its own.
 *
 * `baseUrl` is what a merged bundle's result URLs get prefixed with, since a
 * bundle indexed from its own dist root records paths relative to that root.
 */
export const SEARCH_BUNDLES = [
  { id: 'website', label: 'bondy.io', bundlePath: '/pagefind/', baseUrl: '/' },
  { id: 'router', label: 'Router docs', bundlePath: '/docs/router/pagefind/', baseUrl: '/docs/router/' },
  { id: 'lang', label: 'Language docs', bundlePath: '/docs/lang/pagefind/', baseUrl: '/docs/lang/' }
]
