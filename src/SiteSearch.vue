<!-- Site-wide search across every Bondy deploy.

     Each deploy indexes its own built output at deploy time and publishes a
     Pagefind bundle beside its pages. This box loads all of them and queries
     each one, so no repo ever needs another repo's pages in order to index its
     own — which is what lets the three sites deploy independently and still
     share one search. Nothing is fetched from a server we run.

     Why one instance PER BUNDLE rather than Pagefind's mergeIndex():

     mergeIndex blends results into a single ranked list, but each bundle
     scores terms against its own corpus, so a term that is rare in one and
     common in another ranks by the rare corpus first. Measured on the real
     content: searching "realm" with mergeIndex put the Router docs' own
     realms page at #15 and returned no Router results at all in the top 12,
     because the Language book's rarer uses outscored them. Querying each
     bundle separately and grouping the results puts it back at #1, since
     ranking is then only ever compared within one corpus. The grouped
     presentation is also the more useful one: a reader searching "realm"
     usually knows whether they want the router or the language.

     Pagefind's assets only exist in built output, so under `vitepress dev`
     there is no bundle to load and the box says so instead of throwing. -->
<script setup>
import { ref, shallowRef, computed, watch, onBeforeUnmount, onMounted, nextTick, inject } from 'vue'
import { resolveBundles } from './sitemap.js'
import { lockScroll, unlockScroll } from './scrollLock.js'

const props = defineProps({
  /**
   * Which property this site is — an ORIGINS key ('website' | 'docs' |
   * 'lang'). Its own bundle is fetched from a relative path, so `vitepress
   * dev` and `preview` search their own build rather than production, and
   * is listed first since it is the likeliest hit. The other properties'
   * bundles are absolute and need CORS on /pagefind/* at their origin.
   */
  self: { type: String, default: 'website' },
  /** Override the resolved bundle list entirely. */
  bundles: { type: Array, default: null },
  /** Results shown per group. */
  perGroup: { type: Number, default: 5 }
})

const open = ref(false)
const status = ref('')
const term = ref('')
const groups = shallowRef([])
const instances = shallowRef(null)
let timer = null

// Keyboard navigation. Real focus stays in the input the whole time (so you
// can keep typing to refine the query) and `active` is an index into the
// flattened hit list across every group — -1 means "nothing highlighted".
// Exposed to assistive tech through aria-activedescendant on the input.
const active = ref(-1)
const flat = computed(() => groups.value.flatMap((g) => g.hits))
const optId = (i) => `csearch-opt-${i}`

// Ordered so this site's own results come first.
const ordered = () => {
  const all = props.bundles ?? resolveBundles(props.self)
  const own = all.filter((b) => b.site === props.self)
  const rest = all.filter((b) => b.site !== props.self)
  return [...own, ...rest]
}

async function ensureLoaded() {
  if (instances.value) return true
  const loaded = []
  for (const b of ordered()) {
    try {
      // Distinct module URLs give distinct Pagefind instances, which is what
      // keeps each bundle's ranking independent.
      const m = await import(/* @vite-ignore */ `${b.bundlePath}pagefind.js`)
      await m.options({ basePath: b.bundlePath })
      await m.init()
      loaded.push({ ...b, m })
    } catch {
      // A bundle that is not published yet simply does not contribute.
    }
  }
  if (!loaded.length) {
    status.value = 'Search index unavailable — it is built with the site.'
    return false
  }
  instances.value = loaded
  return true
}

async function run() {
  const q = term.value.trim()
  active.value = -1
  if (!q) { groups.value = []; status.value = ''; return }
  if (!(await ensureLoaded())) return

  const out = await Promise.all(
    instances.value.map(async (i) => {
      const res = await i.m.search(q)
      const hits = await Promise.all(
        res.results.slice(0, props.perGroup).map((r) => r.data())
      )
      return { label: i.label, total: res.results.length, hits }
    })
  )
  // `start` is each group's offset into the flattened list, so a hit's
  // global index is `g.start + j` in the template.
  let start = 0
  groups.value = out.filter((g) => g.hits.length).map((g) => {
    const withStart = { ...g, start }
    start += g.hits.length
    return withStart
  })
  active.value = -1
  status.value = groups.value.length ? '' : 'No results.'
  // A new query's first hit must be on screen: without this, a list the
  // reader had scrolled for the previous query keeps its offset and the top
  // result sits above the fold.
  await nextTick()
  if (resultsEl.value) resultsEl.value.scrollTop = 0
}

