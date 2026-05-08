import { getDb } from './db'
import { projectIdFromName, getInputCostPer1M } from './parser'
import type { ParsedSession } from './types'

export function upsertSession(session: ParsedSession): void {
  const db = getDb()

  // Ensure project row exists (without accumulating on re-parse)
  db.prepare(`
    INSERT OR IGNORE INTO projects (project_id, name, project_path, total_cost, total_sessions, last_activity, cumulative_cache_hit_rate)
    VALUES (?, ?, ?, 0, 0, ?, 0)
  `).run(session.projectId, session.projectName, session.projectPath, session.endTime)

  // Update project_path if we now have it
  if (session.projectPath) {
    db.prepare(`UPDATE projects SET project_path = ? WHERE project_id = ? AND project_path IS NULL`)
      .run(session.projectPath, session.projectId)
  }

  // Upsert session
  db.prepare(`
    INSERT OR REPLACE INTO sessions
      (session_id, project_id, start_time, end_time, duration_ms,
       input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
       cost_usd, model, git_branch, cc_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    session.sessionId,
    session.projectId,
    session.startTime,
    session.endTime,
    session.durationMs,
    session.inputTokens,
    session.outputTokens,
    session.cacheReadTokens,
    session.cacheWriteTokens,
    session.costUsd,
    session.model,
    session.gitBranch,
    session.ccVersion
  )

  // Upsert turns
  const insertTurn = db.prepare(`
    INSERT OR REPLACE INTO turns
      (turn_id, session_id, timestamp, role, user_message,
       tool_names, bash_commands, input_tokens, output_tokens, cost_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertMany = db.transaction((turns: ParsedSession['turns']) => {
    for (const t of turns) {
      insertTurn.run(
        t.turnId,
        t.sessionId,
        t.timestamp,
        t.role,
        t.userMessage ?? null,
        JSON.stringify(t.toolNames),
        JSON.stringify(t.bashCommands),
        t.inputTokens,
        t.outputTokens,
        t.costUsd
      )
    }
  })

  insertMany(session.turns)

  // Recompute project aggregates from sessions table (safe for re-parses)
  refreshProjectStats(session.projectId)
}

function refreshProjectStats(projectId: string): void {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      COUNT(*) AS session_count,
      SUM(cost_usd) AS total_cost,
      MAX(end_time) AS last_activity,
      SUM(cache_read_tokens) AS total_cache_read,
      SUM(input_tokens) AS total_input
    FROM sessions WHERE project_id = ?
  `).get(projectId) as {
    session_count: number
    total_cost: number
    last_activity: number
    total_cache_read: number
    total_input: number
  } | undefined

  if (!row) return
  const denominator = row.total_input + row.total_cache_read
  const rate = denominator > 0 ? row.total_cache_read / denominator : 0

  db.prepare(`
    UPDATE projects SET
      total_cost = ?,
      total_sessions = ?,
      last_activity = ?,
      cumulative_cache_hit_rate = ?
    WHERE project_id = ?
  `).run(row.total_cost ?? 0, row.session_count, row.last_activity, rate, projectId)
}

export function getProjects() {
  return getDb().prepare('SELECT * FROM projects ORDER BY last_activity DESC').all()
}

export function getProjectById(projectId: string) {
  return getDb().prepare('SELECT * FROM projects WHERE project_id = ?').get(projectId)
}

export function getSessionsByProject(projectId: string, limit = 50) {
  return getDb()
    .prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY start_time DESC LIMIT ?')
    .all(projectId, limit)
}

export function getSessionById(sessionId: string) {
  return getDb().prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId)
}

export function getSessionActivity(sessionId: string) {
  return getDb()
    .prepare('SELECT * FROM session_activity WHERE session_id = ?')
    .get(sessionId)
}

export function getProjectActivityStats(projectId: string | null, periodDays = 0) {
  const db = getDb()
  const cutoff = periodDays > 0 ? Date.now() - periodDays * 86400 * 1000 : 0
  if (projectId === null) {
    return db.prepare(`
      SELECT sa.activity_type, COUNT(*) as count,
             AVG(sa.retry_count) as avg_retries,
             SUM(sa.one_shot_success) as one_shot_count,
             SUM(s.cost_usd) as cost
      FROM session_activity sa
      JOIN sessions s ON s.session_id = sa.session_id
      WHERE (? = 0 OR s.start_time >= ?)
      GROUP BY sa.activity_type
      ORDER BY cost DESC
    `).all(cutoff, cutoff)
  }
  return db.prepare(`
    SELECT sa.activity_type, COUNT(*) as count,
           AVG(sa.retry_count) as avg_retries,
           SUM(sa.one_shot_success) as one_shot_count,
           SUM(s.cost_usd) as cost
    FROM session_activity sa
    JOIN sessions s ON s.session_id = sa.session_id
    WHERE s.project_id = ? AND (? = 0 OR s.start_time >= ?)
    GROUP BY sa.activity_type
    ORDER BY cost DESC
  `).all(projectId, cutoff, cutoff)
}

export function getProjectReport(projectId: string, periodDays: number) {
  const db = getDb()
  const cutoff = periodDays > 0 ? Date.now() - periodDays * 86400 * 1000 : 0

  // Cost analysis: top sessions by cost
  const topSessions = db.prepare(`
    SELECT session_id, start_time, cost_usd, model
    FROM sessions
    WHERE project_id = ? AND (? = 0 OR start_time >= ?)
    ORDER BY cost_usd DESC
    LIMIT 10
  `).all(projectId, cutoff, cutoff) as Array<{
    session_id: string; start_time: number; cost_usd: number; model: string | null
  }>

  const costRow = db.prepare(`
    SELECT SUM(cost_usd) as total_cost, AVG(cost_usd) as avg_cost, COUNT(*) as session_count
    FROM sessions
    WHERE project_id = ? AND (? = 0 OR start_time >= ?)
  `).get(projectId, cutoff, cutoff) as {
    total_cost: number | null; avg_cost: number | null; session_count: number
  }

  // Token breakdown + cache stats
  const tokenRow = db.prepare(`
    SELECT
      SUM(input_tokens) as input,
      SUM(output_tokens) as output,
      SUM(cache_read_tokens) as cache_read,
      SUM(cache_write_tokens) as cache_write
    FROM sessions
    WHERE project_id = ? AND (? = 0 OR start_time >= ?)
  `).get(projectId, cutoff, cutoff) as {
    input: number | null; output: number | null; cache_read: number | null; cache_write: number | null
  }

  const inp = tokenRow.input ?? 0
  const cr = tokenRow.cache_read ?? 0
  const cw = tokenRow.cache_write ?? 0
  const hitRate = inp + cr > 0 ? cr / (inp + cr) : 0

  // Activity breakdown
  const activityRows = db.prepare(`
    SELECT sa.activity_type,
           COUNT(*) as count,
           AVG(sa.retry_count) as avg_retries,
           SUM(sa.one_shot_success) as one_shot_count,
           SUM(s.cost_usd) as cost
    FROM session_activity sa
    JOIN sessions s ON s.session_id = sa.session_id
    WHERE s.project_id = ? AND (? = 0 OR s.start_time >= ?)
    GROUP BY sa.activity_type
    ORDER BY count DESC
  `).all(projectId, cutoff, cutoff) as Array<{
    activity_type: string; count: number; avg_retries: number; one_shot_count: number; cost: number
  }>

  const totalSessions = costRow.session_count ?? 0
  const oneShotSessions = activityRows.reduce((acc, a) => acc + (a.one_shot_count ?? 0), 0)

  // Model breakdown
  const modelRows = db.prepare(`
    SELECT model,
           COUNT(*) as session_count,
           SUM(cost_usd) as total_cost,
           SUM(input_tokens) as input_tokens,
           SUM(output_tokens) as output_tokens
    FROM sessions
    WHERE project_id = ? AND model IS NOT NULL AND (? = 0 OR start_time >= ?)
    GROUP BY model
    ORDER BY total_cost DESC
  `).all(projectId, cutoff, cutoff) as Array<{
    model: string; session_count: number; total_cost: number; input_tokens: number; output_tokens: number
  }>

  // Model-weighted input price for accurate cache ROI (vs hardcoded sonnet $3.0)
  let inputCostPerMtok = 3.0 // fallback
  if (modelRows.length > 0) {
    let totalInput = 0, weightedSum = 0
    for (const m of modelRows) {
      const price = getInputCostPer1M(m.model)
      if (price > 0) {
        weightedSum += (m.input_tokens ?? 0) * price
        totalInput += (m.input_tokens ?? 0)
      }
    }
    if (totalInput > 0) inputCostPerMtok = weightedSum / totalInput
  }
  // cache_read saves ~90% of input cost; cache_write costs extra ~25%
  const grossSavings = (cr / 1e6) * inputCostPerMtok * 0.9
  const writeCost = (cw / 1e6) * inputCostPerMtok * 0.25
  const netRoi = grossSavings - writeCost

  // Tool stats from turns.tool_names (JSON array stored as text)
  const turnRows = db.prepare(`
    SELECT t.tool_names
    FROM turns t
    JOIN sessions s ON s.session_id = t.session_id
    WHERE s.project_id = ? AND t.tool_names IS NOT NULL AND t.tool_names != '[]'
      AND (? = 0 OR t.timestamp >= ?)
  `).all(projectId, cutoff, cutoff) as Array<{ tool_names: string }>

  const toolCounts: Record<string, number> = {}
  for (const row of turnRows) {
    try {
      const names: string[] = JSON.parse(row.tool_names)
      for (const n of names) toolCounts[n] = (toolCounts[n] ?? 0) + 1
    } catch { /* skip malformed */ }
  }
  const topTools = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }))

  // Shell command stats from turns.bash_commands
  const shellRows = db.prepare(`
    SELECT t.bash_commands
    FROM turns t
    JOIN sessions s ON s.session_id = t.session_id
    WHERE s.project_id = ? AND t.bash_commands IS NOT NULL AND t.bash_commands != '[]'
      AND (? = 0 OR t.timestamp >= ?)
  `).all(projectId, cutoff, cutoff) as Array<{ bash_commands: string }>

  const shellCounts: Record<string, number> = {}
  for (const row of shellRows) {
    try {
      const cmds: string[] = JSON.parse(row.bash_commands)
      for (const cmd of cmds) {
        const bin = cmd.trim().split(/\s+/)[0] ?? ''
        if (bin) shellCounts[bin] = (shellCounts[bin] ?? 0) + 1
      }
    } catch { /* skip */ }
  }
  const topCommands = Object.entries(shellCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([cmd, count]) => ({ cmd, count }))

  // Shell category buckets
  const categoryMap: Record<string, string[]> = {
    git: ['git'],
    build: ['npm', 'npx', 'yarn', 'pnpm', 'bun', 'make', 'cargo', 'go', 'tsc', 'webpack', 'vite'],
    test: ['jest', 'vitest', 'pytest', 'mocha', 'tap'],
    file: ['ls', 'find', 'cat', 'cp', 'mv', 'rm', 'mkdir', 'touch', 'head', 'tail', 'grep', 'awk', 'sed'],
    network: ['curl', 'wget', 'ssh', 'scp', 'rsync'],
    process: ['ps', 'kill', 'pkill', 'top', 'htop', 'lsof'],
    other: []
  }
  const shellByCategory: Record<string, number> = { git: 0, build: 0, test: 0, file: 0, network: 0, process: 0, other: 0 }
  for (const [cmd, cnt] of Object.entries(shellCounts)) {
    let found = false
    for (const [cat, bins] of Object.entries(categoryMap)) {
      if (cat === 'other') continue
      if (bins.includes(cmd)) { shellByCategory[cat] += cnt; found = true; break }
    }
    if (!found) shellByCategory.other += cnt
  }

  // MCP server stats: tools with "mcp_" prefix or containing "__" (MCP naming convention)
  const mcpTools = Object.entries(toolCounts)
    .filter(([n]) => n.includes('__') || n.startsWith('mcp_'))
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  return {
    costAnalysis: {
      topSessions,
      totalCost: costRow.total_cost ?? 0,
      avgCost: costRow.avg_cost ?? 0,
      sessionCount: costRow.session_count
    },
    tokenBreakdown: {
      input: inp,
      output: tokenRow.output ?? 0,
      cacheRead: cr,
      cacheWrite: cw
    },
    cacheStats: {
      hitRate,
      grossSavings,
      writeCost,
      netRoi
    },
    activityBreakdown: {
      byType: activityRows,
      avgRetries: activityRows.length > 0
        ? activityRows.reduce((acc, a) => acc + (a.avg_retries ?? 0), 0) / activityRows.length
        : 0,
      oneShotRate: totalSessions > 0 ? oneShotSessions / totalSessions : 0
    },
    modelBreakdown: { models: modelRows },
    toolStats: { topTools },
    shellStats: { byCategory: shellByCategory, topCommands },
    mcpStats: { servers: mcpTools }
  }
}

export function getGlobalReport(periodDays: number) {
  const db = getDb()
  const cutoff = periodDays > 0 ? Date.now() - periodDays * 86400 * 1000 : 0

  const tokenRow = db.prepare(`
    SELECT
      SUM(input_tokens) as input,
      SUM(output_tokens) as output,
      SUM(cache_read_tokens) as cache_read,
      SUM(cache_write_tokens) as cache_write
    FROM sessions WHERE (? = 0 OR start_time >= ?)
  `).get(cutoff, cutoff) as { input: number | null; output: number | null; cache_read: number | null; cache_write: number | null }

  const inp = tokenRow.input ?? 0
  const out = tokenRow.output ?? 0
  const cr = tokenRow.cache_read ?? 0
  const cw = tokenRow.cache_write ?? 0
  const hitRate = inp + cr > 0 ? cr / (inp + cr) : 0

  // Model-weighted input price for accurate cache ROI
  const modelInputRows = db.prepare(`
    SELECT model, SUM(input_tokens) as input_tokens
    FROM sessions WHERE model IS NOT NULL AND (? = 0 OR start_time >= ?)
    GROUP BY model
  `).all(cutoff, cutoff) as Array<{ model: string; input_tokens: number }>
  let inputCostPerMtok = 3.0 // fallback
  if (modelInputRows.length > 0) {
    let totalInput = 0, weightedSum = 0
    for (const m of modelInputRows) {
      const price = getInputCostPer1M(m.model)
      if (price > 0) {
        weightedSum += (m.input_tokens ?? 0) * price
        totalInput += (m.input_tokens ?? 0)
      }
    }
    if (totalInput > 0) inputCostPerMtok = weightedSum / totalInput
  }
  const grossSavings = (cr / 1e6) * inputCostPerMtok * 0.9
  const writeCost = (cw / 1e6) * inputCostPerMtok * 0.25
  const netRoi = grossSavings - writeCost

  const topSessions = db.prepare(`
    SELECT s.session_id, s.start_time, s.cost_usd, s.model, p.name as project_name, p.display_name
    FROM sessions s JOIN projects p ON p.project_id = s.project_id
    WHERE (? = 0 OR s.start_time >= ?)
    ORDER BY s.cost_usd DESC LIMIT 10
  `).all(cutoff, cutoff) as Array<{ session_id: string; start_time: number; cost_usd: number; model: string | null; project_name: string; display_name: string | null }>

  const toolRows = db.prepare(`
    SELECT t.tool_names FROM turns t
    JOIN sessions s ON s.session_id = t.session_id
    WHERE t.tool_names IS NOT NULL AND t.tool_names != '[]' AND (? = 0 OR t.timestamp >= ?)
  `).all(cutoff, cutoff) as Array<{ tool_names: string }>

  const toolCounts: Record<string, number> = {}
  for (const row of toolRows) {
    try {
      const names: string[] = JSON.parse(row.tool_names)
      for (const n of names) toolCounts[n] = (toolCounts[n] ?? 0) + 1
    } catch { /* skip */ }
  }
  const topTools = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, count]) => ({ name, count }))

  const shellRows = db.prepare(`
    SELECT t.bash_commands FROM turns t
    JOIN sessions s ON s.session_id = t.session_id
    WHERE t.bash_commands IS NOT NULL AND t.bash_commands != '[]' AND (? = 0 OR t.timestamp >= ?)
  `).all(cutoff, cutoff) as Array<{ bash_commands: string }>

  const shellCounts: Record<string, number> = {}
  for (const row of shellRows) {
    try {
      const cmds: string[] = JSON.parse(row.bash_commands)
      for (const cmd of cmds) {
        const bin = cmd.trim().split(/\s+/)[0] ?? ''
        if (bin) shellCounts[bin] = (shellCounts[bin] ?? 0) + 1
      }
    } catch { /* skip */ }
  }

  const categoryMap: Record<string, string[]> = {
    git:     ['git', 'gh'],
    build:   ['npm', 'npx', 'yarn', 'pnpm', 'bun', 'make', 'cargo', 'go', 'tsc', 'webpack', 'vite'],
    test:    ['jest', 'vitest', 'pytest', 'mocha', 'tap'],
    file:    ['ls', 'find', 'cat', 'cp', 'mv', 'rm', 'mkdir', 'touch', 'head', 'tail', 'grep', 'awk', 'sed'],
    network: ['curl', 'wget', 'ssh', 'scp', 'rsync'],
    process: ['ps', 'kill', 'pkill', 'top', 'htop', 'lsof'],
  }
  const shellByCategory: Record<string, number> = { git: 0, build: 0, test: 0, file: 0, network: 0, process: 0, other: 0 }
  for (const [cmd, cnt] of Object.entries(shellCounts)) {
    let found = false
    for (const [cat, bins] of Object.entries(categoryMap)) {
      if (bins.includes(cmd)) { shellByCategory[cat] += cnt; found = true; break }
    }
    if (!found) shellByCategory.other += cnt
  }

  const topCommands = Object.entries(shellCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([cmd, count]) => ({ cmd, count }))

  return {
    tokenBreakdown: { input: inp, output: out, cacheRead: cr, cacheWrite: cw },
    cacheStats: { hitRate, grossSavings, writeCost, netRoi },
    topSessions,
    toolStats: { topTools },
    shellStats: { byCategory: shellByCategory, topCommands },
  }
}

// By Day: daily rollup for a single project or all projects (projectId = null)
export function getReportByDay(projectId: string | null, periodDays: number) {
  const db = getDb()
  const cutoff = periodDays > 0 ? Date.now() - periodDays * 86400 * 1000 : 0

  const rows = db.prepare(`
    SELECT
      date(start_time / 1000, 'unixepoch', 'localtime') AS day,
      COUNT(*) AS session_count,
      SUM(cost_usd) AS cost,
      SUM(input_tokens) AS input,
      SUM(output_tokens) AS output,
      SUM(cache_read_tokens) AS cache_read,
      SUM(cache_write_tokens) AS cache_write
    FROM sessions
    WHERE (? IS NULL OR project_id = ?) AND (? = 0 OR start_time >= ?)
    GROUP BY day
    ORDER BY day ASC
  `).all(projectId, projectId, cutoff, cutoff) as Array<{
    day: string; session_count: number; cost: number
    input: number; output: number; cache_read: number; cache_write: number
  }>

  return rows.map(r => ({
    ...r,
    cacheHitRate: r.input + r.cache_read > 0 ? r.cache_read / (r.input + r.cache_read) : 0
  }))
}

// By Model: model breakdown across all projects or a single project
export function getReportByModel(projectId: string | null, periodDays: number) {
  const db = getDb()
  const cutoff = periodDays > 0 ? Date.now() - periodDays * 86400 * 1000 : 0

  const rows = db.prepare(`
    SELECT
      COALESCE(model, 'unknown') AS model,
      COUNT(*) AS session_count,
      SUM(cost_usd) AS total_cost,
      AVG(cost_usd) AS avg_cost,
      SUM(input_tokens) AS input,
      SUM(output_tokens) AS output,
      SUM(cache_read_tokens) AS cache_read,
      SUM(cache_write_tokens) AS cache_write
    FROM sessions
    WHERE (? IS NULL OR project_id = ?) AND (? = 0 OR start_time >= ?)
    GROUP BY model
    ORDER BY total_cost DESC
  `).all(projectId, projectId, cutoff, cutoff) as Array<{
    model: string; session_count: number; total_cost: number; avg_cost: number
    input: number; output: number; cache_read: number; cache_write: number
  }>

  const totalCost = rows.reduce((acc, r) => acc + r.total_cost, 0)
  return rows.map(r => ({
    ...r,
    sharePct: totalCost > 0 ? r.total_cost / totalCost : 0,
    cacheHitRate: r.input + r.cache_read > 0 ? r.cache_read / (r.input + r.cache_read) : 0
  }))
}

// By Session: per-session detail for a project
export function getReportBySession(projectId: string, periodDays: number, limit = 100) {
  const db = getDb()
  const cutoff = periodDays > 0 ? Date.now() - periodDays * 86400 * 1000 : 0

  const sessions = db.prepare(`
    SELECT
      s.session_id, s.start_time, s.end_time, s.duration_ms,
      s.cost_usd, s.model, s.git_branch,
      s.input_tokens, s.output_tokens, s.cache_read_tokens, s.cache_write_tokens,
      sa.activity_type, sa.retry_count, sa.one_shot_success
    FROM sessions s
    LEFT JOIN session_activity sa ON sa.session_id = s.session_id
    WHERE s.project_id = ? AND (? = 0 OR s.start_time >= ?)
    ORDER BY s.start_time DESC
    LIMIT ?
  `).all(projectId, cutoff, cutoff, limit) as Array<{
    session_id: string; start_time: number; end_time: number | null; duration_ms: number | null
    cost_usd: number; model: string | null; git_branch: string | null
    input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_write_tokens: number
    activity_type: string | null; retry_count: number | null; one_shot_success: number | null
  }>

  return sessions.map(s => ({
    ...s,
    cacheHitRate: s.input_tokens + s.cache_read_tokens > 0
      ? s.cache_read_tokens / (s.input_tokens + s.cache_read_tokens)
      : 0
  }))
}

export function deleteSession(sessionId: string): void {
  const db = getDb()
  const row = db.prepare('SELECT project_id FROM sessions WHERE session_id = ?').get(sessionId) as { project_id: string } | undefined
  db.transaction(() => {
    db.prepare('DELETE FROM session_activity WHERE session_id = ?').run(sessionId)
    db.prepare('DELETE FROM turns WHERE session_id = ?').run(sessionId)
    db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId)
  })()
  if (row) refreshProjectStats(row.project_id)
}

export function deleteProject(projectId: string): void {
  const db = getDb()
  const sessionIds = (db.prepare('SELECT session_id FROM sessions WHERE project_id = ?').all(projectId) as Array<{ session_id: string }>).map(r => r.session_id)
  db.transaction(() => {
    for (const sid of sessionIds) {
      db.prepare('DELETE FROM session_activity WHERE session_id = ?').run(sid)
      db.prepare('DELETE FROM turns WHERE session_id = ?').run(sid)
    }
    db.prepare('DELETE FROM sessions WHERE project_id = ?').run(projectId)
    db.prepare('DELETE FROM waste_cache WHERE project_id = ?').run(projectId)
    db.prepare('DELETE FROM projects WHERE project_id = ?').run(projectId)
  })()
}

// By Project: cross-project rollup (global, not scoped to one project)
export function getReportByProject(periodDays: number) {
  const db = getDb()
  const cutoff = periodDays > 0 ? Date.now() - periodDays * 86400 * 1000 : 0

  const rows = db.prepare(`
    SELECT
      p.project_id, p.name, p.display_name,
      COUNT(s.session_id) AS session_count,
      SUM(s.cost_usd) AS total_cost,
      AVG(s.cost_usd) AS avg_cost,
      SUM(s.input_tokens) AS input,
      SUM(s.output_tokens) AS output,
      SUM(s.cache_read_tokens) AS cache_read,
      SUM(s.cache_write_tokens) AS cache_write,
      MAX(s.start_time) AS last_active
    FROM projects p
    LEFT JOIN sessions s ON s.project_id = p.project_id
      AND (? = 0 OR s.start_time >= ?)
    GROUP BY p.project_id
    ORDER BY total_cost DESC NULLS LAST
  `).all(cutoff, cutoff) as Array<{
    project_id: string; name: string; display_name: string | null
    session_count: number; total_cost: number | null; avg_cost: number | null
    input: number | null; output: number | null; cache_read: number | null; cache_write: number | null
    last_active: number | null
  }>

  const totalCost = rows.reduce((acc, r) => acc + (r.total_cost ?? 0), 0)
  return rows.map(r => {
    const inp = r.input ?? 0
    const cr = r.cache_read ?? 0
    return {
      ...r,
      total_cost: r.total_cost ?? 0,
      avg_cost: r.avg_cost ?? 0,
      sharePct: totalCost > 0 ? (r.total_cost ?? 0) / totalCost : 0,
      cacheHitRate: inp + cr > 0 ? cr / (inp + cr) : 0
    }
  })
}


export function getTrayStats(): { todayCost: number; todaySessions: number; cacheHit7d: number; totalCost7d: number } {
  const db = getDb()
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const week = Date.now() - 7 * 24 * 60 * 60 * 1000

  const today = db.prepare(`
    SELECT COALESCE(SUM(cost_usd),0) AS cost, COUNT(*) AS sessions
    FROM sessions WHERE start_time >= ?
  `).get(dayStart.getTime()) as { cost: number; sessions: number }

  const week7d = db.prepare(`
    SELECT COALESCE(SUM(cost_usd),0) AS cost,
           COALESCE(SUM(cache_read_tokens),0) AS cr,
           COALESCE(SUM(input_tokens + cache_read_tokens),0) AS total
    FROM sessions WHERE start_time >= ?
  `).get(week) as { cost: number; cr: number; total: number }

  return {
    todayCost: today.cost,
    todaySessions: today.sessions,
    cacheHit7d: week7d.total > 0 ? week7d.cr / week7d.total : 0,
    totalCost7d: week7d.cost,
  }
}
