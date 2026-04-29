# Contributing to TokenUsage

Thank you for your interest in contributing.

## Development setup

```bash
# Requires Node.js 20+ and pnpm
pnpm install
pnpm run dev
```

## Running tests

```bash
pnpm test          # unit tests (Vitest)
pnpm run typecheck # TypeScript check
```

All PRs must pass both before merging.

## Adding a new model

Model pricing lives in `resources/models.json`. Each entry uses this shape:

```json
"claude-modelname-X-Y": {
  "inputCostPer1M": 3.0,
  "outputCostPer1M": 15.0,
  "cacheReadCostPer1M": 0.3,
  "cacheWriteCostPer1M": 3.75
}
```

All costs are in USD per 1 million tokens. Check the
[Anthropic pricing page](https://www.anthropic.com/pricing) for current values.

The key must be the canonical model ID (e.g. `claude-sonnet-4-6`). The parser
also matches versioned suffixes by prefix, so `claude-sonnet-4-6-20260101` will
resolve to the `claude-sonnet-4-6` entry automatically.

After adding a new model, run `pnpm test` to confirm nothing regressed.

## Pull requests

- Keep PRs focused — one feature or fix per PR
- Add or update tests for any logic changes
- Run `pnpm test && pnpm run typecheck` before opening the PR
