import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { getDb } from './db'
import type { HealthGrade, WasteFinding, WasteImpact, Win } from './types'

const CACHE_TTL_MS = 60 * 60 * 1000

const READ_TOOLS = new Set(['Read', 'Glob', 'Grep', 'LS', 'FileReadTool'])
const EDIT_TOOLS = new Set(['Edit', 'Write', 'FileEditTool', 'FileWriteTool', 'str_replace_editor'])

interface TurnRow {
  tool_names: string
  bash_commands: string
  session_id: string
}

interface SessionRow {
  session_id: string
  cache_write_tokens: number
  cost_usd: number
}

export function getAggregatedFindings(): Array<{
  id: string
  title: string
  impact: string
  affectedProjects: number
  projectNames: string[]
  fix: { label: string; text: string }
}> {
  const db = getDb()
  const rows = db.prepare(`
    SELECT wc.project_id, wc.findings_json, p.name, p.display_name
    FROM waste_cache wc
    JOIN projects p ON p.project_id = wc.project_id
    WHERE wc.id IN (
      SELECT MAX(id) FROM waste_cache GROUP BY project_id
    )
  `).all() as Array<{ project_id: string; findings_json: string; name: string; display_name: string | null }>

  const findingMap = new Map<string, { id: string; title: string; impact: string; affectedProjects: number; projectNames: string[]; fix: { label: string; text: string } }>()

  for (const row of rows) {
    let findings: WasteFinding[]
    try { findings = JSON.parse(row.findings_json) }
    catch { continue }
    const projectLabel = row.display_name ?? row.name
    for (const f of findings) {
      const existing = findingMap.get(f.id)
      if (existing) {
        existing.affectedProjects++
        if (existing.projectNames.length < 4) existing.projectNames.push(projectLabel)
      } else {
        findingMap.set(f.id, { id: f.id, title: f.title, impact: f.impact, affectedProjects: 1, projectNames: [projectLabel], fix: f.fix })
      }
    }
  }

  return [...findingMap.values()]
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 }
      const imp = (order[a.impact as keyof typeof order] ?? 3) - (order[b.impact as keyof typeof order] ?? 3)
      return imp !== 0 ? imp : b.affectedProjects - a.affectedProjects
    })
}

export function runGlobalOptimize(periodDays = 30): Array<{
  projectId: string
  name: string
  healthScore: number
  healthGrade: HealthGrade
  findingCount: number
  highCount: number
}> {
  const db = getDb()
  const projects = db.prepare('SELECT project_id, name, display_name FROM projects ORDER BY last_activity DESC LIMIT 12').all() as Array<{ project_id: string; name: string; display_name: string | null }>
  return projects.map((p) => {
    try {
      const result = runOptimize(p.project_id, periodDays)
      return {
        projectId: p.project_id,
        name: p.display_name ?? p.name,
        healthScore: result.healthScore,
        healthGrade: result.healthGrade,
        findingCount: result.findings.length,
        highCount: result.findings.filter((f) => f.impact === 'high').length
      }
    } catch {
      return { projectId: p.project_id, name: p.display_name ?? p.name, healthScore: 100, healthGrade: 'A' as HealthGrade, findingCount: 0, highCount: 0 }
    }
  })
}

