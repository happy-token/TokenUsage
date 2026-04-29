import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, renameSync } from 'fs'
import { join } from 'path'

let db: Database.Database

export function getDb(): Database.Database {
  return db
}

export function initDb(): void {
  const oldPath = join(app.getPath('userData'), 'claudeinsight.db') // intentional: legacy filename for one-time migration
  const newPath = join(app.getPath('userData'), 'tokenusage.db')
  let dbPath = newPath
  try {
    if (existsSync(oldPath) && !existsSync(newPath)) {
      renameSync(oldPath, newPath)
    }
  } catch (err) {
    console.warn('DB migration failed, using old path:', err)
    dbPath = oldPath
  }
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations()
}

function runMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      project_id          TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      display_name        TEXT,
      total_cost          REAL DEFAULT 0,
      total_sessions      INTEGER DEFAULT 0,
      last_activity       INTEGER,
      cumulative_cache_hit_rate  REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id          TEXT PRIMARY KEY,
      project_id          TEXT NOT NULL,
      start_time          INTEGER NOT NULL,
      end_time            INTEGER,
      duration_ms         INTEGER,
      input_tokens        INTEGER DEFAULT 0,
      output_tokens       INTEGER DEFAULT 0,
      cache_read_tokens   INTEGER DEFAULT 0,
      cache_write_tokens  INTEGER DEFAULT 0,
      cost_usd            REAL DEFAULT 0,
      model               TEXT,
      git_branch          TEXT,
      cc_version          TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_project_id
      ON sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_project_start
      ON sessions(project_id, start_time DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_start_time
      ON sessions(start_time DESC);

    CREATE TABLE IF NOT EXISTS turns (
      turn_id             TEXT PRIMARY KEY,
      session_id          TEXT NOT NULL,
      timestamp           INTEGER NOT NULL,
      role                TEXT NOT NULL,
      user_message        TEXT,
      tool_names          TEXT,
      bash_commands       TEXT,
      input_tokens        INTEGER DEFAULT 0,
      output_tokens       INTEGER DEFAULT 0,
      cost_usd            REAL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_turns_session
      ON turns(session_id, timestamp ASC);

    CREATE TABLE IF NOT EXISTS session_activity (
      session_id          TEXT PRIMARY KEY,
      activity_type       TEXT NOT NULL,
      retry_count         INTEGER DEFAULT 0,
      one_shot_success    INTEGER DEFAULT 0,
      top_shell_commands  TEXT,
      shell_command_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS insights (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id          TEXT NOT NULL,
      insight_type        TEXT NOT NULL,
      severity            TEXT NOT NULL,
      message             TEXT NOT NULL,
      recommendation      TEXT NOT NULL,
      estimated_savings   REAL,
      source              TEXT NOT NULL,
      generated_at        INTEGER NOT NULL,
      stats_hash          TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_insights_project
      ON insights(project_id, generated_at DESC);

    CREATE TABLE IF NOT EXISTS waste_cache (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id          TEXT NOT NULL,
      period_days         INTEGER NOT NULL,
      findings_json       TEXT NOT NULL,
      health_score        INTEGER NOT NULL,
      health_grade        TEXT NOT NULL,
      computed_at         INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_waste_cache_project
      ON waste_cache(project_id, computed_at DESC);

    CREATE TABLE IF NOT EXISTS file_state (
      file_path           TEXT PRIMARY KEY,
      last_modified       INTEGER NOT NULL,
      last_byte_offset    INTEGER NOT NULL,
      parse_status        TEXT DEFAULT 'ok'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key                 TEXT PRIMARY KEY,
      value               BLOB NOT NULL,
      is_encrypted        INTEGER DEFAULT 0
    );
  `)

  // Migrations for columns added after initial schema
  try { db.exec(`ALTER TABLE projects ADD COLUMN project_path TEXT`) } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE waste_cache ADD COLUMN wins_json TEXT`) } catch { /* already exists */ }
  try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_waste_cache_uq ON waste_cache(project_id, period_days)`) } catch { /* already exists */ }
}
