# Claude Code 监控项目对比分析

本文档对比分析 `cc-monitor` 目录下的 6 个 Claude Code 监控相关项目,帮助选择合适的技术方案。

---

## 项目概览

| 项目名称 | 类型 | 语言/技术栈 | 核心功能 | 成熟度 |
|---------|------|-----------|---------|--------|
| **ccusage** | CLI 工具 | Node.js/TypeScript | 全面的用量分析,支持多提供商 | ⭐⭐⭐⭐⭐ |
| **codeburn** | CLI + TUI | Node.js/TypeScript | 可视化仪表盘,13种任务分类 | ⭐⭐⭐⭐⭐ |
| **codeburn-rs** | CLI + TUI | Rust | codeburn的Rust重写,性能提升600倍 | ⭐⭐⭐⭐ |
| **claude-statistics** | macOS菜单栏应用 | Swift/SwiftUI | 原生macOS应用,实时统计 | ⭐⭐⭐⭐⭐ |
| **ccusage-monitor** | macOS菜单栏应用 | Swift | 极简菜单栏显示,195行代码 | ⭐⭐⭐ |
| **claude-code-monitoring-guide** | 文档指南 | Markdown | ROI测量指南,遥测配置 | ⭐⭐⭐ |

---

## 详细分析

### 1. ccusage

**定位**: 功能最全面的Claude Code用量分析CLI工具

#### 优势

1. **生态最完善**
   - npm下载量高,社区活跃
   - 完整的monorepo架构,模块化设计
   - 提供MCP服务器集成,可与Claude Desktop联动
   - 有配套衍生产品: `@ccusage/codex`, `@ccusage/opencode`, `@ccusage/pi`, `@ccusage/amp`

2. **功能全面**
   - 多种报告模式: daily, monthly, session, blocks, statusline
   - 支持JSON输出,便于程序化消费
   - 支持多实例/多项目管理
   - 内置LiteLLM定价集成,成本计算准确
   - 支持时区和locale自定义
   - 提供compact模式,适配窄终端

3. **技术架构优秀**
   - TypeScript严格模式,代码质量高
   - 完善的测试体系(vitest in-source testing)
   - 支持环境变量定制(`CLAUDE_CONFIG_DIR`)
   - 数据聚合逻辑清晰,去重机制完善

4. **开发者体验好**
   - 详细的CLAUDE.md开发规范
   - 自动化程度高(eslint, typecheck, test并行)
   - 支持Nix flakes开发环境
   - Bundle size极小,注重性能

#### 劣势

1. **资源消耗较高** - Node.js运行时,相比Rust方案内存占用大
2. **冷启动慢** - 首次运行需要加载Node.js环境
3. **学习曲线** - 命令行参数较多,新用户需要时间熟悉
4. **单文件过大** - `data-loader.ts` 达4940行,是明显的重构债务,官方CLAUDE.md中已标记
5. **模型名称匹配问题** - 成本计算依赖LiteLLM模型名称精确匹配,不匹配时静默返回$0

#### 适用场景

- 需要深度分析Claude使用情况的开发者
- 团队需要统一用量统计工具
- 需要与其他工具集成(MCP, CI/CD)
- 对定制化要求高的场景

---

### 2. codeburn

**定位**: 以可视化TUI为特色的用量分析工具,强调"看到你的token花在哪里"

#### 优势

1. **可视化体验最佳**
   - 渐变图表,响应式面板
   - 交互式TUI,支持键盘导航
   - 13种任务分类(编码、调试、重构、测试等)
   - 一次性成功率追踪(编辑/测试/修复循环)

2. **功能创新**
   - `optimize`命令自动检测浪费模式并提供修复建议
   - 支持多provider切换(Claude, Codex, Cursor, OpenCode, Pi, Copilot)
   - 货币转换支持(162种货币,24小时缓存)
   - 原生macOS菜单栏应用(codeburn menubar)

3. **性能表现好**
   - 缓存机制完善
   - 解析速度快

4. **数据洞察深入**
   - 按活动类型分类(编码、调试、探索、规划等)
   - 核心工具/MCP服务器/shell命令细分
   - 低一次性成功率预警
   - 缓存命中率分析

5. **文档质量高**
   - README详细,包含安装、使用、原理解释
   - CLAUDE.md规范严格(禁止emoji,禁止AI套话)
   - Git工作流严谨(branch命名,commit格式)

#### 劣势

1. **依赖Node.js** - 虽然性能好,但不如Rust轻量
2. **Cursor限制** - Cursor新版隐藏了per-call token计数,导致成本显示为$0
3. **GitHub Copilot限制** - 仅记录output tokens,成本低估

#### 适用场景

- 希望直观了解token消耗的开发者
- 多AI工具用户(Claude + Codex + Cursor等)
- 关注浪费优化和成本控制的团队
- 喜欢图形化界面胜过纯文本的用户

---

### 3. codeburn-rs (cburn)

**定位**: codeburn的Rust重写版本,极致性能导向

#### 优势

