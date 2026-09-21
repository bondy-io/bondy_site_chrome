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
import { ref, shallowRef, computed, onBeforeUnmount, onMounted, nextTick, inject } from 'vue'
import { resolveBundles } from './sitemap.js'

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
  groups.value = out.filter((g) => g.hits.length)
  status.value = groups.value.length ? '' : 'No results.'
}

function onInput() {
  clearTimeout(timer)
  timer = setTimeout(run, 180)
}

// A document-level listener drives outside-click-to-close at every width,
// rather than a click handler on the backdrop itself: below 1024px
// (chrome.css) the panel becomes a fixed bottom sheet with a dimmed
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
// Below 1024px the panel is a `position: fixed` bottom sheet docked to the
// true viewport edges, and it teleports to `<body>`. Per spec,
// `backdrop-filter` on an ancestor establishes the containing block for
// `position: fixed` descendants the same way `transform` does, so nested
// inside `.top` the sheet would anchor against the 64px bar instead of the
// viewport and render squashed into the header. `<body>` (not somewhere
// inside `.chrome-nav`) matters too: everything under `.chrome-nav` is also
// under the package-wide `.bondy-chrome * { margin: 0; padding: 0 }` reset
// (and the marketing site's own `.torso *` one), which silently strips the
// sheet's padding and the grabber's auto-centering — that's what "the
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
  inputEl.value?.focus()
  document.addEventListener('mousedown', onDocClick)
  await ensureLoaded()
}
function hide() {
  open.value = false
  term.value = ''
  groups.value = []
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
         scrim behind the bottom sheet. Deliberately plain opacity, no blur —
         see the note on `.csearch-panel` in chrome.css about why a blurred
         layer can't also be the one that slides. -->
    <Transition name="csearch-backdrop">
      <div v-if="open" class="csearch-backdrop" aria-hidden="true" />
    </Transition>

    <Transition name="csearch">
      <div v-if="open" ref="panelEl" class="csearch-panel" role="dialog" aria-label="Search">
        <div class="csearch-grabber" aria-hidden="true" />
        <div class="csearch-head">
          <input
            ref="inputEl"
            v-model="term"
            type="search"
            placeholder="Search all Bondy documentation…"
            aria-label="Search"
            @input="onInput"
            @keydown.esc="hide"
          />
          <button type="button" class="csearch-close" aria-label="Close search" @click="hide">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <p v-if="status" class="csearch-msg">{{ status }}</p>
        <div class="csearch-results">
          <section v-for="g in groups" :key="g.label">
            <h4>{{ g.label }} <span>{{ g.total }}</span></h4>
            <a v-for="h in g.hits" :key="h.url" :href="h.url">
              <strong>{{ h.meta?.title || h.url }}</strong>
              <span v-html="h.excerpt" />
            </a>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
