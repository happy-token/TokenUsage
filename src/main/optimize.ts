import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getDb } from './db'
import type { HealthGrade, WasteFinding, WasteImpact } from './types'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface TurnRow {
  tool_names: string
  bash_commands: string
  session_id: string
}

interface SessionRow {
  session_id: string
  cache_write_tokens: number
  cost_usd: number
  cwd?: string
}

export function runOptimize(projectId: string, periodDays = 30): {
  findings: WasteFinding[]
  healthScore: number
  healthGrade: HealthGrade
} {
  const db = getDb()

  // Check cache first
  const cached = db.prepare(`
    SELECT findings_json, health_score, health_grade FROM waste_cache
    WHERE project_id = ? AND period_days = ? AND computed_at > ?
    ORDER BY computed_at DESC LIMIT 1
  `).get(projectId, periodDays, Date.now() - CACHE_TTL_MS) as {
    findings_json: string
    health_score: number
    health_grade: string
  } | undefined

  if (cached) {
    return {
      findings: JSON.parse(cached.findings_json),
      healthScore: cached.health_score,
      healthGrade: cached.health_grade as HealthGrade
    }
  }

  const since = Date.now() - periodDays * 24 * 60 * 60 * 1000

  const sessions = db.prepare(`
    SELECT session_id, cache_write_tokens, cost_usd
    FROM sessions WHERE project_id = ? AND start_time > ?
  `).all(projectId, since) as SessionRow[]

  const sessionIds = sessions.map((s) => s.session_id)
  if (sessionIds.length === 0) {
    return { findings: [], healthScore: 100, healthGrade: 'A' }
  }

  const placeholders = sessionIds.map(() => '?').join(',')
  const turns = db.prepare(`
    SELECT session_id, tool_names, bash_commands
    FROM turns WHERE session_id IN (${placeholders})
  `).all(...sessionIds) as TurnRow[]

  const findings: WasteFinding[] = []

  const f1 = detectJunkReads(turns)
  if (f1) findings.push(f1)

  const f2 = detectDuplicateReads(turns)
  if (f2) findings.push(f2)

  const f3 = detectLowReadEditRatio(turns)
  if (f3) findings.push(f3)

  const f4 = detectCacheExcess(sessions)
  if (f4) findings.push(f4)

  const f5 = detectBashOutputLimit(turns)
  if (f5) findings.push(f5)

  const f6 = detectOverloadedClaudeMd(projectId)
  if (f6) findings.push(f6)

  findings.sort((a, b) => impactOrder(a.impact) - impactOrder(b.impact))

  const healthScore = computeHealthScore(findings)
  const healthGrade = scoreToGrade(healthScore)

  db.prepare(`
    INSERT INTO waste_cache (project_id, period_days, findings_json, health_score, health_grade, computed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(projectId, periodDays, JSON.stringify(findings), healthScore, healthGrade, Date.now())

  return { findings, healthScore, healthGrade }
}

function detectJunkReads(turns: TurnRow[]): WasteFinding | null {
  const JUNK_PATTERNS = [
    /node_modules\//,
    /\.git\//,
    /\bdist\//,
    /\bbuild\//,
    /package-lock\.json/,
    /yarn\.lock/,
    /pnpm-lock\.yaml/,
    /\.next\//,
    /\.nuxt\//
  ]

  let junkCount = 0
  for (const t of turns) {
    const tools: string[] = safeParseJson(t.tool_names, [])
    if (!tools.includes('Read') && !tools.includes('FileReadTool')) continue
    const cmds: string[] = safeParseJson(t.bash_commands, [])
    for (const cmd of cmds) {
      if (JUNK_PATTERNS.some((p) => p.test(cmd))) junkCount++
    }
  }

  if (junkCount === 0) return null

  const tokensSaved = junkCount * 600
  return {
    id: 'junk-reads',
    title: 'Junk file reads',
    explanation: `${junkCount} read(s) into node_modules/, .git/, dist/, or lock files — these consume tokens without adding value.`,
    impact: 'high',
    tokensSaved,
    fix: {
      type: 'file-content',
      label: 'Add to .claudeignore',
      text: 'node_modules/\n.git/\ndist/\nbuild/\n*.lock\n.next/\n.nuxt/'
    }
  }
}

function detectDuplicateReads(turns: TurnRow[]): WasteFinding | null {
  // Group by session, track files read per session
  const sessionFiles = new Map<string, Map<string, number>>()

  for (const t of turns) {
    const tools: string[] = safeParseJson(t.tool_names, [])
    if (!tools.includes('Read') && !tools.includes('FileReadTool')) continue
    // We can't get the exact file path from tool_names alone; this is a proxy metric
    // Using bash_commands that look like file paths as a signal
    const cmds: string[] = safeParseJson(t.bash_commands, [])
    const map = sessionFiles.get(t.session_id) ?? new Map()
    for (const cmd of cmds) {
      map.set(cmd, (map.get(cmd) ?? 0) + 1)
    }
    sessionFiles.set(t.session_id, map)
  }

  let dupCount = 0
  for (const fileMap of sessionFiles.values()) {
    for (const count of fileMap.values()) {
      if (count > 1) dupCount += count - 1
    }
  }

  if (dupCount === 0) return null

  return {
    id: 'duplicate-reads',
    title: 'Duplicate file reads',
    explanation: `${dupCount} redundant read(s) — same files read multiple times within a session. Claude already has the content in context.`,
    impact: 'medium',
    tokensSaved: dupCount * 300,
    fix: {
      type: 'paste',
      label: 'Tip',
      text: 'Use /compact or check that your prompts don\'t re-request already-read files.'
    }
  }
}

function detectLowReadEditRatio(turns: TurnRow[]): WasteFinding | null {
  const EDIT_TOOLS = new Set(['Edit', 'Write', 'FileEditTool', 'FileWriteTool', 'str_replace_editor'])
  const READ_TOOLS = new Set(['Read', 'Glob', 'Grep', 'LS', 'FileReadTool'])

  let readCount = 0
  let editCount = 0

  for (const t of turns) {
    const tools: string[] = safeParseJson(t.tool_names, [])
    for (const name of tools) {
      if (READ_TOOLS.has(name)) readCount++
      if (EDIT_TOOLS.has(name)) editCount++
    }
  }

  if (editCount === 0) return null
  const ratio = readCount / editCount

  if (ratio >= 2) return null

  return {
    id: 'low-read-edit-ratio',
    title: 'Low read-to-edit ratio',
    explanation: `Read:edit ratio is ${ratio.toFixed(1)}:1 (healthy is 4:1). Editing without reading enough context leads to incorrect changes and extra retries.`,
    impact: 'medium',
    tokensSaved: 0,
    fix: {
      type: 'paste',
      label: 'Tip',
      text: 'Before editing, ask Claude to read related files first: "Read the relevant files before making any changes."'
    }
  }
}

function detectCacheExcess(sessions: SessionRow[]): WasteFinding | null {
  const THRESHOLD = 15000
  const highCacheSessions = sessions.filter((s) => s.cache_write_tokens > THRESHOLD)
  if (highCacheSessions.length === 0) return null

  const totalExcess = highCacheSessions.reduce(
    (acc, s) => acc + (s.cache_write_tokens - THRESHOLD),
    0
  )
  const tokensSaved = Math.round(totalExcess * 0.8)

  return {
    id: 'cache-excess',
    title: 'High cache write volume',
    explanation: `${highCacheSessions.length} session(s) wrote > 15,000 cache tokens. This usually means CLAUDE.md or system context is very large.`,
    impact: 'high',
    tokensSaved,
    fix: {
      type: 'paste',
      label: 'What to trim',
      text: 'Check CLAUDE.md for: duplicate rules, verbose examples, tool docs that Claude already knows, commented-out sections.'
    }
  }
}

function detectBashOutputLimit(turns: TurnRow[]): WasteFinding | null {
  const VERBOSE_PATTERNS = [
    /^cat .+/,
    /^grep .+ --/,
    /^find \/ /,
    /^npm (ls|list)/,
    /^pip list/,
    /^ps aux/,
    /^docker (ps|images|logs)/
  ]
  // Flag commands without output limiting
  const OUTPUT_LIMIT_RE = /\| (head|tail|grep|awk|cut|sed|jq)/

  let flaggedCount = 0
  for (const t of turns) {
    const cmds: string[] = safeParseJson(t.bash_commands, [])
    for (const cmd of cmds) {
      if (VERBOSE_PATTERNS.some((p) => p.test(cmd)) && !OUTPUT_LIMIT_RE.test(cmd)) {
        flaggedCount++
      }
    }
  }

  if (flaggedCount === 0) return null

  return {
    id: 'bash-output-limit',
    title: 'Bash commands with potentially large output',
    explanation: `${flaggedCount} bash command(s) may produce large output (cat, find /, npm ls, etc.) without piping through head/tail/grep.`,
    impact: 'medium',
    tokensSaved: flaggedCount * 2000,
    fix: {
      type: 'paste',
      label: 'Pattern to follow',
      text: 'Pipe verbose commands: `npm ls | head -30`, `find . -name "*.ts" | head -20`, `docker logs app | tail -50`'
    }
  }
}

function detectOverloadedClaudeMd(projectId: string): WasteFinding | null {
  // Try to find the project's cwd from the sessions table
  const db = getDb()
  const session = db.prepare(`
    SELECT cwd FROM sessions WHERE project_id = ? ORDER BY start_time DESC LIMIT 1
  `).get(projectId) as { cwd: string } | undefined

  const dirs = session ? [session.cwd] : []
  // Also check current working directory
  dirs.push(process.cwd())

  for (const dir of dirs) {
    if (!dir) continue
    const claudeMdPath = join(dir, 'CLAUDE.md')
    if (!existsSync(claudeMdPath)) continue

    let lines: number
    try {
      lines = readFileSync(claudeMdPath, 'utf8').split('\n').length
    } catch {
      continue
    }

    if (lines <= 200) return null

    const impact: WasteImpact = lines > 400 ? 'high' : 'medium'
    return {
      id: 'overloaded-claude-md',
      title: 'CLAUDE.md is too long',
      explanation: `CLAUDE.md has ${lines} lines. Files > 200 lines add significant context overhead on every turn (> 400 = high impact).`,
      impact,
      tokensSaved: (lines - 200) * 10,
      fix: {
        type: 'paste',
        label: 'What to remove',
        text: 'Remove: verbose examples, duplicate rules, commented sections, tool docs Claude already knows. Target < 150 lines.'
      }
    }
  }

  return null
}

function computeHealthScore(findings: WasteFinding[]): number {
  const DEDUCTIONS: Record<WasteImpact, number> = { high: 15, medium: 7, low: 3 }
  const deduction = findings.reduce((acc, f) => acc + DEDUCTIONS[f.impact], 0)
  return Math.max(0, 100 - deduction)
}

function scoreToGrade(score: number): HealthGrade {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 55) return 'C'
  if (score >= 30) return 'D'
  return 'F'
}

function impactOrder(impact: WasteImpact): number {
  return impact === 'high' ? 0 : impact === 'medium' ? 1 : 2
}

function safeParseJson<T>(val: string, fallback: T): T {
  try {
    return JSON.parse(val)
  } catch {
    return fallback
  }
}