1. **性能卓越**
   - 缓存输出: 6ms vs 3.66s (提升610倍)
   - 无缓存冷启动: 76ms vs 7.71s (提升101倍)
   - 内存占用极低

2. **简洁高效**
   - 单一二进制文件,无需运行时
   - Homebrew一键安装
   - 命令简洁(`cburn today`, `cburn month`)

3. **继承codeburn优点**
   - 相同的TUI体验
   - 多provider支持
   - CSV/JSON导出
   - 货币切换

4. **避免npm生态问题**
   - 二进制名`cburn`避免与npm `codeburn`冲突
   - 无需Node.js环境

#### 劣势

1. **GPL-3.0 许可证** - 与其他项目的MIT许可不同,商业集成或衍生作品受限制,这是最关键的风险
2. **生态相对年轻** - v0.1.0,无changelog,社区不如Node.js成熟
3. **功能略少** - 缺少`optimize`命令等高级特性,无macOS菜单栏伴随应用
4. **Cursor支持禁用** - Cursor于2026年初停止写入per-call token数量,解析器保留但功能无效

#### 适用场景

- 追求极致性能的开发者
   - 希望零依赖、快速启动
   - CI/CD集成需要快速执行
   - 系统资源受限环境

---

### 4. claude-statistics

**定位**: 原生macOS菜单栏应用,功能最丰富的GUI方案

#### 优势

1. **原生macOS体验**
   - Swift/SwiftUI开发,Native性能
   - NSStatusItem + floating panel设计
   - 无dock图标,纯菜单栏应用
   - 支持FSEvents实时监听

2. **功能全面**
   - Session管理(搜索、分组、批量删除)
   - 会话详情(token统计、工具排名、趋势图)
   - 统计分析(日/周/月/年视图)
   - GitHub风格活动热力图(53周)
   - Top Projects排名
   - 转录本搜索

3. **多provider支持**
   - Claude Code (~/.claude/projects/)
   - Codex CLI (~/.codex/projects/)
   - Gemini CLI (~/.gemini/tmp/)
   - 各provider独立解析和缓存

4. **订阅监控**
   - 5小时/7天窗口利用率
   - 重置倒计时
   - Extra Usage追踪
   - 趋势图表

5. **用户体验精良**
   - v2.6.0全新All-Time视图
   - Crash恢复遥测
   - 双语支持(中英文README)
   - DMG安装包分发

#### 劣势

1. **仅限macOS** - 不支持Linux/Windows,macOS 14.0+门槛较高
2. **未公证** - 需要手动解除Gatekeeper限制(`xattr -cr`),企业环境部署摩擦大
3. **发布流程异常** - 涉及两个GitHub账号(`sj719045032`和`tinystone007`),工作流存在单点故障隐患
4. **资源占用** - Native应用持续运行占用内存
5. **开发门槛** - 需要Xcode 16.0+,Swift知识,XcodeGen工具

#### 适用场景

- macOS重度用户
- 偏好GUI胜过CLI
- 需要实时监控和多session管理
- 团队协作需要直观的数据展示

---

### 5. ccusage-monitor

**定位**: 极简macOS菜单栏监控,基于ccusage CLI的轻量封装

#### 优势

1. **极致简洁**
   - 271行Swift代码(分两个源文件: `main.swift` + `UsageDataModel.swift`)
   - 功能单一:显示百分比和时间
   - 易于理解和维护

2. **依赖简单**
   - 仅需ccusage CLI
   - Homebrew或脚本安装

3. **自动启动**
   - Launch Agent配置
   - 登录自启

4. **可定制显示**
   - 右键菜单切换指标
   - 百分比/时间/token/费用开关

#### 劣势

1. **功能有限** - 仅显示当前block的使用情况
2. **无历史分析** - 无法查看过往session
3. **强依赖ccusage** - ccusage JSON格式任何变更将导致静默失效(显示"No data")
4. **性能开销不低** - 每30秒spawn完整`npx ccusage`进程,CPU/内存代价高于原生读取方案
5. **冷启动延迟** - 未配置`CCUSAGE_PATH`环境变量时,每次ticker都触发npm解析

#### 适用场景

- 只需要实时监控的开发者
- 已在使用ccusage,需要菜单栏补充
- 偏好极简主义
- 不需要深度分析

---

### 6. claude-code-monitoring-guide

**定位**: ROI测量和实施指南文档集合

#### 优势

1. **方法论完整**
   - 从遥测设置到成本分析
   - 生产力指标框架
   - ROI计算公式

2. **实战经验总结**
   - 真实实施案例
   - Prometheus + OpenTelemetry配置
   - Linear集成自动化报告

3. **面向企业**
   - 团队级别度量
   - 采用率追踪
   - 开发者维度分析

4. **开源协作**
   - 欢迎贡献改进
   - LinkedIn作者背书

#### 劣势

1. **非工具** - 仅是文档,无可执行代码
2. **需要自行实施** - 读者需自行搭建基础设施
3. **聚焦企业场景** - 个人开发者可能觉得过于复杂

#### 适用场景

