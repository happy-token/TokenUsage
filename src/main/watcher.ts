import chokidar from 'chokidar'
import { join } from 'path'
import { homedir } from 'os'
import { stat } from 'fs/promises'
import { getDb } from './db'
import { parseJsonlFile } from './parser'
import { upsertSession } from './store'
import { classifySession } from './classifier'

const DEBOUNCE_MS = 2000
const pending = new Map<string, ReturnType<typeof setTimeout>>()

export function getClaudeDir(): string {
  return process.env['CLAUDE_CONFIG_DIR'] ?? join(homedir(), '.claude')
}

export function startWatcher(onUpdate: () => void): void {
  const watchPath = join(getClaudeDir(), 'projects', '**', '*.jsonl')

  const watcher = chokidar.watch(watchPath, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: false,
    usePolling: false
  })

  const handle = (filePath: string): void => {
    const existing = pending.get(filePath)
    if (existing) clearTimeout(existing)
    pending.set(
      filePath,
      setTimeout(async () => {
        pending.delete(filePath)
        await processFile(filePath)
        onUpdate()
      }, DEBOUNCE_MS)
    )
  }

  watcher.on('add', handle)
  watcher.on('change', handle)
}

async function processFile(filePath: string): Promise<void> {
  const db = getDb()
  const fileStats = await stat(filePath).catch(() => null)
  if (!fileStats) return

  const lastModified = fileStats.mtimeMs

  const stateRow = db
    .prepare('SELECT last_modified, last_byte_offset FROM file_state WHERE file_path = ?')
    .get(filePath) as { last_modified: number; last_byte_offset: number } | undefined

  if (stateRow && stateRow.last_modified === lastModified) return

  const startOffset = stateRow?.last_byte_offset ?? 0

  const { session, error, bytesRead } = await parseJsonlFile(filePath, startOffset)

  if (error) {
    db.prepare(
      `INSERT OR REPLACE INTO file_state (file_path, last_modified, last_byte_offset, parse_status)
       VALUES (?, ?, ?, 'error')`
    ).run(filePath, lastModified, bytesRead)
    console.error(`[parser] ${filePath}:`, error)
    return
  }

  if (session) {
    upsertSession(session)
    classifySession(session)
  }

  db.prepare(
    `INSERT OR REPLACE INTO file_state (file_path, last_modified, last_byte_offset, parse_status)
     VALUES (?, ?, ?, 'ok')`
  ).run(filePath, lastModified, bytesRead)
}
