# TokenUsage

<p align="center">
  <strong>📊 可视化分析与优化你的 Claude Code Token 消耗</strong>
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://github.com/happy-token/TokenUsage/releases"><img src="https://img.shields.io/github/v/release/happy-token/TokenUsage" alt="Release" /></a>
  <a href="./CONTRIBUTING.md"><img src="https://img.shields.io/badge/contributions-welcome-brightgreen.svg" alt="Contributions" /></a>
</p>

<p align="center">
  <a href="./README.md">English</a> · 中文
</p>

---

TokenUsage 是一款**免费开源的桌面应用**，读取 [Claude Code](https://claude.ai/code) 的本地会话日志，将其转化为可操作的成本分析、缓存优化洞察和活动分布图表——全部在原生 Electron 窗口中呈现，数据完全保留在本地。

## ✨ 功能特性

- **总览仪表盘** — 总花费、会话数、缓存命中率、活跃项目四项 KPI，按天、按项目的消耗柱状图
- **项目详情** — 会话时间线、活动类型分布（功能开发 / 调试 / 重构 / 测试 / Git / 构建部署 / 探索 / 规划 / 头脑风暴 / 对话）、模型使用情况、Git 分支追踪
- **优化健康评分** — 每个项目 A–F 等级评分，配备 9 种浪费检测器，一键复制修复建议
- **缓存 ROI** — 缓存节省金额、写入成本、净收益一览
- **工具 & Shell 统计** — 最常用工具排行和 Shell 命令分类
- **会话活动分类** — 自动将每个会话归类为 10 种活动类型
- **系统托盘** — 无需打开主窗口，实时查看今日花费和近 7 天统计
- **中英双语** — 界面支持 English / 中文切换
- **深色/浅色主题** — 偏好设置自动持久化

## 📸 截图

<p align="center">
  <em>截图即将上线。暂时可克隆仓库后运行 <code>pnpm run dev</code> 亲自体验。</em>
</p>

## 🚀 技术栈

| 层级 | 技术 |
|---|---|
| 壳层 | Electron 30 |
| 渲染层 | React 18 + TypeScript |
| 构建 | electron-vite + Vite 5 |
| 存储 | better-sqlite3（纯本地，无服务器） |
| 文件监听 | chokidar |
| 打包 | electron-builder |

## 📋 环境要求

- **Node.js** 20+
- **pnpm** 9+
- **macOS**（主要平台）、Windows 或 Linux

## ⚡ 快速开始

```bash
# 克隆仓库
git clone https://github.com/happy-token/TokenUsage.git
cd TokenUsage

# 安装依赖（同时编译原生 SQLite 插件）
pnpm install

# 开发模式启动
pnpm run dev
```

应用会自动扫描 `~/.claude/projects/**/*.jsonl`，无需任何配置即可看到数据。

## 📦 安装

前往 [Releases](https://github.com/happy-token/TokenUsage/releases) 页面下载最新版本：

| 平台 | 安装包 |
|---|---|
| **macOS** | `.dmg` |
| **Windows** | `.exe`（NSIS 安装包） |
| **Linux** | `.AppImage` |

## 📖 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm run dev` | 启动 Electron + Vite 开发服务器（支持热更新） |
| `pnpm run build` | 生产环境构建 |
| `pnpm run package` | 构建并打包发行版（`.dmg` / `.exe` / `.AppImage`） |
| `pnpm test` | 运行单元测试（Vitest） |
| `pnpm run test:watch` | 测试监听模式 |
| `pnpm run test:e2e` | Playwright 端到端测试 |
| `pnpm run typecheck` | TypeScript 类型检查 |

## 📁 项目结构

```
TokenUsage/
├── src/
│   ├── main/            # Electron 主进程
│   │   ├── index.ts     # 应用启动、窗口、系统托盘
│   │   ├── db.ts        # SQLite Schema 与迁移
│   │   ├── parser.ts    # JSONL → 会话/轮次模型 + 费用计算
│   │   ├── watcher.ts   # chokidar 文件监听
│   │   ├── classifier.ts  # 活动类型分类
│   │   ├── optimize.ts  # 健康评分与浪费发现
│   │   ├── ipc.ts       # IPC 处理器注册
│   │   └── store.ts     # 数据查询与托盘统计缓存
│   ├── preload/
│   │   └── index.ts     # Context Bridge（暴露 window.tokenUsage）
│   └── renderer/
│       └── src/
│           ├── App.tsx          # 根组件 + 路由
│           ├── pages/           # Overview, ProjectDetail, Settings, Sessions
│           ├── components/      # Sidebar, AppLogo
│           ├── contexts/        # ThemeContext, I18nContext
│           └── types.ts         # 渲染层共享类型
├── tests/                # 单元测试 + JSONL 测试固件
├── resources/            # 图标、models.json 定价表
├── scripts/              # 构建、公证、发布脚本
└── .github/workflows/    # CI + 发布流水线
```

## 💰 模型定价

费用根据 Token 数量在本地计算，使用以下标准（美元 / 百万 Token）：

| 模型 | 输入 | 输出 | 缓存读取 | 缓存写入 |
|---|---|---|---|---|
| claude-opus-4-7 / 4-6 | $15 | $75 | $1.5 | $18.75 |
| claude-sonnet-4-6 | $3 | $15 | $0.3 | $3.75 |
| claude-haiku-4-5 | $0.8 | $4 | $0.08 | $1.00 |

若 JSONL 中已包含 `costUSD` 字段，则直接使用该值。模型定价配置在 `resources/models.json` 中。

## 🔒 数据与隐私

**所有数据保留在本地。** 不会发送到任何服务器。SQLite 数据库存储在 Electron 的[应用数据目录](https://www.electronjs.org/docs/latest/api/app#appgetpathname)中。无遥测、无追踪、无分析——只有本地文件。

## 🙋 常见问题

<details>
<summary><strong>TokenUsage 如何获取我的 Claude Code 数据？</strong></summary>
<br />
Claude Code 在 <code>~/.claude/projects/</code> 目录下写入 JSONL 会话日志。TokenUsage 监听此目录，解析新条目并存储在本地 SQLite 数据库中。数据绝不会离开你的机器。
</details>

<details>
<summary><strong>需要联网吗？</strong></summary>
<br />
不需要。TokenUsage 完全离线运行。只有 <code>resources/models.json</code> 中的模型定价是静态打包的——如果定价变动，你可以手动更新。
</details>

<details>
<summary><strong>费用追踪有多准确？</strong></summary>
<br />
TokenUsage 使用双重策略：(1) 若 Claude Code 在 JSONL 中包含了 <code>costUSD</code> 字段，则直接使用该值；(2) 否则，根据 Token 数量使用 Anthropic 官方定价在本地计算。缓存写入成本和读取节省也会一并计入。
</details>

<details>
<summary><strong>健康评分是如何计算的？</strong></summary>
<br />
优化引擎运行 9 种浪费检测器（例如：读取 <code>node_modules/</code>、重复文件读取、过大的 CLAUDE.md）。每个发现根据严重程度影响评分。等级：A (90+)、B (75+)、C (55+)、D (30+)、F (<30)。结果缓存 1 小时。
</details>

<details>
<summary><strong>我能否为新的模型贡献定价？</strong></summary>
<br />
可以！请参见 <a href="./CONTRIBUTING.md#adding-a-new-model">CONTRIBUTING.md</a>。在 <code>resources/models.json</code> 中添加带有规范模型 ID 和单 Token 定价的新条目，然后提交 PR。
</details>

<details>
<summary><strong>可以从应用中删除会话或项目吗？</strong></summary>
<br />
可以。你可以在项目详情中删除单个会话，也可以删除整个项目（及所有会话）。注意：这只会从 TokenUsage 数据库中删除数据——原始 <code>.jsonl</code> 文件不会受影响。
</details>

<details>
<summary><strong>支持哪些平台？</strong></summary>
<br />
macOS（Intel + Apple Silicon）、Windows（x64）、Linux（x64 AppImage）。macOS 是主要开发平台。
</details>

<details>
<summary><strong>TokenUsage 能否直接配合 Claude API 使用？</strong></summary>
<br />
不能——TokenUsage 专为 Claude Code 的会话日志设计。如需直接使用 API 的费用分析，console.anthropic.com 上的 API 控制台已提供相关功能。
</details>

## 🗺 路线图

详见 [ROADMAP.md](./ROADMAP.md)，包含计划功能与长期目标。

## 👥 社区与支持

期待你的加入！以下是沟通渠道：

| 渠道 | 链接 | 适用场景 |
|---|---|---|
| **GitHub Issues** | [Issues](https://github.com/happy-token/TokenUsage/issues) | Bug 报告、功能请求 |
| **GitHub Discussions** | [Discussions](https://github.com/happy-token/TokenUsage/discussions) | 问答、想法交流、社区讨论 |
| **Discord** | _即将上线_ | 实时聊天、开发者协作 |
| **Telegram** | _即将上线_ | 社区更新、快速问答 |
| **微信交流群** | _即将上线_ | 中文用户社区 |

> **社区平台建议：** Discord 是国际开发者社区的主流平台（VS Code、Electron、React 等社区均在使用）。Telegram 在亚洲、东欧和开发者圈子中非常流行。微信群对中文开发者生态至关重要。建议选择你最习惯的平台加入——我们会在所有渠道同步重要公告。

## 🤝 贡献

欢迎贡献！详见 [CONTRIBUTING.md](./CONTRIBUTING.md)：

- 开发环境搭建
- 如何添加新模型
- Pull Request 指南
- 代码审查标准

本项目遵循 [Contributor Covenant 行为准则](./CODE_OF_CONDUCT.md)。

## 📄 许可证

MIT © [happy-token](https://github.com/happy-token)

---

<p align="center">
  <sub>为 Claude Code 社区倾心打造。如果 TokenUsage 对你有帮助，欢迎在 <a href="https://github.com/happy-token/TokenUsage">GitHub 上给个 ⭐ Star</a>！</sub>
</p>
