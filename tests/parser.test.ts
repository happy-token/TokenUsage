import { describe, it, expect } from 'vitest'
import { join } from 'path'
import { parseJsonlFile, projectIdFromName } from '../src/main/parser'

const FIXTURES = join(__dirname, 'fixtures')

describe('parseJsonlFile — session identity contract', () => {
  it('session_id equals filename UUID, not uuid field', async () => {
    const filePath = join(FIXTURES, 'dc087fef-7129-4513-b4ca-567bfced6076.jsonl')
    const { session, error } = await parseJsonlFile(filePath)

    expect(error).toBeNull()
    expect(session).not.toBeNull()
    // session_id MUST come from filename, not from the uuid field (which is message-level)
    expect(session!.sessionId).toBe('dc087fef-7129-4513-b4ca-567bfced6076')
  })

  it('uuid field in JSONL is per-message ID — 4 lines = 4 different turn IDs', async () => {
    const filePath = join(FIXTURES, 'dc087fef-7129-4513-b4ca-567bfced6076.jsonl')
    const { session } = await parseJsonlFile(filePath)

    const turnIds = session!.turns.map((t) => t.turnId)
    const unique = new Set(turnIds)
    // All turn IDs should be unique (each line has a different uuid)
    expect(unique.size).toBe(turnIds.length)
    // None of the turn IDs should equal the session ID
    expect(turnIds.includes(session!.sessionId)).toBe(false)
  })
})

describe('parseJsonlFile — costUSD handling', () => {
  it('uses costUSD field when present — sums across turns', async () => {
    const filePath = join(FIXTURES, 'dc087fef-7129-4513-b4ca-567bfced6076.jsonl')
    const { session } = await parseJsonlFile(filePath)

    // Two costUSD values: 0.00312 + 0.00100 = 0.00412
    expect(session!.costUsd).toBeCloseTo(0.00412, 5)
  })

  it('returns zero cost when costUSD field is absent (old CC version)', async () => {
    const filePath = join(FIXTURES, 'no-cost-usd-11111111-1111-1111-1111-111111111111.jsonl')
    const { session, error } = await parseJsonlFile(filePath)

    expect(error).toBeNull()
    expect(session).not.toBeNull()
    expect(session!.costUsd).toBe(0)
  })
})

describe('parseJsonlFile — cache token aggregation', () => {
  it('aggregates cache_read_input_tokens across all turns', async () => {
    const filePath = join(FIXTURES, 'dc087fef-7129-4513-b4ca-567bfced6076.jsonl')
    const { session } = await parseJsonlFile(filePath)

    // Turn 2: cache_read=800, Turn 4: cache_read=400 → total 1200
    expect(session!.cacheReadTokens).toBe(1200)
  })

  it('aggregates cache_creation_input_tokens across all turns', async () => {
    const filePath = join(FIXTURES, 'dc087fef-7129-4513-b4ca-567bfced6076.jsonl')
    const { session } = await parseJsonlFile(filePath)

    // Turn 2: cache_write=100, Turn 4: cache_write=0 → total 100
    expect(session!.cacheWriteTokens).toBe(100)
  })

  it('defaults missing cache tokens to 0', async () => {
    const filePath = join(FIXTURES, 'no-cost-usd-11111111-1111-1111-1111-111111111111.jsonl')
    const { session } = await parseJsonlFile(filePath)

    expect(session!.cacheReadTokens).toBe(0)
    expect(session!.cacheWriteTokens).toBe(0)
  })
})

describe('parseJsonlFile — tool extraction', () => {
  it('extracts tool names from tool_use content blocks', async () => {
    const filePath = join(FIXTURES, 'dc087fef-7129-4513-b4ca-567bfced6076.jsonl')
    const { session } = await parseJsonlFile(filePath)

    const assistantTurns = session!.turns.filter((t) => t.role === 'assistant')
    const allTools = assistantTurns.flatMap((t) => t.toolNames)
    expect(allTools).toContain('Read')
    expect(allTools).toContain('Edit')
    expect(allTools).toContain('Bash')
  })

  it('captures bash commands from Bash tool_use input.command', async () => {
    const filePath = join(FIXTURES, 'dc087fef-7129-4513-b4ca-567bfced6076.jsonl')
    const { session } = await parseJsonlFile(filePath)

    const allBashCmds = session!.turns.flatMap((t) => t.bashCommands)
    expect(allBashCmds).toContain('bun test')
  })
})

describe('parseJsonlFile — edge cases', () => {
  it('returns null session and no error for empty file', async () => {
    const filePath = join(FIXTURES, 'empty-22222222-2222-2222-2222-222222222222.jsonl')
    const { session, error, bytesRead } = await parseJsonlFile(filePath)

    expect(error).toBeNull()
    expect(session).toBeNull()
    expect(bytesRead).toBeGreaterThanOrEqual(0)
  })

  it('returns truncated file — parses complete lines, skips truncated last line', async () => {
    const filePath = join(FIXTURES, 'truncated-33333333-3333-3333-3333-333333333333.jsonl')
    const { session, error } = await parseJsonlFile(filePath)

    // Should NOT error — truncated line is skipped, complete lines parsed
    expect(error).toBeNull()
    // The 2 complete lines (user + assistant) should produce a session
    expect(session).not.toBeNull()
    expect(session!.costUsd).toBeCloseTo(0.001, 5)
  })

  it('bytesRead for truncated file points to start of bad line, not end', async () => {
    const filePath = join(FIXTURES, 'truncated-33333333-3333-3333-3333-333333333333.jsonl')
    const { bytesRead } = await parseJsonlFile(filePath)
    const { size } = await import('fs').then((fs) =>
      fs.promises.stat(filePath)
    )
    // bytesRead should be less than file size (not past the truncated line)
    expect(bytesRead).toBeLessThan(size)
  })

  it('returns error (not throw) when filename has no valid UUID', async () => {
    const filePath = join(FIXTURES, 'no-uuid-in-name.jsonl')
    const { session, error } = await parseJsonlFile(filePath)

    expect(session).toBeNull()
    expect(error).not.toBeNull()
    expect(error).toContain('session_id')
  })

  it('handles unknown type field values by skipping them silently', async () => {
    // The fixture has type='summary' and type='file-history-snapshot' — these are skipped
    const filePath = join(FIXTURES, 'dc087fef-7129-4513-b4ca-567bfced6076.jsonl')
    const { session, error } = await parseJsonlFile(filePath)

    expect(error).toBeNull()
    expect(session).not.toBeNull()
  })
})

describe('parseJsonlFile — project name extraction', () => {
  it('extracts project name from cwd field', async () => {
    const filePath = join(FIXTURES, 'dc087fef-7129-4513-b4ca-567bfced6076.jsonl')
    const { session } = await parseJsonlFile(filePath)

    expect(session!.projectName).toBe('my-project')
  })

  it('handles cwd with spaces in path', async () => {
    const filePath = join(FIXTURES, 'url-encoded-44444444-4444-4444-4444-444444444444.jsonl')
    const { session, error } = await parseJsonlFile(filePath)

    expect(error).toBeNull()
    expect(session).not.toBeNull()
  })
})

describe('projectIdFromName — stable hash', () => {
  it('returns same ID for same name', () => {
    expect(projectIdFromName('my-project')).toBe(projectIdFromName('my-project'))
  })

  it('returns different ID for different names', () => {
    expect(projectIdFromName('project-a')).not.toBe(projectIdFromName('project-b'))
  })

  it('starts with proj_ prefix', () => {
    expect(projectIdFromName('anything')).toMatch(/^proj_[0-9a-f]+$/)
  })
})
