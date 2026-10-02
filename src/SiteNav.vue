<!-- The Bondy top bar, worn by every Bondy property.
     
     Primary row: wordmark · the canonical site sections (see sitemap.js) ·
     search, GitHub, night toggle and an optional call-to-action. One row
     only: page-level context such as a breadcrumb or a version picker
     belongs with the page, not in the site-wide bar.
     Under 1149px the row collapses into a full-screen burger drawer; under
     768px the drawer also absorbs the CTA from the header row, since it
     doesn't fit beside the logo and toggle at phone widths. Search stays in
     the header at every width instead — chrome.css shrinks it to an
     icon-only button rather than moving it, since search is the one control
     the placement brief calls out as needing to stay directly reachable
     without opening the drawer.

     What differs between properties goes in a slot, not a fork:

       #search   the site's own search box (Algolia, Pagefind, ...)
       #cta      a call-to-action pill

     `layout` picks how the bar sits:

       sticky  (default)  pinned to the top of the viewport at every width,
                          for the marketing site
       docs               replaces VitePress's VPNav wholesale, so it goes
                          fixed at >=960px and chrome.css declares its height
                          as --vp-nav-height to keep every VitePress offset
                          (sidebar, content, local nav) correct. Below 960px
                          it's sticky rather than fixed, still pinned but
                          staying in flow so it needs no extra offset.
-->
<script setup>
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount, provide } from 'vue'
import { useData, useRoute } from 'vitepress'
import { resolveLinks, resolveHome, GITHUB } from './sitemap.js'
import BondyWordmark from './BondyWordmark.vue'
import { lockScroll, unlockScroll, holdsLock } from './scrollLock.js'

const props = defineProps({
  /** id from SITE_LINKS marking which section this site is. */
  active: { type: String, default: '' },
  /**
   * Which property this site IS — an ORIGINS key ('website' | 'docs' |
   * 'lang'). Links to the other properties become absolute; links to this
   * one stay relative, so client-side routing and `vitepress dev` on
   * localhost both keep working.
   */
  self: { type: String, default: 'website' },
  github: { type: String, default: GITHUB },
  layout: { type: String, default: 'sticky' }
})

// `hidden` entries still resolve — the wordmark uses home — but stay out of
// the bar, which is what keeps the bar short as lines are added.
const links = computed(() => resolveLinks(props.self).filter((l) => !l.hidden))
const homeHref = computed(() => resolveHome(props.self))

const { isDark } = useData()
const route = useRoute()
const open = ref(false)

// A portal target for SiteSearch's desktop dropdown (the mobile/tablet sheet
// teleports to `<body>` instead — see SiteSearch.vue), a DOM sibling of `.top`
// for the same reason `.mmenu` below is one instead of a child: `.top`
// carries a permanent `backdrop-filter`, and nesting another
// `backdrop-filter` element inside it (the search panel) turned out to
// render unreliably on more than one machine — computed styles showed the
// right blur value, but nothing visibly blurred. `.mmenu` sidesteps the
// same family of problem by living outside `.top`'s subtree entirely.
//
// SiteSearch can't place its own markup here — it's slotted deep inside
// `.top` (`.wrap > .r > .csearch`) wherever the consuming site puts it — so
// it reaches this element via `<Teleport>` instead. A plain CSS-selector
// target (`to=".chrome-nav"`) doesn't work for that: Vue requires a
// Teleport's target to exist independently of the app's own render tree
// before mount, and this element is rendered by that same tree. Providing
// the actual DOM node instead of a selector string sidesteps that — Vue
// just needs a valid Node by the time the teleport isn't `disabled`, not
// one `document.querySelector` can already find — and reactivity plus
// SiteSearch's own `:disabled="!searchPortalEl"` cover the brief window
// before this ref is populated by keeping the content in place until it is.
const searchPortal = ref(null)
provide('searchPortalEl', searchPortal)

// Close the burger on navigation.
watch(() => route.path, () => (open.value = false))

// Lock page scroll behind the full-screen drawer (see scrollLock.js for how
// and why `body` is pinned). Guarded for SSR inside the helper, where `open`
// never actually flips, but a shared package should not assume a DOM.
// Unlock can run synchronously (see `onMenuClick`), so the `open` watcher
// below and a link click can both call it safely.
const lockOwner = Symbol('drawer')
const lock = () => lockScroll(lockOwner)
const unlock = () => unlockScroll(lockOwner)
watch(open, (v) => (v ? lock() : unlock()))

