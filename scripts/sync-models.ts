#!/usr/bin/env npx tsx
/**
 * Sync models.json from anomalyco/models.dev
 *
 * Fetches model TOML files from the models.dev GitHub repo, extracts pricing,
 * and writes an updated resources/models.json.
 *
 * Usage:
 *   pnpm run sync-models                          # default providers
 *   pnpm run sync-models anthropic openai google  # specific providers
 *   npx tsx scripts/sync-models.ts --all          # all 100+ providers
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const MODELS_DEV_API = 'https://api.github.com/repos/anomalyco/models.dev'
const OUT_PATH = join(__dirname, '..', 'resources', 'models.json')

// Default providers commonly used with Claude Code
const DEFAULT_PROVIDERS = [
  'anthropic',
  'openai',
  'google',
  'deepseek',
  'xai',
  'mistral',
  'groq',
  'cohere',
  'cerebras',
]

interface ModelPricing {
  inputCostPer1M: number
  outputCostPer1M: number
  cacheReadCostPer1M: number
  cacheWriteCostPer1M: number
}

interface TomlCost {
  input?: number
  output?: number
  cache_read?: number
  cache_write?: number
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter(a => a !== '--all')

  let providers: string[]

  if (process.argv.includes('--all')) {
    // Fetch the full provider list
    const res = await fetch(`${MODELS_DEV_API}/contents/providers`, {
      headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'tokenusage-sync' }
    })
    if (!res.ok) {
      console.error(`Failed to list providers: ${res.status}`)
      process.exit(1)
    }
    const dirs = (await res.json()) as Array<{ name: string; type: string }>
    providers = dirs.filter(d => d.type === 'dir').map(d => d.name)
    console.log(`Syncing ALL ${providers.length} providers...`)
  } else if (args.length > 0) {
    providers = args
  } else {
    providers = DEFAULT_PROVIDERS
  }

  console.log(`Providers: ${providers.join(', ')}\n`)

  const pricing: Record<string, ModelPricing> = {}
  let totalModels = 0
  const failures: string[] = []

  for (const provider of providers) {
    try {
      await syncProvider(provider, pricing)
    } catch (err) {
      console.warn(`  FAIL ${provider}: ${err instanceof Error ? err.message : err}`)
      failures.push(provider)
    }
  }

  // Write output
  writeFileSync(OUT_PATH, JSON.stringify(pricing, null, 2) + '\n')
  const summary = `\nWrote ${Object.keys(pricing).length} models from ${providers.length} providers to ${OUT_PATH}`
  console.log(summary)
  if (failures.length > 0) {
    console.warn(`Skipped providers: ${failures.join(', ')}`)
  }
}

async function syncProvider(provider: string, pricing: Record<string, ModelPricing>): Promise<number> {
  const dirPath = `providers/${provider}/models`
  const listUrl = `${MODELS_DEV_API}/contents/${dirPath}`
  const listRes = await fetch(listUrl, {
    headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'tokenusage-sync' }
  })
  if (!listRes.ok) {
    console.warn(`  ${provider}: HTTP ${listRes.status}`)
    return 0
  }
  const files = (await listRes.json()) as Array<{ name: string; download_url: string }>
  const tomlFiles = files.filter(f => f.name.endsWith('.toml'))

  let count = 0
  for (const file of tomlFiles) {
    const modelId = file.name.replace(/\.toml$/, '')
    try {
      const tomlRes = await fetch(file.download_url)
      if (!tomlRes.ok) {
        console.warn(`    SKIP ${modelId}: HTTP ${tomlRes.status}`)
        continue
      }
      const toml = await tomlRes.text()
      const cost = parseTomlCost(toml)

      if (!cost.input) continue // image/embedding models

      const key = pricing[modelId] && !modelId.startsWith(`${provider}/`)
        ? `${provider}/${modelId}`
        : modelId

      pricing[key] = {
        inputCostPer1M: cost.input,
        outputCostPer1M: cost.output ?? cost.input * 5,
        cacheReadCostPer1M: cost.cache_read ?? cost.input * 0.1,
        cacheWriteCostPer1M: cost.cache_write ?? cost.input * 1.25
      }
      count++
    } catch (err) {
      console.warn(`    FAIL ${modelId}: ${err instanceof Error ? err.message : err}`)
    }
  }
  console.log(`  ${provider}: ${count} models`)
  return count
}

/** Minimal TOML cost parser — reads [cost] section only */
function parseTomlCost(toml: string): TomlCost {
  const cost: TomlCost = {}
  let inCost = false

  for (const line of toml.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '[cost]') { inCost = true; continue }
    if (trimmed.startsWith('[') && inCost) break

    if (inCost) {
      const m = trimmed.match(/^(\w+)\s*=\s*([\d.]+)/)
      if (m) {
        const key = m[1]!
        const val = parseFloat(m[2]!)
        if (key === 'input') cost.input = val
        else if (key === 'output') cost.output = val
        else if (key === 'cache_read') cost.cache_read = val
        else if (key === 'cache_write') cost.cache_write = val
      }
    }
  }

  return cost
}

main()