function onInput() {
  clearTimeout(timer)
  active.value = -1
  timer = setTimeout(run, 180)
}

const resultsEl = ref(null)

async function move(delta) {
  const n = flat.value.length
  if (!n) return
  // Down from nothing lands on the first hit; Up from the first hit goes
  // back to the input (-1); both ends stop rather than wrap.
  active.value = Math.min(n - 1, Math.max(-1, active.value + delta))
  await nextTick()
  const el = resultsEl.value
  if (!el) return
  if (active.value <= 0) { el.scrollTop = 0; return }
  el.querySelector(`#${optId(active.value)}`)?.scrollIntoView({ block: 'nearest' })
}

function onKeydown(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
  else if (e.key === 'Enter' && active.value >= 0) {
    e.preventDefault()
    const hit = flat.value[active.value]
    if (hit) window.location.href = hit.url
  }
  else if (e.key === 'Enter' && isMobile.value) {
    // The keyboard's "Search" key. Nothing is highlighted to open, so run the
    // query now (skipping the debounce) and drop the keyboard: it is what
    // covers the lower half of the sheet, so dismissing it is how a reader
    // gets to see the full list.
    e.preventDefault()
    clearTimeout(timer)
    run()
    inputEl.value?.blur()
  }
  else if (e.key === 'Escape') hide()
}

// A document-level listener drives outside-click-to-close at every width,
// rather than a click handler on the backdrop itself: below 1024px
// (chrome.css) the panel becomes a fixed top-anchored sheet with a dimmed
// `.csearch-backdrop` behind it purely for visual/touch affordance, but
// that backdrop still sits outside `panelEl`, so a tap on it reaches this
// same listener and closes the sheet without any handler of its own.
// Desktop has no backdrop element at all — the panel there is a floating
// card, not a dimmed modal — and needs none for the same reason. Bound
// only while open, so a search box that's never been opened costs nothing
// and every open/close pair leaves zero listeners behind.
const btnEl = ref(null)
const panelEl = ref(null)
const inputEl = ref(null)
function onDocClick(e) {
  if (btnEl.value?.contains(e.target)) return
  if (panelEl.value?.contains(e.target)) return
  hide()
}

// Where the backdrop/panel below render (`<Teleport :to="teleportTarget"
// :disabled="!teleportTarget">`). This component is slotted wherever
// `.chrome-nav .top` puts it, and `.top` carries a permanent
// `backdrop-filter` (the glass bar), so the two shapes each escape it
// differently:
//
// Below 1024px the panel is a `position: fixed` top-anchored sheet docked
// under the header, and it teleports to `<body>`. Per spec,
// `backdrop-filter` on an ancestor establishes the containing block for
// `position: fixed` descendants the same way `transform` does, so nested
// inside `.top` the sheet would anchor against the 64px bar instead of the
// viewport and render squashed into the header. `<body>` (not somewhere
// inside `.chrome-nav`) matters too: everything under `.chrome-nav` is also
// under the package-wide `.bondy-chrome * { margin: 0; padding: 0 }` reset
// (and the marketing site's own `.torso *` one), which silently strips the
// sheet's padding and side insets — that's what "the
// mobile sheet looks like the desktop one / cramped" was.
//
// At 1025px+ the panel is `position: absolute` under the bar, which the
// containing-block rule doesn't even cover — but `backdrop-filter` on the
// panel ITSELF rendered unreliably on more than one machine while it stayed
// a descendant of an element that also uses `backdrop-filter`: computed
// styles showed the right blur value, but nothing visibly blurred. So it
// teleports to `searchPortalEl`, a DOM sibling of `.top` (like `.mmenu`)
// that `SiteNav.vue` provides. That has to be an injected DOM node rather
// than a `to=".chrome-nav"` selector: Vue requires a Teleport target to
// exist independently of the app's own render tree before mount, and
// `.chrome-nav` is rendered by that same tree. It stays `disabled` (renders
// in place) until that ref is populated, so Teleport can never be handed an
// invalid target — same for an older `SiteNav.vue` that doesn't provide it.
const searchPortalEl = inject('searchPortalEl', null)
const isMobile = ref(false)
let mql = null
function syncIsMobile(e) { isMobile.value = e.matches }
onMounted(() => {
  if (typeof window === 'undefined') return
  mql = window.matchMedia('(max-width: 1024px)')
  isMobile.value = mql.matches
  mql.addEventListener('change', syncIsMobile)
})
const teleportTarget = computed(() =>
  isMobile.value ? 'body' : (searchPortalEl?.value ?? null)
)

