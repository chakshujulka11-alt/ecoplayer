import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  expect: { timeout: 15000 },
  reporter: 'list',
  use: {
    actionTimeout: 15000
  }
})
