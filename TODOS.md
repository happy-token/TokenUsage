# TODOS

## Open

### CI: Add PR test gate workflow
**What:** Add `.github/workflows/ci.yml` that runs `pnpm install && pnpm test && pnpm run typecheck` on every PR.
**Why:** The existing workflow only triggers on version tag push (release builds). Without a CI gate, a contributor who breaks tests won't know until a maintainer manually runs them. The test suite exists but nothing enforces it on contributions.
**How to start:** Copy `.github/workflows/release.yml`, strip the signing/packaging steps, add a single `pnpm test && pnpm run typecheck` job triggered on `pull_request`.
**Effort:** ~15 lines.

### Docs: Document models.json format in CONTRIBUTING.md
**What:** Add a paragraph to CONTRIBUTING.md explaining how to add a new model to `resources/models.json`.
**Why:** The key names differ from what contributors expect (`inputCostPer1M` not `input_price`). Without documentation, every contributor who wants to add a new model must read the source to discover the format.
**How to start:** Add an example block in CONTRIBUTING.md under "Adding a new model" showing the 4 required keys with real values.
**Effort:** ~10 lines of documentation.