// Closes the drawer when any link inside it is followed. A `#section` link
// (the CTA pill, the `mobileExtra` links) doesn't change `route.path`, so the
// route watcher above never fires for it, and without this the drawer stayed
// open with `body` still pinned — VitePress's scroll-to-anchor then had no
// document left to scroll, and the link appeared to do nothing.
//
// VitePress's router listens for clicks on `window` in the CAPTURE phase, so
// it handles this same click before this handler ever runs, and it measures
// the anchor target synchronously right then (`scrollTo` in its router.js:
// `scrollY + target.getBoundingClientRect().top - scrollOffset`). At that
// point `body` is still pinned: `scrollY` reads 0 and the target's rect is
// shifted by `-savedScrollY` (and pinning also changes the document's height),
// so the position it queues is wrong — in testing it landed anywhere from a
// few hundred to ~2000px off, depending on how far down the page the drawer
// was opened. Nothing this handler does can run before that measurement.
//
// So for a same-page anchor, unlock (restoring the real scroll position and
// layout) and then re-send the click: the router handles the replay against
// the true geometry and queues a second, correct scroll. Both run in the same
// animation frame with the correct one last, so the reader sees only it. The
// hash is already in the URL by then, so the replay adds no history entry.
//
// Skips `target="_blank"` links (the GitHub link): they leave this page open
// behind them, so the drawer should stay as the reader left it.
let replaying = false
function onMenuClick(e) {
  if (replaying) return
  const a = e.target.closest?.('a')
  if (!a || a.target === '_blank') return
  const wasLocked = holdsLock(lockOwner)
  open.value = false
  unlock()
  if (wasLocked && a.hash && a.origin === location.origin && a.pathname === location.pathname) {
    replaying = true
    a.click()
    replaying = false
  }
}

// Drives the desktop-only scroll-to-pill effect in chrome.css (see the
// "scroll-triggered pill" block), on both layouts. The class is harmless at
// 1024px and below, where that block doesn't apply, so this listener doesn't
// need to know which width it's running under.
const scrolled = ref(false)
function updateScrolled() {
  scrolled.value = window.scrollY > 50
}

// Keyboard use of the drawer. While it is closed the template marks it
// `inert`: it is only faded out (opacity, never display:none, so the fade
// can run), and without `inert` its links stayed in the Tab order below
// 1150px, focusable while invisible. While it is open, the bar and the
// drawer are the only controls on screen (the drawer covers the page), so
// focus moves into the drawer, Tab and Shift+Tab cycle through the visible
// controls of the bar and the drawer, and Escape closes it and gives focus
// back to the burger. The bar's search button opens the search sheet on
// focus, and the sheet is teleported to <body>, so an open sheet's controls
// join the cycle; Escape inside it is left to SiteSearch, which closes the
// sheet first, and a second Escape closes the drawer.
const header = ref(null)
const burger = ref(null)
const drawer = ref(null)
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
function visibleFocusables() {
  const panel = document.querySelector('.csearch-panel')
  return [header.value, panel]
    .filter(Boolean)
    .flatMap((root) => [...root.querySelectorAll(FOCUSABLE)])
    .filter((el) => el.getClientRects().length > 0 && !el.closest('[inert]'))
}
function onKeydown(e) {
  if (!open.value) return
  if (e.key === 'Escape') {
    if (e.target.closest?.('.csearch-panel')) return
    open.value = false
    burger.value?.focus()
  } else if (e.key === 'Tab') {
    // Every Tab is moved by hand, not only the ones at either end: the
    // sheet sits at the end of <body>, so the browser's own order between
    // the header and it runs through the whole page.
    const els = visibleFocusables()
    if (!els.length) return
    e.preventDefault()
    const i = els.indexOf(document.activeElement)
    const next = i === -1 ? (e.shiftKey ? els.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + els.length) % els.length
    els[next].focus()
  }
}
watch(open, async (v) => {
  if (!v) return
  await nextTick()
  drawer.value?.querySelector(FOCUSABLE)?.focus({ preventScroll: true })
})