// While the mobile sheet is open (below 1024px only — the desktop panel is a
// floating card and leaves the page alone):
//
// 1. Pin the page (scrollLock.js), the same way the burger drawer does. Left
//    unpinned, the keyboard opening lets the browser pan or scroll the
//    document behind the sheet to "reveal" the focused input.
//
// 2. Publish where the visible area ends as `--csearch-vv-bottom` on <html>,
//    which chrome.css uses to cap the sheet's height. `vh`/`dvh` can't be
//    used for this: on iOS Safari, and by default on Chrome for Android, the
//    on-screen keyboard overlays the page WITHOUT shrinking the layout
//    viewport, so those units still measure a screen with no keyboard and a
//    sheet sized from them runs behind it. `visualViewport` is the one API
//    that reports the region the reader can actually see. `offsetTop` is
//    added because the visual viewport can be panned inside the layout one
//    (pinch-zoom, or iOS nudging the view); CSS `top`/`max-height` here are
//    in layout coordinates, so the visible bottom edge is offsetTop + height.
//    Browsers without it fall back to the `100dvh` in the stylesheet.
let vv = null
function syncVisibleBottom() {
  if (!vv) return
  document.documentElement.style.setProperty('--csearch-vv-bottom', `${vv.offsetTop + vv.height}px`)
}
function bindMobileLayer() {
  lockScroll(lockOwner)
  vv = window.visualViewport ?? null
  if (!vv) return
  vv.addEventListener('resize', syncVisibleBottom)
  vv.addEventListener('scroll', syncVisibleBottom)
  syncVisibleBottom()
}
function releaseMobileLayer() {
  if (vv) {
    vv.removeEventListener('resize', syncVisibleBottom)
    vv.removeEventListener('scroll', syncVisibleBottom)
    vv = null
  }
  if (typeof document !== 'undefined') {
    document.documentElement.style.removeProperty('--csearch-vv-bottom')
  }
  unlockScroll(lockOwner)
}
const lockOwner = Symbol('search')
// Runs before the render that mounts the sheet (default `pre` flush), i.e.
// before `show()` focuses the input — the page is already pinned when the
// keyboard starts to open, not after.
watch([open, isMobile], ([o, m]) => (o && m ? bindMobileLayer() : releaseMobileLayer()))

// The HTML `autofocus` attribute is unreliable on an element that appears
// via `v-if` inside a `<Transition>`: Vue moves/clones nodes during the
// transition's own DOM dance, and whether the attribute still "counts" as
// the browser's one auto-focus opportunity at insertion time varies by
// engine — Chrome mostly honors it, but it's exactly the kind of thing
// that silently regresses on a Vue/version bump. Focusing explicitly once
// the input has actually landed in the DOM (`nextTick`) is guaranteed
// regardless, which is what makes "open it and start typing" reliable.
async function show() {
  if (open.value) return
  open.value = true
  await nextTick()
  // `preventScroll`: without it the browser scrolls the page to bring the
  // freshly-mounted input into view, which is the "page jumps when I tap
  // search" bug. The sheet is already where the reader can see it.
  inputEl.value?.focus({ preventScroll: true })
  document.addEventListener('mousedown', onDocClick)
  await ensureLoaded()
}
function hide() {
  open.value = false
  term.value = ''
  groups.value = []
  active.value = -1
  status.value = ''
  document.removeEventListener('mousedown', onDocClick)
}

