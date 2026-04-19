# TokenUsage

一款可视化分析 [Claude Code](https://claude.ai/code) Token 消耗的桌面应用。自动读取本地 JSONL 会话日志，以原生 Electron 窗口呈现费用、缓存命中、活动分布等多维分析。

[English](./README.md) · 中文

---

## 功能特性

- **总览仪表盘** — 总花费、会话数、缓存命中率、活跃项目四项 KPI，按天、按项目的消耗柱状图
- **项目详情** — 会话时间线、活动类型分布（功能开发 / 调试 / 重构等）、模型使用情况、Git 分支信息
- **优化健康度** — 每个项目 A–F 评分，附可操作的浪费建议，一键复制修复命令
- **缓存 ROI** — 缓存节省金额、写入成本、净收益一目了然
- **工具 & Shell 统计** — 最常用的工具排名和 Shell 命令分类
- **系统托盘** — 不打开主窗口也能实时查看今日花费和近 7 天统计
- **中英切换** — 界面支持 English / 中文
- **主题** — 深色 / 浅色

## 技术栈

| 层级 | 技术 |
|---|---|
| 壳层 | Electron 30 |
| 渲染层 | React 18 + TypeScript |
| 构建 | electron-vite + Vite 5 |
| 存储 | better-sqlite3（纯本地，无服务器） |
| 文件监听 | chokidar |
| 打包 | electron-builder |

## 环境要求

- Node.js 20+
- macOS（主要平台）、Windows 或 Linux

## 快速开始

```bash
# 安装依赖（同时编译原生 SQLite 插件）
npm install

# 开发模式启动
npm run dev
```

应用会自动扫描 `~/.claude/projects/**/*.jsonl`，无需任何配置，数据立即可见。

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动 Electron + Vite 开发服务器（支持热更新） |
| `npm run build` | 生产环境构建 |
| `npm run package` | 构建并打包发行版（`.dmg` / `.exe` / `.AppImage`） |
| `npm test` | 运行单元测试（Vitest） |
| `npm run test:watch` | 测试监听模式 |
| `npm run test:e2e` | Playwright 端到端测试 |
| `npm run typecheck` | TypeScript 类型检查 |

## 项目结构

```
src/
├── main/               # Electron 主进程
│   ├── index.ts        # 应用启动、窗口、系统托盘
│   ├── db.ts           # SQLite Schema 与迁移
│   ├── parser.ts       # JSONL → 会话/轮次模型 + 费用计算
│   ├── watcher.ts      # chokidar 文件监听
│   ├── classifier.ts   # 活动类型分类
│   ├── optimize.ts     # 健康评分与浪费建议
│   ├── ipc.ts          # IPC 处理器注册
│   └── store.ts        # 托盘统计内存缓存
├── preload/
│   └── index.ts        # Context Bridge（暴露 window.claudeInsight）
└── renderer/
    └── src/
        ├── App.tsx               # 根组件 + 路由
        ├── pages/
        │   ├── Overview.tsx      # 全局仪表盘
        │   ├── ProjectDetail.tsx # 项目详情
        │   └── Settings.tsx      # 设置（含关于）
        ├── components/
        │   ├── Sidebar.tsx
        │   └── AppLogo.tsx
        ├── contexts/
        │   ├── ThemeContext.tsx
        │   └── I18nContext.tsx
        └── types.ts              # 渲染层共享类型
```

## 模型定价

费用根据 Token 数量在本地计算，使用以下标准（USD / 百万 Token）：

| 模型 | 输入 | 输出 | 缓存读取 | 缓存写入 |
|---|---|---|---|---|
| claude-opus-4-7 / 4-6 | $15 | $75 | $1.5 | $18.75 |
| claude-sonnet-4-6 | $3 | $15 | $0.3 | $3.75 |
| claude-haiku-4-5 | $0.8 | $4 | $0.08 | $1.00 |

若 JSONL 中已包含 `costUSD` 字段，则直接使用该值，不重复计算。

## 数据与隐私

所有数据保留在本机，不会发送到任何服务器。SQLite 数据库存储在 Electron 的[应用数据目录](https://www.electronjs.org/docs/latest/api/app#appgetpathname)中。

## 下载

前往 [Releases](https://github.com/Thinkre/TokenUsage/releases) 页面下载最新版本：

- **macOS** — `.dmg`
- **Windows** — `.exe`
- **Linux** — `.AppImage`

## License

MIT