export function runOptimize(projectId: string, periodDays = 30): {
  findings: WasteFinding[]
  wins: Win[]
  healthScore: number
  healthGrade: HealthGrade
} {
  const db = getDb()

  const cached = db.prepare(`
    SELECT findings_json, wins_json, health_score, health_grade FROM waste_cache
    WHERE project_id = ? AND period_days = ? AND computed_at > ?
    ORDER BY computed_at DESC LIMIT 1
  `).get(projectId, periodDays, Date.now() - CACHE_TTL_MS) as {
    findings_json: string
    wins_json: string | null
    health_score: number
    health_grade: string
  } | undefined

  if (cached) {
    return {
      findings: JSON.parse(cached.findings_json),
      wins: cached.wins_json ? JSON.parse(cached.wins_json) : [],
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
    return { findings: [], wins: [], healthScore: 100, healthGrade: 'A' }
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

  const f7 = detectGhostAgents(turns)
  if (f7) findings.push(f7)

  const f8 = detectGhostSkills(turns)
  if (f8) findings.push(f8)

  const f9 = detectUnusedMcp(turns, projectId)
  if (f9) findings.push(f9)

  findings.sort((a, b) => impactOrder(a.impact) - impactOrder(b.impact))

  const wins = computeWins(projectId, turns, sessions, since, findings)

  const healthScore = computeHealthScore(findings)
  const healthGrade = scoreToGrade(healthScore)

  db.prepare(`
    INSERT INTO waste_cache (project_id, period_days, findings_json, wins_json, health_score, health_grade, computed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, period_days) DO UPDATE SET
      findings_json = excluded.findings_json,
      wins_json = excluded.wins_json,
      health_score = excluded.health_score,
      health_grade = excluded.health_grade,
      computed_at = excluded.computed_at
  `).run(projectId, periodDays, JSON.stringify(findings), JSON.stringify(wins), healthScore, healthGrade, Date.now())

  return { findings, wins, healthScore, healthGrade }
}

function computeWins(
  projectId: string,
  turns: TurnRow[],
  sessions: SessionRow[],
  since: number,
  findings: WasteFinding[]
): Win[] {
  const db = getDb()
  const wins: Win[] = []

  const proj = db.prepare('SELECT cumulative_cache_hit_rate FROM projects WHERE project_id = ?').get(projectId) as { cumulative_cache_hit_rate: number } | undefined
  if (proj && proj.cumulative_cache_hit_rate >= 0.6) {
    wins.push({ id: 'cache-hit', text: `Cache hit ${(proj.cumulative_cache_hit_rate * 100).toFixed(0)}% — most tokens reused from cache` })
  }

  const oneShotRow = db.prepare(`
    SELECT COUNT(CASE WHEN sa.one_shot_success = 1 THEN 1 END) as os, COUNT(*) as total
    FROM session_activity sa
    JOIN sessions s ON s.session_id = sa.session_id
    WHERE s.project_id = ? AND s.start_time > ?
  `).get(projectId, since) as { os: number; total: number } | undefined
  if (oneShotRow && oneShotRow.total >= 3 && oneShotRow.os / oneShotRow.total >= 0.6) {
    wins.push({ id: 'one-shot', text: `${(oneShotRow.os / oneShotRow.total * 100).toFixed(0)}% one-shot — edits land correctly first try` })
  }

  if (sessions.length > 0) {
    const avgCost = sessions.reduce((s, r) => s + r.cost_usd, 0) / sessions.length
    if (avgCost < 0.10) {
      wins.push({ id: 'low-cost', text: `Avg $${avgCost.toFixed(3)}/session — efficient API usage` })
    }
  }

  if (!findings.find((f) => f.id === 'low-read-edit-ratio')) {
    let reads = 0, edits = 0
    for (const t of turns) {
      const tools: string[] = safeParseJson(t.tool_names, [])
      for (const name of tools) {
        if (READ_TOOLS.has(name)) reads++
        if (EDIT_TOOLS.has(name)) edits++
      }
    }
    if (edits >= 5 && reads / edits >= 4) {
      wins.push({ id: 'read-edit', text: `Read:edit ratio ${(reads / edits).toFixed(1)}:1 — Claude reads before it edits` })
    }
  }

  return wins
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
    const cmds: string[] = safeParseJson(t.bash_commands, [])
    for (const cmd of cmds) {
      if (JUNK_PATTERNS.some((p) => p.test(cmd))) junkCount++
    }
  }

  if (junkCount === 0) return null

  return {
    id: 'junk-reads',
    title: 'Reading build/dependency folders',
    explanation: `${junkCount} read(s) into node_modules/, .git/, dist/, or lock files. These are generated directories — tell Claude to ignore them.`,
    impact: junkCount >= 10 ? 'high' : 'medium',
    tokensSaved: junkCount * 600,
    fix: {
      type: 'file-content',
      label: 'Add to .claudeignore',
      text: 'node_modules/\n.git/\ndist/\nbuild/\n*.lock\n.next/\n.nuxt/'
    }
  }
}

function detectDuplicateReads(turns: TurnRow[]): WasteFinding | null {
  const sessionFiles = new Map<string, Map<string, number>>()

  for (const t of turns) {
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

  if (dupCount < 3) return null

  return {
    id: 'duplicate-reads',
    title: 'Re-reading the same files',
    explanation: `${dupCount} redundant re-reads across sessions. Claude already has the content in context — pointing it to exact locations removes the need to re-read.`,
    impact: dupCount >= 15 ? 'high' : 'medium',
    tokensSaved: dupCount * 300,
    fix: {
      type: 'paste',
      label: 'Add to your prompts:',
      text: 'In <file> lines <start>-<end>, look at the <function>. Do not re-read files already read in this session.'
    }
  }
}

function detectLowReadEditRatio(turns: TurnRow[]): WasteFinding | null {
  let readCount = 0
  let editCount = 0

  for (const t of turns) {
    const tools: string[] = safeParseJson(t.tool_names, [])
    for (const name of tools) {
      if (READ_TOOLS.has(name)) readCount++
      if (EDIT_TOOLS.has(name)) editCount++
    }
  }

  if (editCount < 10) return null
  const ratio = readCount / editCount
  if (ratio >= 2) return null

  return {
    id: 'low-read-edit-ratio',
    title: 'Edits more than it reads',
    explanation: `Read:edit ratio is ${ratio.toFixed(1)}:1 (healthy ≥ 4:1). Editing without reading context leads to incorrect changes and extra retries.`,
    impact: ratio < 1 ? 'high' : 'medium',
    tokensSaved: 0,
    fix: {
      type: 'paste',
      label: 'Add to CLAUDE.md:',
      text: 'Before editing any file, read it first. Before modifying a function, grep for all callers. Research before you edit.'
    }
  }
}

function detectCacheExcess(sessions: SessionRow[]): WasteFinding | null {
  const THRESHOLD = 15000
  const highCacheSessions = sessions.filter((s) => s.cache_write_tokens > THRESHOLD)
  if (highCacheSessions.length === 0) return null

  const totalExcess = highCacheSessions.reduce((acc, s) => acc + (s.cache_write_tokens - THRESHOLD), 0)
  const tokensSaved = Math.round(totalExcess * 0.8)

  return {
    id: 'cache-excess',
    title: 'Session warmup is unusually large',
    explanation: `${highCacheSessions.length} session(s) wrote >15K cache tokens. Large CLAUDE.md, MCP tool schemas, or many loaded agents inflate every session's startup cost.`,
    impact: 'high',
    tokensSaved,
    fix: {
      type: 'paste',
      label: 'Check CLAUDE.md for:',
      text: 'Duplicate rules, verbose examples, tool docs Claude already knows, commented-out sections, imported rule files > 200 lines.'
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
    title: 'Bash commands with large output',
    explanation: `${flaggedCount} bash call(s) may dump large output (cat, find /, npm ls, etc.) without piping through head/tail/grep. Each extra char costs tokens.`,
    impact: flaggedCount >= 5 ? 'medium' : 'low',
    tokensSaved: flaggedCount * 2000,
    fix: {
      type: 'paste',
      label: 'Add to CLAUDE.md:',
      text: 'Pipe verbose commands: `npm ls | head -30`, `find . -name "*.ts" | head -20`, `docker logs app | tail -50`\nexport BASH_MAX_OUTPUT_LENGTH=15000'
    }
  }
}

function detectOverloadedClaudeMd(projectId: string): WasteFinding | null {
  const db = getDb()
  const proj = db.prepare('SELECT project_path FROM projects WHERE project_id = ? LIMIT 1').get(projectId) as { project_path: string | null } | undefined

  const dirs: string[] = []
  if (proj?.project_path) dirs.push(proj.project_path)

  for (const dir of dirs) {
    if (!dir) continue
    const claudeMdPath = join(dir, 'CLAUDE.md')
    if (!existsSync(claudeMdPath)) continue

    let lines: number
    try { lines = readFileSync(claudeMdPath, 'utf8').split('\n').length }
    catch { continue }

    if (lines <= 200) return null

    const impact: WasteImpact = lines > 400 ? 'high' : 'medium'
    return {
      id: 'overloaded-claude-md',
      title: 'CLAUDE.md is too long',
      explanation: `CLAUDE.md has ${lines} lines. Target is <200 lines. Every line loads into every session, inflating context cost. At >400 lines, the overhead is severe.`,
      impact,
      tokensSaved: (lines - 200) * 10,
      fix: {
        type: 'paste',
        label: 'Ask Claude to trim it:',
        text: 'Review CLAUDE.md. Cut total content to under 150 lines. Remove verbose examples, duplicate rules, tool docs Claude already knows. Keep only non-obvious constraints and gotchas.'
      }
    }
  }

  return null
}

function detectGhostAgents(turns: TurnRow[]): WasteFinding | null {
  const agentsDir = join(homedir(), '.claude', 'agents')
  if (!existsSync(agentsDir)) return null

  let defined: string[]
  try { defined = readdirSync(agentsDir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')) }
  catch { return null }
  if (defined.length === 0) return null

  const invoked = new Set<string>()
  for (const t of turns) {
    const tools: string[] = safeParseJson(t.tool_names, [])
    if (!tools.includes('Agent') && !tools.includes('Task')) continue
    // Can't get subagent_type from tool_names alone — just note all Agent/Task calls
    invoked.add('__any__')
  }

  if (invoked.has('__any__')) return null

  const ghosts = defined
  if (ghosts.length === 0) return null

  return {
    id: 'ghost-agents',
    title: `${ghosts.length} custom agent${ghosts.length > 1 ? 's' : ''} never used in this period`,
    explanation: `Defined in ~/.claude/agents/ but no Agent/Task calls in this period: ${ghosts.slice(0, 4).join(', ')}${ghosts.length > 4 ? ` +${ghosts.length - 4} more` : ''}. Each adds token overhead to the Task tool schema.`,
    impact: ghosts.length >= 5 ? 'medium' : 'low',
    tokensSaved: ghosts.length * 80,
    fix: {
      type: 'command',
      label: 'Archive unused agents:',
      text: ghosts.slice(0, 8).map((n) => `mv ~/.claude/agents/${n}.md ~/.claude/agents/.archived/`).join('\n')
    }
  }
}

function detectGhostSkills(turns: TurnRow[]): WasteFinding | null {
  const skillsDir = join(homedir(), '.claude', 'skills')
  if (!existsSync(skillsDir)) return null

  let defined: string[]
  try {
    const entries = readdirSync(skillsDir, { withFileTypes: true })
    defined = entries.filter((e) => e.isDirectory() && existsSync(join(skillsDir, e.name, 'SKILL.md'))).map((e) => e.name)
  } catch { return null }
  if (defined.length === 0) return null

  const invoked = new Set<string>()
  for (const t of turns) {
    const tools: string[] = safeParseJson(t.tool_names, [])
    if (tools.includes('Skill')) invoked.add('__any__')
  }

  if (invoked.has('__any__')) return null

  return {
    id: 'ghost-skills',
    title: `${defined.length} skill${defined.length > 1 ? 's' : ''} never used in this period`,
    explanation: `Skills in ~/.claude/skills/ but not invoked this period: ${defined.slice(0, 4).join(', ')}${defined.length > 4 ? ` +${defined.length - 4} more` : ''}. Each adds metadata overhead.`,
    impact: defined.length >= 10 ? 'medium' : 'low',
    tokensSaved: defined.length * 80,
    fix: {
      type: 'command',
      label: 'Archive unused skills:',
      text: defined.slice(0, 8).map((n) => `mv ~/.claude/skills/${n} ~/.claude/skills/.archived/`).join('\n')
    }
  }
}

function detectUnusedMcp(turns: TurnRow[], projectId: string): WasteFinding | null {
  const db = getDb()
  const proj = db.prepare('SELECT project_path FROM projects WHERE project_id = ?').get(projectId) as { project_path: string | null } | undefined

  const configPaths = [
    join(homedir(), '.claude', 'settings.json'),
    join(homedir(), '.claude', 'settings.local.json'),
  ]
  if (proj?.project_path) {
    configPaths.push(join(proj.project_path, '.mcp.json'))
    configPaths.push(join(proj.project_path, '.claude', 'settings.json'))
  }

  const configured = new Set<string>()
  for (const p of configPaths) {
    if (!existsSync(p)) continue
    try {
      const cfg = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>
      const servers = cfg.mcpServers as Record<string, unknown> | undefined
      if (servers) for (const name of Object.keys(servers)) configured.add(name.replace(/:/g, '_'))
    } catch { continue }
  }

  if (configured.size === 0) return null

  const used = new Set<string>()
  for (const t of turns) {
    const tools: string[] = safeParseJson(t.tool_names, [])
    for (const name of tools) {
      if (name.startsWith('mcp__')) {
        const seg = name.split('__')[1]
        if (seg) used.add(seg)
      }
    }
  }

  const unused = [...configured].filter((s) => !used.has(s))
  if (unused.length === 0) return null

  return {
    id: 'unused-mcp',
    title: `${unused.length} MCP server${unused.length > 1 ? 's' : ''} configured but unused`,
    explanation: `Never called in this period: ${unused.join(', ')}. Each server loads ~2K tokens of tool schema into every session.`,
    impact: unused.length >= 3 ? 'high' : 'medium',
    tokensSaved: unused.length * 2000,
    fix: {
      type: 'command',
      label: 'Remove unused servers:',
      text: unused.map((s) => `claude mcp remove ${s}`).join('\n')
    }
  }
}

function computeHealthScore(findings: WasteFinding[]): number {
  const DEDUCTIONS: Record<WasteImpact, number> = { high: 15, medium: 7, low: 3 }
  const deduction = findings.reduce((acc, f) => acc + DEDUCTIONS[f.impact], 0)
  return Math.max(0, 100 - deduction)
}

export function scoreToGrade(score: number): HealthGrade {
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
  try { return JSON.parse(val) }
  catch { return fallback }
}
