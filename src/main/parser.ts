import { createReadStream, readFileSync } from 'fs'
import { stat } from 'fs/promises'
import { basename } from 'path'
import { createInterface } from 'readline'
import type { ParsedSession, ParsedTurn } from './types'

const BASH_TOOLS = new Set(['Bash', 'BashTool', 'PowerShellTool'])

// UUID pattern — used to extract session_id from filename
const UUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

interface ModelPricing {
  inputCostPer1M: number
  outputCostPer1M: number
  cacheReadCostPer1M: number
  cacheWriteCostPer1M: number
}

let pricingTable: Record<string, ModelPricing> = {}

export function initPricing(path: string): boolean {
  try {
    pricingTable = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, ModelPricing>
    return true
  } catch (err) {
    console.warn('Failed to load pricing from', path, err)
    return false
  }
}

function lookupPricing(modelName: string): ModelPricing | undefined {
  const exact = pricingTable[modelName]
  if (exact) return exact
  return Object.entries(pricingTable).find(([k]) =>
    modelName.startsWith(k.split('-').slice(0, 4).join('-'))
  )?.[1]
}

export function getInputCostPer1M(modelName: string): number {
  return lookupPricing(modelName)?.inputCostPer1M ?? 0
}

export function computeCostFromTokens(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens: number
): number {
  // Match exact key first, then by 4-segment prefix to handle versioned model names like claude-opus-4-7-20251001
  const pricing = lookupPricing(modelName)
  if (!pricing) return 0
  return (
    (inputTokens * pricing.inputCostPer1M +
      outputTokens * pricing.outputCostPer1M +
      cacheReadTokens * pricing.cacheReadCostPer1M +
      cacheWriteTokens * pricing.cacheWriteCostPer1M) / 1_000_000
  )
}

export interface ParseResult {
  session: ParsedSession | null
  error: string | null
  bytesRead: number
}