- 企业评估Claude Code投资回报
- 需要建立度量体系
- 向管理层汇报ROI
- 制定AI辅助开发策略

---

## 横向对比

### 功能对比

| 功能 | ccusage | codeburn | codeburn-rs | claude-stats | ccusage-mon | monitoring-guide |
|-----|---------|----------|-------------|--------------|-------------|------------------|
| 用量统计 | ✅ | ✅ | ✅ | ✅ | ✅ | 📖 指导 |
| 成本分析 | ✅ | ✅ | ✅ | ✅ | ⚠️ 基础 | 📖 指导 |
| TUI仪表盘 | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| GUI界面 | ❌ | ⚠️ menubar | ❌ | ✅ 完整 | ✅ 简单 | ❌ |
| 历史分析 | ✅ | ✅ | ✅ | ✅ | ❌ | 📖 指导 |
| 多provider | ✅ | ✅ | ✅ | ✅ | ❌ | 📖 指导 |
| JSON导出 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| MCP集成 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 优化建议 | ❌ | ✅ | ❌ | ❌ | ❌ | 📖 指导 |
| 离线支持 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

### 性能对比

| 指标 | ccusage | codeburn | codeburn-rs | claude-stats | ccusage-mon |
|-----|---------|----------|-------------|--------------|-------------|
| 启动速度 | 中等(Node) | 中等(Node) | 极快(Rust) | 快(Native) | 快(Native) |
| 内存占用 | 高 | 高 | 极低 | 中等 | 低 |
| 解析速度 | 快 | 快 | 极快 | 快 | 依赖ccusage |
| 缓存效率 | ✅ | ✅ | ✅✅ | ✅ | ❌ |

### 易用性对比

| 维度 | ccusage | codeburn | codeburn-rs | claude-stats | ccusage-mon |
|-----|---------|----------|-------------|--------------|-------------|
| 安装难度 | 易(npm) | 易(npm) | 易(brew) | 中(DMG) | 易(brew) |
| 学习曲线 | 陡(参数多) | 平缓(TUI) | 平缓 | 平缓(GUI) | 平缓 |
| 文档质量 | 优秀 | 优秀 | 良好 | 优秀 | 良好 |
| 社区支持 | 强 | 强 | 成长中 | 强 | 弱 |

---

## 选型建议

### 场景1: 个人开发者,想快速了解使用情况

**推荐**: codeburn 或 codeburn-rs
- TUI直观,键盘导航友好
- 一次性成功率分析帮助发现浪费
- codeburn-rs性能更优

### 场景2: 团队需要统一的用量统计标准

**推荐**: ccusage
- CLI标准化,易于CI/CD集成
- MCP服务器支持
- JSON输出便于数据分析
- Monorepo架构可扩展

### 场景3: macOS用户,需要实时监控

**推荐**: claude-statistics
- 原生菜单栏体验最佳
- 实时session监听
- 统计分析功能全面
- 支持多provider

如果只需极简显示: ccusage-monitor

### 场景4: 企业需要评估ROI

**推荐**: claude-code-monitoring-guide + ccusage/codeburn
- 指南提供方法论
- 工具提供实际数据
- 结合Linear实现自动化报告

### 场景5: 追求极致性能

**推荐**: codeburn-rs
- Rust编译,毫秒级响应
- 无运行时依赖
- 适合嵌入式/资源受限环境

### 场景6: 需要深度分析和优化

**推荐**: codeburn
- `optimize`命令自动检测浪费
- 13种任务分类深入洞察
- 缓存命中率分析
- 低效模式识别

---

## 技术趋势观察

1. **Rust化** - codeburn-rs证明Rust在CLI工具中的优势,未来更多Node.js工具可能转向Rust
2. **GUI化** - claude-statistics和codeburn menubar显示用户对可视化界面的需求增长
3. **多provider** - 单一Claude支持已不够,Codex/Cursor/Gemini支持成趋势
4. **MCP集成** - ccusage的MCP服务器展示与其他AI工具集成的潜力
5. **优化导向** - codeburn的`optimize`命令代表从"监控"到"行动"的演进

---

## 风险提示

1. **数据格式变更风险** - Claude Code可能更改JSONL格式,所有解析工具需要跟进
2. **API定价变更** - LiteLLM定价数据库需及时更新
3. **平台依赖** - Cursor等新版本隐藏token数据,影响功能
4. **维护负担** - 多provider支持意味着更高的维护成本

---

## 总结

- **综合最佳**: **ccusage** - 生态最完善,功能最全面
- **可视化最佳**: **codeburn** - TUI精美,洞察深入
- **性能最佳**: **codeburn-rs** - Rust重写,600倍提升
- **macOS最佳**: **claude-statistics** - 原生应用,功能丰富
- **极简最佳**: **ccusage-monitor** - 195行代码,足够日常
- **企业最佳**: **monitoring-guide** - 完整的方法论指导

选择时请根据实际需求:CLI vs GUI、单用户vs团队、简单监控vs深度分析、性能敏感vs功能丰富等维度权衡。
