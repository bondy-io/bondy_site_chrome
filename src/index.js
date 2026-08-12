/**
 * @bondy/site-chrome — the navigation, footer and palette shared by every
 * Bondy property.
 *
 * The Bondy sites deploy independently (marketing ships bondy_website without
 * ever compiling Bondy Lang); this package is what makes them read as one
 * site. It is a build-time dependency, not a runtime include, so consuming it
 * costs a version bump and a redeploy rather than a coupled build.
 *
 * Usage, from a site's .vitepress/theme:
 *
 *   import { SiteNav, SiteFooter } from '@bondy/site-chrome'
 *   import '@bondy/site-chrome/styles/chrome.css'
 *
 *   <SiteNav active="docs" layout="docs">
 *     <template #search><VPNavBarSearch /></template>
 *     <template #subbar><Breadcrumb /></template>
 *   </SiteNav>
 */
export { default as SiteNav } from './SiteNav.vue'
export { default as SiteFooter } from './SiteFooter.vue'
export { default as BondyWordmark } from './BondyWordmark.vue'
export * from './sitemap.js'
