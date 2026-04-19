import type { ActivityType, ParsedSession } from './types'

const EDIT_TOOLS = new Set([
  'Edit', 'Write', 'FileEditTool', 'FileWriteTool',
  'str_replace_editor', 'str_replace_based_edit_tool',
  'MultiEdit', 'NotebookEdit'
])

const BASH_TOOLS = new Set(['Bash', 'BashTool', 'PowerShellTool'])

const READ_TOOLS = new Set([
  'Read', 'Glob', 'Grep', 'LS', 'FileReadTool',
  'ReadFileTool', 'ListDirectoryTool'
])

const AGENT_TOOLS = new Set(['Task', 'Agent'])

const SHELL_CATEGORIES: Array<{ category: string; patterns: RegExp[] }> = [
  { category: 'test', patterns: [/^(npm|bun|yarn|pnpm) test/, /^vitest/, /^jest/, /^pytest/, /^go test/, /^cargo test/] },
  { category: 'git', patterns: [/^git /, /^gh /] },
  { category: 'build', patterns: [/^(npm|bun|yarn|pnpm) (run )?build/, /^cargo build/, /^go build/, /^make /] },
  { category: 'install', patterns: [/^(npm|bun|yarn|pnpm) (install|add|i )/, /^pip install/, /^cargo add/, /^go get/] },
  { category: 'lint', patterns: [/^eslint/, /^prettier/, /^tsc --noEmit/, /^ruff/, /^golangci-lint/] },
  { category: 'run-start', patterns: [/^(npm|bun|yarn|pnpm) (run |start)/, /^node /, /^python[3]? /, /^go run/] },
  { category: 'file-ops', patterns: [/^(cat|ls|find|mkdir|cp|mv|rm|touch|echo) /] }
]

export function classifyShellCommand(command: string): string {
  const trimmed = command.trim()
  for (const { category, patterns } of SHELL_CATEGORIES) {
    if (patterns.some((p) => p.test(trimmed))) return category
  }
  return 'other'
}

export function classifyActivity(session: ParsedSession): ActivityType {
  const allToolNames = new Set(session.turns.flatMap((t) => t.toolNames))
  const allBashCmds = session.turns.flatMap((t) => t.bashCommands)
  const userMessages = session.turns
    .filter((t) => t.role === 'user' && t.userMessage)
    .map((t) => t.userMessage!.toLowerCase())
    .join(' ')

  const hasEdit = [...allToolNames].some((n) => EDIT_TOOLS.has(n))
  const hasBash = [...allToolNames].some((n) => BASH_TOOLS.has(n))
  const hasRead = [...allToolNames].some((n) => READ_TOOLS.has(n))
  const hasAgent = [...allToolNames].some((n) => AGENT_TOOLS.has(n))
  const noTools = allToolNames.size === 0

  // Tool-set based classification (first pass)
  if (hasBash && allBashCmds.some((c) => /^git |^gh /.test(c.trim()))) {
    // Check if ONLY git commands (no edit tools)
    const nonGitCmds = allBashCmds.filter((c) => !/^git |^gh /.test(c.trim()))
    if (!hasEdit && nonGitCmds.length === 0) return 'git'
  }

  if (hasBash && allBashCmds.some((c) => /(npm|bun|yarn|pnpm|vitest|jest|pytest|cargo|go) test/.test(c))) {
    if (matchKeywords(userMessages, ['test', 'spec', 'coverage', 'unit'])) return 'testing'
  }

  // Keyword refinement (second pass)
  if (hasEdit) {
    if (matchKeywords(userMessages, ['fix', 'bug', 'error', 'why', 'broken', 'debug', 'crash', 'fail'])) {
      return 'debugging'
    }
    if (matchKeywords(userMessages, ['refactor', 'clean', 'rename', 'reorganize', 'simplify', 'restructure'])) {
      return 'refactoring'
    }
    if (matchKeywords(userMessages, ['test', 'spec', 'coverage'])) return 'testing'
    if (matchKeywords(userMessages, ['add', 'implement', 'create', 'build', 'new', 'feature'])) {
      return 'feature'
    }
    return 'feature' // default for edit-heavy sessions
  }

  if (hasBash) {
    if (matchKeywords(userMessages, ['fix', 'bug', 'error', 'debug'])) return 'debugging'
    if (matchKeywords(userMessages, ['deploy', 'ci', 'build', 'release', 'publish'])) return 'build-deploy'
    return 'debugging' // default for bash-heavy without edit
  }

  if (hasRead && !hasEdit && !hasBash) return 'exploration'

  if (hasAgent) return 'feature' // agent usage is usually feature work

  if (noTools) {
    if (matchKeywords(userMessages, ['plan', 'design', 'architecture', 'how should', 'approach', 'strategy'])) {
      return 'planning'
    }
    if (matchKeywords(userMessages, ['idea', 'what if', 'options', 'compare', 'alternative', 'brainstorm'])) {
      return 'brainstorming'
    }
    return 'conversation'
  }

  return 'conversation'
}

function matchKeywords(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw))
}

export function countRetries(session: ParsedSession): number {
  const sorted = [...session.turns].sort((a, b) => a.timestamp - b.timestamp)
  let retries = 0
  let sawEdit = false
  let sawBashAfterEdit = false

  for (const turn of sorted) {
    const hasEdit = turn.toolNames.some((n) => EDIT_TOOLS.has(n))
    const hasBash = turn.toolNames.some((n) => BASH_TOOLS.has(n))

    if (hasEdit) {
      if (sawBashAfterEdit) retries++
      sawEdit = true
      sawBashAfterEdit = false
    } else if (hasBash && sawEdit) {
      sawBashAfterEdit = true
    }
  }

  return retries
}

export function getTopShellCommands(session: ParsedSession, limit = 5): string[] {
  const freq = new Map<string, number>()
  for (const turn of session.turns) {
    for (const cmd of turn.bashCommands) {
      const key = cmd.trim().split(' ').slice(0, 3).join(' ') // normalize to first 3 words
      freq.set(key, (freq.get(key) ?? 0) + 1)
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([cmd]) => cmd)
}

export function classifySession(session: ParsedSession): void {
  // Deferred import to avoid loading electron in unit tests
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getDb } = require('./db') as typeof import('./db')
  const db = getDb()
  const activityType = classifyActivity(session)
  const retryCount = countRetries(session)
  const allToolNames = new Set(session.turns.flatMap((t) => t.toolNames))
  const hasEdits = [...allToolNames].some((n) => EDIT_TOOLS.has(n))
  const oneShotSuccess = hasEdits && retryCount === 0 ? 1 : 0
  const topCmds = getTopShellCommands(session)
  const totalBashCmds = session.turns.reduce((acc, t) => acc + t.bashCommands.length, 0)

  db.prepare(`
    INSERT OR REPLACE INTO session_activity
      (session_id, activity_type, retry_count, one_shot_success, top_shell_commands, shell_command_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    session.sessionId,
    activityType,
    retryCount,
    oneShotSuccess,
    JSON.stringify(topCmds),
    totalBashCmds
  )
}
