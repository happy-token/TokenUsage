export type ActivityType =
  | 'feature'
  | 'debugging'
  | 'refactoring'
  | 'testing'
  | 'git'
  | 'build-deploy'
  | 'exploration'
  | 'planning'
  | 'brainstorming'
  | 'conversation'

export type WasteImpact = 'high' | 'medium' | 'low'
export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface WasteFinding {
  id: string
  title: string
  explanation: string
  impact: WasteImpact
  tokensSaved: number
  fix: {
    type: 'paste' | 'command' | 'file-content'
    label: string
    text: string
  }
  trend?: 'active' | 'improving'
}

export interface ParsedSession {
  sessionId: string
  projectId: string
  projectName: string
  startTime: number
  endTime: number
  durationMs: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUsd: number
  model: string
  gitBranch: string
  ccVersion: string
  turns: ParsedTurn[]
}

export interface ParsedTurn {
  turnId: string
  sessionId: string
  timestamp: number
  role: 'user' | 'assistant'
  userMessage?: string
  toolNames: string[]
  bashCommands: string[]
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface ProjectRow {
  project_id: string
  name: string
  display_name: string | null
  total_cost: number
  total_sessions: number
  last_activity: number | null
  cumulative_cache_hit_rate: number
}

export interface SessionRow {
  session_id: string
  project_id: string
  start_time: number
  end_time: number | null
  duration_ms: number | null
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  cost_usd: number
  model: string | null
  git_branch: string | null
  cc_version: string | null
}
