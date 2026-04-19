/// <reference types="vite/client" />

import type { TokenUsageAPI } from '../../preload'

declare global {
  interface Window {
    claudeInsight: TokenUsageAPI
  }
}
