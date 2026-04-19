import { getDb } from './db'
import { projectIdFromName } from './parser'
import type { ParsedSession } from './types'

export function upsertSession(session: ParsedSession): void {
  const db = getDb()

  // Upsert project
  db.prepare(`
    INSERT INTO projects (project_id, name, total_cost, total_sessions, last_activity, cumulative_cache_hit_rate)
    VALUES (?, ?, ?, 1, ?, 0)
    ON CONFLICT(project_id) DO UPDATE SET
      total_cost = total_cost + excluded.total_cost,
      total_sessions = total_sessions + 1,
      last_activity = MAX(last_activity, excluded.last_activity)
  `).run(
    session.projectId,
    session.projectName,
    session.costUsd,
    session.endTime
  )

  // Update weighted cache hit rate for project
  updateProjectCacheHitRate(session.projectId)

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
}

function updateProjectCacheHitRate(projectId: string): void {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      SUM(cache_read_tokens) AS total_cache_read,
      SUM(input_tokens) AS total_input
    FROM sessions WHERE project_id = ?
  `).get(projectId) as { total_cache_read: number; total_input: number } | undefined

  if (!row) return
  const denominator = row.total_input + row.total_cache_read
  const rate = denominator > 0 ? row.total_cache_read / denominator : 0

  db.prepare('UPDATE projects SET cumulative_cache_hit_rate = ? WHERE project_id = ?')
    .run(rate, projectId)
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

export function getProjectActivityStats(projectId: string) {
  return getDb().prepare(`
    SELECT sa.activity_type, COUNT(*) as count,
           AVG(sa.retry_count) as avg_retries,
           SUM(sa.one_shot_success) as one_shot_count
    FROM session_activity sa
    JOIN sessions s ON s.session_id = sa.session_id
    WHERE s.project_id = ?
    GROUP BY sa.activity_type
    ORDER BY count DESC
  `).all(projectId)
}
