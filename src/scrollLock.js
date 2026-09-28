// Page scroll lock shared by everything in the chrome that covers the page
// (the burger drawer in SiteNav, the mobile search sheet in SiteSearch).
//
// Pins `body` with `position: fixed` at the negative scroll offset, rather
// than the simpler `documentElement.style.overflow = 'hidden'`. iOS Safari
// has a long-standing bug where `overflow: hidden` on `html` doesn't reliably
// stop background touch-scroll — the page behind an overlay can still creep,
// which drags a `position: fixed` overlay out of registration with the
// viewport mid-scroll and reads as it clipping or tearing. Fixing `body` in
// place sidesteps that: there's nothing left for a stray touch to scroll.
// `scrollY` is saved so unlocking restores the exact reading position instead
// of jumping to the top.
//
// Pinning `body` also removes the document's own scrollbar, which on a
// non-overlay-scrollbar platform (Windows/Linux desktop Chrome, tablets with
// a mouse) widens the sticky/fixed bar's containing block by the scrollbar's
// track the instant the lock engages — the bar has no scrollbar to lay out
// next to any more, so it claims that width, and its right-aligned icons
// (search, GitHub, theme toggle) jump sideways. `--chrome-sbw`, read by
// `.chrome-nav--sticky`/`--docs` in chrome.css, compensates with matching
// right padding for exactly as long as the lock is held, so the bar's
// visible width — and the icons' position — never changes.
//
// Holders are tracked by owner rather than by a boolean, so two overlays that
// overlap in time (search opened over the drawer) can't release each other's
// lock: the page unpins only when the LAST owner lets go. Each owner's
// lock/unlock is idempotent, and unlock runs synchronously, so a watcher and a
// click handler can both call it without a second call re-scrolling to a
// stale position.
const owners = new Set()
let savedScrollY = 0

export function holdsLock(owner) {
  return owners.has(owner)
}

export function lockScroll(owner) {
  if (typeof document === 'undefined' || owners.has(owner)) return
  owners.add(owner)
  if (owners.size > 1) return
  const sbw = window.innerWidth - document.documentElement.clientWidth
  document.documentElement.style.setProperty('--chrome-sbw', `${sbw}px`)
  savedScrollY = window.scrollY
  document.body.style.position = 'fixed'
  document.body.style.top = `-${savedScrollY}px`
  document.body.style.left = '0'
  document.body.style.right = '0'
}

export function unlockScroll(owner) {
  if (typeof document === 'undefined' || !owners.delete(owner)) return
  if (owners.size) return
  document.body.style.position = ''
  document.body.style.top = ''
  document.body.style.left = ''
  document.body.style.right = ''
  document.documentElement.style.removeProperty('--chrome-sbw')
  window.scrollTo(0, savedScrollY)
}
