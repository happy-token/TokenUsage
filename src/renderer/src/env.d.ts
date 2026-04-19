/// <reference types="vite/client" />

import type { ClaudeInsightAPI } from '../../preload'

declare global {
  interface Window {
    claudeInsight: ClaudeInsightAPI
  }
}
