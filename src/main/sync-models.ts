import { writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { initPricing } from './parser'

const MODELS_DEV_API = 'https://api.github.com/repos/anomalyco/models.dev'

const DEFAULT_PROVIDERS = [
  'anthropic', 'openai', 'google', 'deepseek',
  'xai', 'mistral', 'groq', 'cerebras',
]

interface ModelPricing {
  inputCostPer1M: number
  outputCostPer1M: number
  cacheReadCostPer1M: number
  cacheWriteCostPer1M: number
}

export interface SyncResult {
  ok: boolean
  modelCount: number
  providerCount: number
  error?: string
}

function modelsPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'models.json')
    : join(__dirname, '../../resources/models.json')
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'tokenusage-sync' }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as T
}

async function syncProvider(
  provider: string,
  pricing: Record<string, ModelPricing>
): Promise<number> {
  const dirPath = `providers/${provider}/models`
  const files = await fetchJson<Array<{ name: string; download_url: string }>>(
    `${MODELS_DEV_API}/contents/${dirPath}`
  )
  const tomlFiles = files.filter(f => f.name.endsWith('.toml'))

  let count = 0
  for (const file of tomlFiles) {
    const modelId = file.name.replace(/\.toml$/, '')
    try {
      const tomlRes = await fetch(file.download_url)
      if (!tomlRes.ok) continue
      const toml = await tomlRes.text()
      const cost = parseTomlCost(toml)
      if (!cost.input) continue

      const key = pricing[modelId] ? `${provider}/${modelId}` : modelId
      pricing[key] = {
        inputCostPer1M: cost.input,
        outputCostPer1M: cost.output ?? cost.input * 5,
        cacheReadCostPer1M: cost.cache_read ?? cost.input * 0.1,
        cacheWriteCostPer1M: cost.cache_write ?? cost.input * 1.25
      }
      count++
    } catch { /* skip individual model failures */ }
  }
  return count
}

function parseTomlCost(toml: string): { input?: number; output?: number; cache_read?: number; cache_write?: number } {
  const cost: Record<string, number> = {}
  let inCost = false
  for (const line of toml.split('\n')) {
    const t = line.trim()
    if (t === '[cost]') { inCost = true; continue }
    if (t.startsWith('[') && inCost) break
    if (inCost) {
      const m = t.match(/^(\w+)\s*=\s*([\d.]+)/)
      if (m) cost[m[1]!] = parseFloat(m[2]!)
    }
  }
  return cost
}

export async function syncModels(): Promise<SyncResult> {
  const pricing: Record<string, ModelPricing> = {}
  const providers = DEFAULT_PROVIDERS
  let modelCount = 0
  let providerCount = 0

  for (const provider of providers) {
    try {
      const n = await syncProvider(provider, pricing)
      if (n > 0) providerCount++
      modelCount += n
    } catch {
      // skip provider on network failure
    }
  }

  if (modelCount === 0) {
    return { ok: false, modelCount: 0, providerCount: 0, error: 'Failed to fetch any models. Check network connection.' }
  }

  writeFileSync(modelsPath(), JSON.stringify(pricing, null, 2) + '\n')
  initPricing(modelsPath())

  return { ok: true, modelCount, providerCount }
}
