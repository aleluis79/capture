import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared')
    }
  },
  test: {
    projects: ['vitest.unit.config.mts', 'vitest.ui.config.mts'],
    passWithNoTests: true
  }
})
