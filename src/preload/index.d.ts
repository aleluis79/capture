import type { CapturaApi } from '@shared/api'

declare global {
  interface Window {
    api: CapturaApi
  }
}

export {}
