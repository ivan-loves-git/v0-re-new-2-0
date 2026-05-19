import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const localIgnores = {
  ignores: [
    '.next/**',
    '.claude/**',
    '_archive/**',
    'coverage/**',
    'node_modules/**',
    'scripts/**',
    'scripts/e2e-tests/**',
    'tsconfig.tsbuildinfo',
  ],
}

const prototypeRules = {
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-empty-object-type': 'warn',
    'import/no-anonymous-default-export': 'off',
    'react/no-unescaped-entities': 'off',
    'react-hooks/error-boundaries': 'warn',
    'react-hooks/purity': 'warn',
    'react-hooks/set-state-in-effect': 'warn',
    'react-hooks/static-components': 'warn',
  },
}

const eslintConfig = [
  localIgnores,
  ...nextCoreWebVitals,
  ...nextTypescript,
  prototypeRules,
]

export default eslintConfig
