#!/usr/bin/env npx tsx
/**
 * Sync models.json from anomalyco/models.dev
 *
 * Fetches all Anthropic model TOML files from the models.dev GitHub repo,
 * extracts pricing, and writes an updated resources/models.json.
 *
 * Usage:
 *   pnpm run sync-models
 *   npx tsx scripts/sync-models.ts
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const MODELS_DEV_API = 'https://api.github.com/repos/anomalyco/models.dev'
const ANTHROPIC_MODELS_DIR = 'providers/anthropic/models'
const OUT_PATH = join(__dirname, '..', 'resources', 'models.json')

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
  // 1. List all model TOML files
  const listUrl = `${MODELS_DEV_API}/contents/${ANTHROPIC_MODELS_DIR}`
  const listRes = await fetch(listUrl, {
    headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'tokenusage-sync' }
  })
  if (!listRes.ok) {
    console.error(`Failed to list models: ${listRes.status} ${listRes.statusText}`)
    process.exit(1)
  }
  const files = (await listRes.json()) as Array<{ name: string; download_url: string }>
  const tomlFiles = files.filter(f => f.name.endsWith('.toml'))

  // 2. Fetch and parse each TOML
  const pricing: Record<string, ModelPricing> = {}

  for (const file of tomlFiles) {
    const modelId = file.name.replace(/\.toml$/, '')
    try {
      const tomlRes = await fetch(file.download_url)
      if (!tomlRes.ok) {
        console.warn(`  SKIP ${modelId}: HTTP ${tomlRes.status}`)
        continue
      }
      const toml = await tomlRes.text()
      const cost = parseTomlCost(toml)

      if (!cost.input) {
        console.warn(`  SKIP ${modelId}: no cost section`)
        continue
      }

      pricing[modelId] = {
        inputCostPer1M: cost.input,
        outputCostPer1M: cost.output ?? cost.input * 5,
        cacheReadCostPer1M: cost.cache_read ?? cost.input * 0.1,
        cacheWriteCostPer1M: cost.cache_write ?? cost.input * 1.25
      }
      console.log(`  OK   ${modelId}: $${cost.input}/M in, $${cost.output}/M out`)
    } catch (err) {
      console.warn(`  FAIL ${modelId}: ${err instanceof Error ? err.message : err}`)
    }
  }

  // 3. Write output
  writeFileSync(OUT_PATH, JSON.stringify(pricing, null, 2) + '\n')
  console.log(`\nWrote ${Object.keys(pricing).length} models to ${OUT_PATH}`)
}

/** Minimal TOML cost parser — reads [cost] section only */
function parseTomlCost(toml: string): TomlCost {
  const cost: TomlCost = {}
  let inCost = false

  for (const line of toml.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '[cost]') { inCost = true; continue }
    if (trimmed.startsWith('[') && inCost) break // next section

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
