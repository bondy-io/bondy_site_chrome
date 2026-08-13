<!-- The Bondy footer.

     One wordmark + blurb block, then whatever columns the site passes, then
     a shared bottom rule. The column set is genuinely per-site (the docs
     footer lists Diataxis sections, the marketing footer lists products), so
     `columns` is a prop rather than something baked in here — but the grid,
     type, spacing and bottom rule are shared, which is what made the two
     original footers read as one family.

     `layout: 'docs'` clears VitePress's sidebar, because on a docs site this
     footer is a sibling of VitePress's Layout rather than inside its content
     column. -->
<script setup>
import { LEAPSIGHT, LICENSE } from './sitemap.js'
import BondyWordmark from './BondyWordmark.vue'

defineProps({
  /** [{ title, links: [{ text, href }] }] */
  columns: { type: Array, default: () => [] },
  blurb: { type: String, default: '' },
  /** Right-hand note on the bottom rule. */
  note: { type: String, default: 'Apache-2.0 · built on the BEAM' },
  layout: { type: String, default: 'sticky' },
  year: { type: Number, default: () => new Date().getFullYear() }
})
</script>

<template>
  <div class="bondy-chrome chrome-foot" :class="`chrome-foot--${layout}`">
    <footer class="tfoot">
      <div class="wrap">
        <div class="fgrid" :class="{ 'has-extra': $slots.extra }">
          <div class="fb">
            <span class="lg"><BondyWordmark /></span>
            <p v-if="blurb">{{ blurb }}</p>
            <slot name="blurb" />
          </div>
          <div v-for="col in columns" :key="col.title">
            <h5>{{ col.title }}</h5>
            <ul>
              <li v-for="l in col.links" :key="l.text">
                <a :href="l.href">{{ l.text }}</a>
              </li>
            </ul>
          </div>
          <slot name="extra" />
        </div>
        <div class="fbot">
          <span>© {{ year }} — <a :href="LEAPSIGHT">Leapsight</a> · Bondy contributors</span>
          <span>{{ note }}</span>
          <span><a :href="LICENSE">License</a></span>
        </div>
      </div>
    </footer>
  </div>
</template>
