# Contributing to TokenUsage

Thank you for your interest in contributing! TokenUsage is a community-driven project, and we welcome contributions of all kinds — code, documentation, bug reports, and feature ideas.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). Please read it before participating.

## Ways to Contribute

- **Report bugs** via [GitHub Issues](https://github.com/happy-token/TokenUsage/issues/new?template=bug_report.md)
- **Request features** via [Feature Requests](https://github.com/happy-token/TokenUsage/issues/new?template=feature_request.md)
- **Discuss ideas** in [GitHub Discussions](https://github.com/happy-token/TokenUsage/discussions)
- **Submit code** via Pull Requests (see below)
- **Improve docs** — README, ROADMAP, translations
- **Add model pricing** — keep `resources/models.json` up to date

## Development Setup

```bash
# Requires Node.js 20+ and pnpm 9+
git clone https://github.com/happy-token/TokenUsage.git
cd TokenUsage
pnpm install
pnpm run dev
```

## Running Tests

```bash
pnpm test          # unit tests (Vitest)
pnpm run test:e2e  # end-to-end tests (Playwright)
pnpm run typecheck # TypeScript check
```

All PRs must pass CI (`pnpm test && pnpm run typecheck`) before merging.

## Project Documentation

| Document | Purpose |
|---|---|
| [README.md](./README.md) | Project overview, features, FAQ |
| [README_CN.md](./README_CN.md) | 中文文档 |
| [ROADMAP.md](./ROADMAP.md) | Planned features and development timeline |
| [PRD.md](./PRD.md) | Product Requirements Document |
| [design.md](./design.md) | Design system and UI/UX guidelines |

## Adding a New Model

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

The key must be the canonical model ID (e.g., `claude-sonnet-4-6`). The parser
also matches versioned suffixes by prefix, so `claude-sonnet-4-6-20260101` will
resolve to the `claude-sonnet-4-6` entry automatically.

After adding a new model, run `pnpm test` to confirm nothing regressed.

## Pull Request Guidelines

- **Keep PRs focused** — one feature or fix per PR
- **Add or update tests** for any logic changes
- **Follow the existing code style** — match the patterns in the codebase
- **Run `pnpm test && pnpm run typecheck`** before opening the PR
- **Update documentation** if your change affects user-facing behavior
- **Use conventional commits** — `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`

## Code Review

All PRs are reviewed by maintainers. We check for:

- Correctness and edge case handling
- Test coverage (≥80% target)
- Security (no secrets, safe IPC, proper CSP)
- Performance (no N+1 queries, efficient SQL)
- Code clarity and naming

## Release Process

Releases are triggered by pushing a `v*` tag (e.g., `v0.2.0`). See the [release workflow](./.github/workflows/release.yml) for details.

## Questions?

Start a [GitHub Discussion](https://github.com/happy-token/TokenUsage/discussions) — we're happy to help!
