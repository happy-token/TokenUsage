# Product Requirements Document — TokenUsage

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2025-05-05  
**Author:** happy-token  

---

## 1. Executive Summary

TokenUsage is a **free, open-source desktop application** that helps [Claude Code](https://claude.ai/code) users understand, track, and optimize their AI token spending. By reading local JSONL session logs that Claude Code writes automatically, TokenUsage provides rich analytics — cost breakdowns, cache efficiency metrics, session activity classification, and actionable optimization insights — all within a native desktop experience.

**Core value proposition:** Make the hidden costs of AI-assisted development visible, then help users reduce them — without sending any data off-device.

---

## 2. Problem Statement

### 2.1 The Problem

Claude Code users currently have **no built-in visibility** into their token consumption and costs:

- **Opaque costs:** Users see a total monthly bill from Anthropic but can't break it down by project, session, or activity type.
- **No optimization feedback:** There's no way to know whether prompt caching is working effectively, which habits are wasteful, or how to reduce spend without reducing output.
- **No activity insight:** Users can't answer questions like "How much time did I spend debugging vs. writing features this week?" or "Which project consumed the most tokens?"
- **File-based data is inaccessible:** Claude Code writes detailed JSONL logs, but they're raw, unstructured, and impractical for manual analysis.

### 2.2 The Opportunity

Claude Code's session logging is a rich, latent data source. By building a purpose-built analytics layer on top of it, TokenUsage turns an opaque cost center into a transparent, optimizable workflow.

### 2.3 Key User Questions TokenUsage Answers

| Question | Feature |
|---|---|
| How much am I spending on Claude Code? | Overview KPI, daily cost bars |
| Which project costs the most? | Per-project breakdown, cost ranking |
| Is prompt caching saving me money? | Cache ROI (gross savings, net ROI) |
| What am I actually doing with Claude Code? | 10-category session activity classification |
| Where am I wasting tokens? | 9 waste detectors with health scores |
| How does my usage trend over time? | Daily/weekly cost and session charts |

---

## 3. Target Users & Personas

### 3.1 Primary: Indie Developer / Freelancer

- Uses Claude Code daily for side projects and client work
- Pays for their own API usage — cost-sensitive
- Wants to understand where money goes and reduce waste
- Values privacy; suspicious of cloud-based analytics tools

### 3.2 Secondary: Engineering Team Lead

- Manages a team using Claude Code
- Wants to understand team-level usage patterns (future: team view)
- Needs data to justify AI tooling budget to leadership
- Interested in optimization best practices to share with team

### 3.3 Tertiary: AI Power User / Researcher

- Heavy Claude Code user with complex multi-session workflows
- Wants deep analytics: model-level cost, cache efficiency, activity patterns
- May want to export data for custom analysis
- Interested in contributing to the project

---

## 4. Core Features

### 4.1 Data Pipeline (v0.1 — Done)

- **File Watching:** Monitor `~/.claude/projects/**/*.jsonl` via chokidar with 2s debounce
- **Incremental Parsing:** Track `last_byte_offset` per file; skip sub-agent JSONL files
- **Cost Computation:** Use `costUSD` from JSONL when present; fallback to local token-based calculation using `resources/models.json` pricing
- **Local Storage:** SQLite (better-sqlite3) with 7 tables, proper indexing, and legacy DB migration

### 4.2 Analytics Dashboard (v0.1 — Done)

- **Overview Page:** KPI cards (total spend, sessions, cache hit rate, active projects), daily activity bars, per-project cost bars, per-model breakdown, top tools/shell commands
- **Project Detail:** Per-session timeline, activity type distribution, model usage, git branch tracking, session deletion
- **Cache ROI:** Gross savings, write cost, net ROI with approximated pricing

### 4.3 Optimization Engine (v0.1 — Done)

- **Health Scoring:** A–F letter grade based on 9 waste detectors
- **Waste Detectors:** junk-reads, duplicate-reads, low-read-edit-ratio, cache-excess, bash-output-limit, overloaded-claude-md, ghost-agents, ghost-skills, unused-mcp
- **Positive Patterns:** Cache hit rate wins, first-try success rate, good read-edit ratios
- **One-Click Fixes:** Copyable CLI commands for each finding
- **Result Caching:** 1-hour TTL on optimization scans

### 4.4 Session Classification (v0.1 — Done)

- 10 activity types: feature, debugging, refactoring, testing, git, build-deploy, exploration, planning, brainstorming, conversation
- Heuristic-based: tool usage patterns + keyword matching + bash command analysis
- Retry counting and first-try success rate tracking
- Shell command categorization (test, git, build, install, lint, run-start, file-ops)

### 4.5 UX Layer (v0.1 — Done)

- **System Tray:** Custom-drawn icon with live cost stats, accessible without opening main window
- **i18n:** English / 中文 toggle with ~120 translation keys
- **Theme:** Dark / light with CSS custom properties, persistent via localStorage
- **macOS Native:** Custom Dock icon, entitlements, notarization

### 4.6 Planned Features (v0.2+)

See [ROADMAP.md](./ROADMAP.md) for the full list. Key highlights:

- **Insights Page:** Rule-based suggestions from session patterns
- **Export:** CSV/JSON data export
- **Interactive Charts:** Zoomable/pannable time-series
- **CLI Companion:** `tokenusage` command for quick terminal stats
- **Auto-Update:** Seamless in-app updates via electron-updater
- **Custom Rules:** User-defined waste detectors

---

## 5. Technical Architecture

### 5.1 High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│                  Electron Shell                   │
│  ┌──────────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Main Process │  │ Preload  │  │  Renderer  │  │
│  │   (Node.js)   │  │ (Bridge) │  │  (React)   │  │
│  │               │  │          │  │            │  │
│  │  • File Watch │──▶  IPC   ──▶  • Dashboard │  │
│  │  • SQLite DB  │  │          │  • Charts    │  │
│  │  • Parser     │  │          │  • Settings  │  │
│  │  • Classifier │  │          │  • i18n      │  │
│  │  • Optimizer  │  │          │  • Theme     │  │
│  └──────────────┘  └──────────┘  └───────────┘  │
└─────────────────────────────────────────────────┘
```

### 5.2 Technology Choices

| Component | Choice | Rationale |
|---|---|---|
| Shell | Electron 30 | Cross-platform desktop, mature ecosystem |
| Renderer | React 18 + TypeScript | Component model, type safety, large community |
| Build | electron-vite | Fast HMR, good Electron integration |
| Database | better-sqlite3 | Synchronous API, zero-config, embedded |
| File Watch | chokidar | Reliable cross-platform file watching |
| Test | Vitest + Playwright | Fast unit tests, browser-level E2E |
| Package | pnpm | Disk-efficient, strict dependency resolution |

### 5.3 Data Flow

```
Claude Code writes JSONL
        │
        ▼
  chokidar detects change
        │
        ▼
  Parser reads new lines ──▶ Extract session_id, project, turns, tokens
        │
        ▼
  Store in SQLite ──▶ projects, sessions, turns, session_activity
        │
        ▼
  IPC handlers ──▶ Renderer queries via contextBridge
        │
        ▼
  React UI renders dashboard / reports / optimization
```

### 5.4 Database Schema

7 tables with foreign keys and indexes:

- `projects` — per-project aggregates (cost, sessions, last active, cache hit rate)
- `sessions` — individual sessions (timing, tokens, cost, model, git branch)
- `turns` — message turns within a session (role, tools, bash commands, tokens)
- `session_activity` — classified activity type, retry count, first-try success
- `insights` — reserved for future rule-based insights
- `waste_cache` — optimization scan results (findings, health score, wins)
- `file_state` — incremental parse tracking (mtime, byte offset)
- `settings` — key-value store for preferences

Legacy migration: `claudeinsight.db` → `tokenusage.db` for existing users.

### 5.5 Security & Privacy

- **All-local:** No network requests for data. No telemetry. No analytics SDK.
- **Content Security Policy:** Per-renderer CSP in `index.html`
- **Context Isolation:** `contextIsolation: true`, no `nodeIntegration` in renderer
- **External Links:** Whitelisted `https:` and `http:` protocols only
- **Secrets:** `.env` excluded from git via `.gitignore`; `.env.example` provided as template

---

## 6. Success Metrics

### 6.1 User Adoption

| Metric | Target (6 months) | Target (12 months) |
|---|---|---|
| GitHub Stars | 500 | 2,000 |
| Downloads (Releases) | 1,000 | 5,000 |
| Active Users (7-day) | 200 | 1,000 |

### 6.2 Community Health

| Metric | Target |
|---|---|
| External Contributors | 5+ unique contributors |
| Open Issues < 30 days | > 80% triaged |
| PR Review Time | < 7 days median |

### 6.3 Product Quality

| Metric | Target |
|---|---|
| Test Coverage | ≥ 80% |
| TypeScript Strict Mode | Enabled |
| Crash-Free Rate | > 99% |
| Lighthouse Score (renderer) | > 90 |

*Note: As a privacy-first product with no telemetry, adoption metrics rely on GitHub and package manager data. Active user counts are estimates.*

---

## 7. Competitive Landscape

### 7.1 Direct Competition

There are **no direct competitors** — TokenUsage is the first purpose-built analytics tool for Claude Code session data.

### 7.2 Adjacent / Indirect

| Tool | Relationship | Key Difference |
|---|---|---|
| Anthropic Console | Official API usage dashboard | For direct API users, not Claude Code CLI |
| LLM cost calculators (various) | One-off cost estimation | No session integration, manual input |
| Code time trackers (WakaTime, etc.) | Developer productivity | Track coding time, not AI cost/usage |
| Terminal analytics (self-hosted) | Generic terminal logging | No Claude Code-specific parsing or optimization |

### 7.3 Competitive Moat

- **First-mover advantage** in the Claude Code analytics space
- **Privacy-by-design** — all-local architecture appeals to security-conscious developers
- **Deep Claude Code integration** — understands JSONL format, classifies sessions, detects waste patterns specific to Claude Code workflows
- **Open-source** — free, auditable, community-extensible

---

## 8. Go-to-Market Strategy

### 8.1 Phase 1: Organic Discovery (Current)

- GitHub repository with comprehensive README and documentation
- Claude Code community channels (Discord, forums)
- Word of mouth among Claude Code power users

### 8.2 Phase 2: Community Building (v0.2 – v0.3)

- Launch Discord, Telegram, and WeChat communities
- Enable GitHub Discussions for Q&A
- Publish blog posts / tutorials on optimizing Claude Code costs
- Reach out to Claude Code content creators for reviews

### 8.3 Phase 3: Distribution (v0.4+)

- Homebrew cask for macOS one-command install
- winget and Chocolatey for Windows
- Flatpak for Linux
- Featured in "awesome-claude-code" lists and similar curated resources

### 8.4 Monetization

**TokenUsage is and will remain free and open-source.** Future sustainability options under consideration:

- **Donations:** GitHub Sponsors, Buy Me a Coffee
- **Optional cloud sync:** Paid opt-in service for cross-machine data sync (local-first remains free)
- **Enterprise features:** Team dashboard, SSO, admin controls (if demand arises)

*No monetization is planned for the core product. These are long-term sustainability options only.*

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Claude Code changes JSONL format | Medium | High | Versioned parser; community-maintained schema mapping; monitor upstream changes |
| Anthropic changes pricing model | Low | Medium | `models.json` is user-editable; versioned pricing snapshots |
| macOS notarization breaks | Medium | Medium | CI-tested notarization; fallback unsigned builds with clear install instructions |
| Low community engagement | Medium | Medium | Active community building; clear contribution paths; responsive maintainers |
| Performance with large datasets | Medium | Low | SQLite indexing; incremental parsing; pagination; query optimization |
| Electron security vulnerabilities | Low | High | Automated dependency updates; security advisories monitoring; timely upgrades |

---

## 10. Appendix

### 10.1 Glossary

| Term | Definition |
|---|---|
| **JSONL** | JSON Lines — one JSON object per line, used by Claude Code for session logs |
| **Session** | One continuous Claude Code interaction, identified by a UUID |
| **Turn** | One message exchange within a session (user prompt → assistant response) |
| **Cache Hit** | When Claude reuses previously cached context, reducing cost |
| **Health Score** | A–F grade representing how efficiently a project uses tokens |
| **Waste Detector** | A rule that identifies suboptimal token usage patterns |

### 10.2 References

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Anthropic Pricing](https://www.anthropic.com/pricing)
- [Electron Documentation](https://www.electronjs.org/docs)
- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)

### 10.3 Document Changelog

| Date | Version | Changes |
|---|---|---|
| 2025-05-05 | 1.0 | Initial PRD |

---

<p align="center">
  <sub>TokenUsage · MIT License · <a href="https://github.com/happy-token/TokenUsage">github.com/happy-token/TokenUsage</a></sub>
</p>
