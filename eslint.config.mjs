// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // La mise en forme est l'affaire de Prettier, qui ferme les balises vides (<input />).
    'vue/html-self-closing': 'off',
  },
})