// The button also opens on `focus` (so tabbing to it, or a mouse click's
// own focus step, both count as "focus the search input" per the design
// brief) — which races a plain `@click="open ? hide() : show()"`: a mouse
// click focuses the button BEFORE its click event fires, so by the time
// click ran, `open` was already flipped true by focus and the same click
// immediately closed what it just opened. Capturing `open` on `mousedown`,
// before focus can touch it, gives the click handler the PRE-click state
// to toggle from instead.
let wasOpenOnMousedown = false
function onBtnMousedown() { wasOpenOnMousedown = open.value }
function onBtnClick() { if (wasOpenOnMousedown) hide(); else show() }

onBeforeUnmount(() => {
  clearTimeout(timer)
  document.removeEventListener('mousedown', onDocClick)
  mql?.removeEventListener('change', syncIsMobile)
  releaseMobileLayer()
})
</script>

<template>
  <button
    ref="btnEl"
    class="csearch-btn"
    type="button"
    :aria-expanded="open"
    aria-label="Search"
    @mousedown="onBtnMousedown"
    @click="onBtnClick"
    @focus="show"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
      <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" />
    </svg>
    <span>Search</span>
  </button>

  <!-- See the comment on `teleportTarget` above: `<body>` for the mobile
       sheet, `SiteNav`'s sibling-of-`.top` portal for the desktop panel.
       Both the backdrop and the panel move together so the sheet and its
       scrim are always DOM siblings. -->
  <Teleport :to="teleportTarget" :disabled="!teleportTarget">
    <!-- Mobile/tablet only (chrome.css hides it above 1024px): a dimmed
         scrim behind the sheet. Deliberately plain opacity, no blur —
         see the note on `.csearch-panel` in chrome.css about why a blurred
         layer can't also be the one that slides. -->
    <Transition name="csearch-backdrop">
      <div v-if="open" class="csearch-backdrop" aria-hidden="true" />
    </Transition>

    <Transition name="csearch">
      <div v-if="open" ref="panelEl" class="csearch-panel" role="dialog" aria-label="Search">
        <div class="csearch-head">
          <input
            ref="inputEl"
            v-model="term"
            type="search"
            enterkeyhint="search"
            placeholder="Search all Bondy documentation…"
            aria-label="Search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="csearch-listbox"
            :aria-expanded="flat.length > 0"
            :aria-activedescendant="active >= 0 ? optId(active) : undefined"
            @input="onInput"
            @keydown="onKeydown"
          />
          <button type="button" class="csearch-close" aria-label="Close search" @click="hide">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <p v-if="status" class="csearch-msg">{{ status }}</p>
        <div id="csearch-listbox" ref="resultsEl" class="csearch-results" role="listbox">
          <!-- A `div`, not a `section`: the marketing site styles a bare
               `.torso section` with 100px of vertical padding, which leaked
               into every result group and pushed the first hit ~180px below
               the input. -->
          <div v-for="g in groups" :key="g.label" class="csearch-group" role="group" :aria-label="g.label">
            <h4 aria-hidden="true">{{ g.label }} <span>{{ g.total }}</span></h4>
            <a
              v-for="(h, j) in g.hits"
              :id="optId(g.start + j)"
              :key="h.url"
              :href="h.url"
              role="option"
              tabindex="-1"
              :class="{ 'is-active': g.start + j === active }"
              :aria-selected="g.start + j === active"
            >
              <strong>{{ h.meta?.title || h.url }}</strong>
              <span v-html="h.excerpt" />
            </a>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