export async function parseJsonlFile(
  filePath: string,
  startOffset = 0
): Promise<ParseResult> {
  const uuidMatch = basename(filePath).match(UUID_RE)
  if (!uuidMatch) {
    return { session: null, error: `Cannot extract session_id from filename: ${filePath}`, bytesRead: 0 }
  }
  const sessionId = uuidMatch[1]

  let totalBytes = startOffset
  let lastGoodOffset = startOffset

  const turns: ParsedTurn[] = []
  let projectName = ''
  let projectPath = ''
  let gitBranch = ''
  let ccVersion = ''
  let model = ''
  let sessionCacheRead = 0
  let sessionCacheWrite = 0

  try {
    const fileStats = await stat(filePath)
    const fileSize = fileStats.size

    if (fileSize === startOffset) {
      return { session: null, error: null, bytesRead: startOffset }
    }

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(filePath, {
        start: startOffset,
        encoding: 'utf8'
      })
      const rl = createInterface({ input: stream, crlfDelay: Infinity })

      rl.on('line', (line) => {
        const lineBytes = Buffer.byteLength(line, 'utf8') + 1 // +1 for newline
        const lineStartOffset = totalBytes
        totalBytes += lineBytes

        if (!line.trim()) return

        let record: Record<string, unknown>
        try {
          record = JSON.parse(line)
        } catch {
          // Truncated or malformed line — record start offset so next run retries from here
          totalBytes = lineStartOffset
          return
        }

        lastGoodOffset = totalBytes

        const recType = record['type'] as string
        if (recType === 'summary' || recType === 'file-history-snapshot') return

        // Extract project name from cwd (URL-decoded)
        if (!projectName && record['cwd']) {
          projectName = decodeCwd(record['cwd'] as string)
          projectPath = decodeProjectPath(record['cwd'] as string)
        }
        if (!gitBranch && record['gitBranch']) gitBranch = record['gitBranch'] as string
        if (!ccVersion && record['version']) ccVersion = record['version'] as string

        const msg = record['message'] as Record<string, unknown> | undefined
        if (!msg) return

        const role = msg['role'] as string
        if (role !== 'user' && role !== 'assistant') return

        const turnModel = (msg['model'] as string | undefined) ?? ''
        if (!model && turnModel) model = turnModel

        const usage = msg['usage'] as Record<string, number> | undefined
        const inputTokens = usage?.['input_tokens'] ?? 0
        const outputTokens = usage?.['output_tokens'] ?? 0
        const cacheReadTokens = usage?.['cache_read_input_tokens'] ?? 0
        const cacheWriteTokens = usage?.['cache_creation_input_tokens'] ?? 0
        const costUsd = (record['costUSD'] as number | undefined) ??
          computeCostFromTokens(turnModel || model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens)
        sessionCacheRead += cacheReadTokens
        sessionCacheWrite += cacheWriteTokens

        const turnId = record['uuid'] as string
        const timestamp = new Date(record['timestamp'] as string).getTime()

        // Extract tool_use entries from content
        const content = msg['content']
        const toolNames: string[] = []
        const bashCommands: string[] = []
        let userMessage: string | undefined

        if (Array.isArray(content)) {
          for (const item of content) {
            if (!item || typeof item !== 'object') continue
            const typedItem = item as Record<string, unknown>
            if (typedItem['type'] === 'tool_use') {
              const name = typedItem['name'] as string
              toolNames.push(name)
              if (BASH_TOOLS.has(name)) {
                const input = typedItem['input'] as Record<string, unknown> | undefined
                const cmd = (input?.['command'] as string | undefined) ?? ''
                if (cmd) bashCommands.push(cmd)
              }
            } else if (typedItem['type'] === 'text' && role === 'user') {
              userMessage = (typedItem['text'] as string | undefined)?.slice(0, 500)
            }
          }
        } else if (typeof content === 'string' && role === 'user') {
          userMessage = content.slice(0, 500)
        }

        turns.push({
          turnId,
          sessionId,
          timestamp,
          role: role as 'user' | 'assistant',
          userMessage,
          toolNames,
          bashCommands,
          inputTokens,
          outputTokens,
          costUsd
        })
      })

      rl.on('close', resolve)
      rl.on('error', reject)
      stream.on('error', reject)
    })
  } catch (err) {
    return {
      session: null,
      error: err instanceof Error ? err.message : String(err),
      bytesRead: lastGoodOffset
    }
  }

  if (turns.length === 0) {
    return { session: null, error: null, bytesRead: lastGoodOffset }
  }

  const timestamps = turns.map((t) => t.timestamp).filter(Boolean)
  const startTime = Math.min(...timestamps)
  const endTime = Math.max(...timestamps)

  const totals = turns.reduce(
    (acc, t) => ({
      inputTokens: acc.inputTokens + t.inputTokens,
      outputTokens: acc.outputTokens + t.outputTokens,
      costUsd: acc.costUsd + t.costUsd
    }),
    { inputTokens: 0, outputTokens: 0, costUsd: 0 }
  )

  const session: ParsedSession = {
    sessionId,
    projectId: projectIdFromName(projectName || sessionId),
    projectName: projectName || sessionId,
    projectPath: projectPath || null,
    startTime,
    endTime,
    durationMs: endTime - startTime,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    cacheReadTokens: sessionCacheRead,
    cacheWriteTokens: sessionCacheWrite,
    costUsd: totals.costUsd,
    model,
    gitBranch,
    ccVersion,
    turns
  }

  return { session, error: null, bytesRead: lastGoodOffset }
}

function decodeCwd(cwd: string): string {
  try {
    const parts = cwd.replace(/\\/g, '/').split('/')
    const last = parts[parts.length - 1] || parts[parts.length - 2] || cwd
    return decodeURIComponent(last)
  } catch {
    const parts = cwd.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1] || cwd
  }
}

function decodeProjectPath(cwd: string): string {
  try {
    return decodeURIComponent(cwd.replace(/\\/g, '/'))
  } catch {
    return cwd.replace(/\\/g, '/')
  }
}

export function projectIdFromName(name: string): string {
  // Stable hash of the project path for use as primary key
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (Math.imul(31, hash) + name.charCodeAt(i)) | 0
  }
  return `proj_${Math.abs(hash).toString(16)}`
}
