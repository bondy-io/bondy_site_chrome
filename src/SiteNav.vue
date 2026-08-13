<!-- The Bondy top bar, worn by every Bondy property.
     
     Primary row: wordmark · the canonical site sections (see sitemap.js) ·
     search, GitHub, night toggle and an optional call-to-action. Optional
     secondary row via the `subbar` slot — the marketing site puts page
     section links there, the docs sites a breadcrumb and version picker.
     Under 1000px both rows collapse into a burger panel.

     What differs between properties goes in a slot, not a fork:

       #search   the site's own search box (Algolia, Pagefind, ...)
       #cta      a call-to-action pill
       #subbar   the secondary row's contents

     `layout` picks how the bar sits:

       sticky  (default)  scrolls with the page, for the marketing site
       docs               replaces VitePress's VPNav wholesale, so it goes
                          fixed at >=960px and chrome.css declares its height
                          as --vp-nav-height to keep every VitePress offset
                          (sidebar, content, local nav) correct. Below 960px
                          it stays in flow, exactly as VPNav itself does.
-->
<script setup>
import { computed, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'
import { resolveLinks, GITHUB } from './sitemap.js'
import BondyWordmark from './BondyWordmark.vue'

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

const links = computed(() => resolveLinks(props.self))

const { isDark } = useData()
const route = useRoute()
const open = ref(false)

// Close the burger on navigation.
watch(() => route.path, () => (open.value = false))
</script>

<template>
  <div class="bondy-chrome chrome-nav" :class="`chrome-nav--${layout}`">
    <div class="top">
      <div class="wrap">
        <a :href="links[0].href" class="lg" aria-label="Bondy home"><BondyWordmark /></a>

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
          <a :href="github" class="ghlink">GitHub</a>
          <button
            class="tbtn"
            type="button"
            aria-label="Toggle night mode"
            @click="isDark = !isDark"
          >
            <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/></svg>
            <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.2 8.2 0 0 1 9.5 4a8.3 8.3 0 1 0 10.5 10.5z"/></svg>
          </button>
          <slot name="cta" />
          <button
            class="mbtn"
            type="button"
            :aria-expanded="open"
            aria-label="Menu"
            @click="open = !open"
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      <div v-if="$slots.subbar" class="subbar">
        <div class="wrap"><slot name="subbar" /></div>
      </div>

      <div class="mmenu" :class="{ open }">
        <div class="wrap">
          <div class="mm-primary">
            <a
              v-for="l in links"
              :key="l.id"
              :href="l.href"
              :class="{ on: l.id === active }"
              @click="open = false"
            >{{ l.text }}</a>
          </div>
          <div v-if="$slots.mobileExtra" class="mm-sub"><slot name="mobileExtra" /></div>
          <div class="mm-foot"><a :href="github">GitHub</a></div>
        </div>
      </div>
    </div>
  </div>
</template>
