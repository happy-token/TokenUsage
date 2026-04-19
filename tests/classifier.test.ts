import { describe, it, expect } from 'vitest'
import { classifyActivity, countRetries, classifyShellCommand } from '../src/main/classifier'
import type { ParsedSession } from '../src/main/types'

function makeSession(overrides: Partial<ParsedSession> = {}): ParsedSession {
  return {
    sessionId: 'test-session',
    projectId: 'test-project',
    projectName: 'test',
    startTime: 0,
    endTime: 1000,
    durationMs: 1000,
    inputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0.001,
    model: 'claude-sonnet-4-6',
    gitBranch: 'main',
    ccVersion: '2.0',
    turns: [],
    ...overrides
  }
}

function makeTurn(
  role: 'user' | 'assistant',
  toolNames: string[] = [],
  bashCommands: string[] = [],
  userMessage?: string
) {
  return {
    turnId: Math.random().toString(36),
    sessionId: 'test-session',
    timestamp: Date.now(),
    role,
    userMessage,
    toolNames,
    bashCommands,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0
  }
}

describe('classifyActivity', () => {
  it('classifies feature development', () => {
    const session = makeSession({
      turns: [
        makeTurn('user', [], [], 'implement the login feature'),
        makeTurn('assistant', ['Edit', 'Read'])
      ]
    })
    expect(classifyActivity(session)).toBe('feature')
  })

  it('classifies debugging', () => {
    const session = makeSession({
      turns: [
        makeTurn('user', [], [], 'fix this bug, it is broken'),
        makeTurn('assistant', ['Edit', 'Bash'], ['npm test'])
      ]
    })
    expect(classifyActivity(session)).toBe('debugging')
  })

  it('classifies refactoring', () => {
    const session = makeSession({
      turns: [
        makeTurn('user', [], [], 'refactor this module to be cleaner'),
        makeTurn('assistant', ['Edit'])
      ]
    })
    expect(classifyActivity(session)).toBe('refactoring')
  })

  it('classifies testing', () => {
    const session = makeSession({
      turns: [
        makeTurn('user', [], [], 'add test coverage'),
        makeTurn('assistant', ['Bash'], ['bun test'])
      ]
    })
    expect(classifyActivity(session)).toBe('testing')
  })

  it('classifies git operations', () => {
    const session = makeSession({
      turns: [
        makeTurn('user', [], [], 'commit and push'),
        makeTurn('assistant', ['Bash'], ['git add .', 'git commit -m "feat"', 'git push'])
      ]
    })
    expect(classifyActivity(session)).toBe('git')
  })

  it('classifies exploration (read-only)', () => {
    const session = makeSession({
      turns: [
        makeTurn('user', [], [], 'show me how this works'),
        makeTurn('assistant', ['Read', 'Glob', 'Grep'])
      ]
    })
    expect(classifyActivity(session)).toBe('exploration')
  })

  it('classifies planning (no tools)', () => {
    const session = makeSession({
      turns: [
        makeTurn('user', [], [], 'plan the architecture for this feature'),
        makeTurn('assistant', [])
      ]
    })
    expect(classifyActivity(session)).toBe('planning')
  })

  it('classifies brainstorming (no tools)', () => {
    const session = makeSession({
      turns: [
        makeTurn('user', [], [], 'what are the options for auth implementation'),
        makeTurn('assistant', [])
      ]
    })
    expect(classifyActivity(session)).toBe('brainstorming')
  })

  it('classifies conversation (no tools, generic message)', () => {
    const session = makeSession({
      turns: [
        makeTurn('user', [], [], 'how are you'),
        makeTurn('assistant', [])
      ]
    })
    expect(classifyActivity(session)).toBe('conversation')
  })
})

describe('countRetries', () => {
  it('returns 0 for single edit, no bash', () => {
    const session = makeSession({
      turns: [
        makeTurn('user'),
        makeTurn('assistant', ['Edit'])
      ]
    })
    expect(countRetries(session)).toBe(0)
  })

  it('counts one retry for edit→bash→edit pattern', () => {
    const session = makeSession({
      turns: [
        makeTurn('assistant', ['Edit']),
        makeTurn('assistant', ['Bash'], ['npm test']),
        makeTurn('assistant', ['Edit'])
      ]
    })
    expect(countRetries(session)).toBe(1)
  })

  it('counts two retries for edit→bash→edit→bash→edit', () => {
    const session = makeSession({
      turns: [
        makeTurn('assistant', ['Edit']),
        makeTurn('assistant', ['Bash'], ['npm test']),
        makeTurn('assistant', ['Edit']),
        makeTurn('assistant', ['Bash'], ['npm test']),
        makeTurn('assistant', ['Edit'])
      ]
    })
    expect(countRetries(session)).toBe(2)
  })

  it('returns 0 for bash only (no edits)', () => {
    const session = makeSession({
      turns: [makeTurn('assistant', ['Bash'], ['ls -la'])]
    })
    expect(countRetries(session)).toBe(0)
  })

  it('returns 0 for edit then bash (no second edit)', () => {
    const session = makeSession({
      turns: [
        makeTurn('assistant', ['Edit']),
        makeTurn('assistant', ['Bash'], ['npm test'])
      ]
    })
    expect(countRetries(session)).toBe(0)
  })
})

describe('classifyShellCommand', () => {
  it('classifies bun test as test', () => {
    expect(classifyShellCommand('bun test')).toBe('test')
  })
  it('classifies git commit as git', () => {
    expect(classifyShellCommand('git commit -m "feat"')).toBe('git')
  })
  it('classifies npm run build as build', () => {
    expect(classifyShellCommand('npm run build')).toBe('build')
  })
  it('classifies npm install as install', () => {
    expect(classifyShellCommand('npm install react')).toBe('install')
  })
  it('classifies cat as file-ops', () => {
    expect(classifyShellCommand('cat src/main.ts')).toBe('file-ops')
  })
  it('classifies node as run-start', () => {
    expect(classifyShellCommand('node server.js')).toBe('run-start')
  })
  it('classifies unknown as other', () => {
    expect(classifyShellCommand('curl https://example.com')).toBe('other')
  })
  it('handles empty string without throwing', () => {
    expect(() => classifyShellCommand('')).not.toThrow()
    expect(classifyShellCommand('')).toBe('other')
  })
})
