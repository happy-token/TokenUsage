// Shared types mirrored from src/main/types.ts for use in renderer
// Keep in sync manually — do not import main-process types directly in renderer

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

export interface Win {
  id: string
  text: string
}

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
