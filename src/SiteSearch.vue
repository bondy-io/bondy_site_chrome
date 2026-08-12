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
import { ref, shallowRef, onBeforeUnmount } from 'vue'
import { SEARCH_BUNDLES } from './sitemap.js'

const props = defineProps({
  /** This deploy's own bundle. Listed first, since it is the likeliest hit. */
  primary: { type: String, default: '/pagefind/' },
  bundles: { type: Array, default: () => SEARCH_BUNDLES },
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
  const own = props.bundles.filter((b) => b.bundlePath === props.primary)
  const rest = props.bundles.filter((b) => b.bundlePath !== props.primary)
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

async function show() { open.value = true; await ensureLoaded() }
function hide() { open.value = false; term.value = ''; groups.value = []; status.value = '' }

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <button class="csearch-btn" type="button" aria-label="Search" @click="show">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
      <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" />
    </svg>
    <span>Search</span>
  </button>

  <div
    v-if="open"
    class="csearch-modal"
    role="dialog"
    aria-modal="true"
    aria-label="Search"
    @click.self="hide"
  >
    <div class="csearch-panel">
      <div class="csearch-head">
        <input
          v-model="term"
          type="search"
          placeholder="Search all Bondy documentation…"
          aria-label="Search"
          autofocus
          @input="onInput"
          @keydown.esc="hide"
        />
        <button type="button" aria-label="Close search" @click="hide">Esc</button>
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
  </div>
</template>