onMounted(() => {
  if (typeof window === 'undefined') return
  updateScrolled()
  window.addEventListener('scroll', updateScrolled, { passive: true })
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('scroll', updateScrolled)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <!-- <header>: the page's banner landmark, so the wordmark and the bar's
       icon links sit inside a landmark with the primary <nav> (axe `region`).
       Styled by class only, so the element change is invisible. -->
  <header ref="header" class="bondy-chrome chrome-nav" :class="[`chrome-nav--${layout}`, { scrolled }]">
    <div class="top">
      <div class="wrap">
        <a :href="homeHref" class="lg" aria-label="Bondy home"><BondyWordmark /></a>

        <nav class="primary">
          <a
            v-for="l in links"
            :key="l.id"
            :href="l.href"
            :class="{ on: l.id === active }"
            :aria-current="l.id === active ? 'page' : undefined"
          >{{ l.text }}</a>
        </nav>

        <div class="r">
          <div v-if="$slots.search" class="csearch"><slot name="search" /></div>
          <a :href="github" class="ghlink" aria-label="GitHub" target="_blank" rel="noopener">
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
          </a>
          <button
            class="tbtn"
            type="button"
            aria-label="Toggle night mode"
            @click="isDark = !isDark"
          >
            <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/></svg>
            <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.2 8.2 0 0 1 9.5 4a8.3 8.3 0 1 0 10.5 10.5z"/></svg>
          </button>
          <div v-if="$slots.cta" class="ccta"><slot name="cta" /></div>
          <button
            ref="burger"
            class="mbtn"
            type="button"
            :aria-expanded="open"
            aria-controls="chrome-mmenu"
            aria-label="Menu"
            @click="open = !open"
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

    </div>

    <!-- See the comment on `searchPortal` above — SiteSearch teleports its
         dropdown/sheet here instead of rendering it inside `.top`. Empty
         and unstyled; chrome.css positions whatever lands inside it. -->
    <div ref="searchPortal" class="csearch-portal"></div>

    <!-- A sibling of .top, not nested inside it: .top carries the backdrop
         blur, and `backdrop-filter` establishes a containing block for
         `position: fixed` descendants exactly like `transform` does. Nested
         here, this drawer's `top: 64px; bottom: 0` would resolve against
         .top's own (64px-tall) box instead of the viewport and collapse to
         zero height. -->
    <div
      id="chrome-mmenu"
      ref="drawer"
      class="mmenu"
      :class="{ open }"
      :inert="open ? undefined : true"
    >
      <div class="mm-scroll" @click="onMenuClick">
        <div class="wrap">
          <nav class="mm-primary">
            <a
              v-for="l in links"
              :key="l.id"
              :href="l.href"
              :class="{ on: l.id === active }"
            >{{ l.text }}</a>
          </nav>

          <!-- Search stays in the header row at every width (see chrome.css'
               `.csearch-btn` — it collapses to an icon-only button rather
               than moving here), so it never needs a drawer copy. The CTA
               still does: chrome.css hides it in the header below 768px and
               reveals this copy instead, so a 375px phone never has to fit a
               CTA pill, a theme toggle and the logo in one row. -->
          <div class="mm-tools">
            <div class="mm-row">
              <a :href="github" class="mm-gh" target="_blank" rel="noopener">
                <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
                GitHub
              </a>
              <button class="mm-theme" type="button" @click="isDark = !isDark">
                <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/></svg>
                <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.2 8.2 0 0 1 9.5 4a8.3 8.3 0 1 0 10.5 10.5z"/></svg>
                <span class="to-dark">Dark mode</span>
                <span class="to-light">Light mode</span>
              </button>
            </div>
            <div v-if="$slots.cta" class="mm-cta"><slot name="cta" /></div>
          </div>

          <div v-if="$slots.mobileExtra" class="mm-sub"><slot name="mobileExtra" /></div>
        </div>
      </div>
    </div>
  </header>

  <!-- Stands in for the height `position: fixed` (see chrome.css, applied to
       the `sticky` layout at <=1024px) takes out of flow. Not needed for
       `docs`: that layout compensates through VitePress's own
       --vp-nav-height instead. -->
  <div v-if="layout === 'sticky'" class="chrome-nav-spacer" aria-hidden="true" />
</template>
