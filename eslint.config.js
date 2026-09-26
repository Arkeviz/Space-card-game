import antfu from '@antfu/eslint-config'

const clientSrc = 'apps/client/src'

/** Запреты, общие для всего клиента: deep imports и прямой импорт global. */
const commonPatterns = [
  {
    regex: '^@/modules/[^/]+/.+',
    message: 'FEOD: импортируйте модуль через его public API (@/modules/<name>).',
  },
  {
    regex: '^@/global(/|$)',
    message: 'FEOD: global не импортируется напрямую.',
  },
]

/** Слои FEOD: common → modules → pages → app. Значение - слои, которые импортировать нельзя. */
const forbiddenByLayer = {
  common: ['app', 'pages', 'modules'],
  modules: ['app', 'pages'],
  pages: ['app'],
  app: [],
}

const layerBlocks = Object.entries(forbiddenByLayer).map(([layer, forbidden]) => ({
  files: [`${clientSrc}/${layer}/**`],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        ...commonPatterns,
        ...forbidden.map(target => ({
          regex: `^@/${target}(/|$)`,
          message: `FEOD: слой «${layer}» не может импортировать «${target}».`,
        })),
      ],
    }],
  },
}))

export default antfu(
  {
    typescript: true,
    vue: { a11y: true },
    ignores: ['**/dist/**', '.claude/**'],
  },
  ...layerBlocks,
)
