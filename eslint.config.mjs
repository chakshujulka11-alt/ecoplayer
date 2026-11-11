import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['out/**', 'dist/**', 'release/**', 'node_modules/**', 'android/**', '.gradle-home/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser }
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'src/db/**/*.ts', 'src/audio/**/*.ts', 'src/shared/**/*.ts'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['electron.vite.config.ts'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['*.config.js', '*.config.cjs', 'scripts/**/*.cjs'],
    languageOptions: { sourceType: 'script', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' }
  }
)
