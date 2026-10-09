/**
 * v-reveal : un bloc encore hors de l'écran apparaît en fondu quand on l'atteint. Ce qui est déjà
 * visible au chargement n'est jamais masqué, et rien ne bouge si le système demande de réduire
 * les animations.
 */
const observers = new WeakMap<HTMLElement, IntersectionObserver>()

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive<HTMLElement>('reveal', {
    getSSRProps: () => ({}),
    mounted(element) {
      if (!('IntersectionObserver' in window)) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      if (element.getBoundingClientRect().top < window.innerHeight) return

      element.classList.add('reveal')
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return
          element.classList.add('is-visible')
          observer.disconnect()
        },
        { rootMargin: '0px 0px -8% 0px' },
      )
      observer.observe(element)
      observers.set(element, observer)
    },
    unmounted(element) {
      observers.get(element)?.disconnect()
      observers.delete(element)
    },
  })
})
