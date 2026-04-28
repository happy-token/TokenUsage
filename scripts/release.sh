#!/usr/bin/env bash
# TokenUsage release 脚本
# 交互式选择版本号 → 更新 package.json → commit → tag → push → 触发 GitHub Actions
set -e

# ── 颜色 ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}▸ $*${RESET}"; }
success() { echo -e "${GREEN}✔ $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠ $*${RESET}"; }
die()     { echo -e "${RED}✘ $*${RESET}"; exit 1; }

# ── 前置检查 ─────────────────────────────────────────────────
command -v git  >/dev/null || die "未找到 git"
command -v node >/dev/null || die "未找到 node"

cd "$(dirname "$0")/.."

# 确保在 git 仓库内
git rev-parse --git-dir >/dev/null 2>&1 || die "当前目录不是 git 仓库"

# 确保工作区干净
if ! git diff --quiet || ! git diff --cached --quiet; then
  warn "工作区有未提交的改动："
  git status --short
  echo ""
  read -p "  继续发布？(y/N) " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || die "已取消"
fi

# ── 读取当前版本 ──────────────────────────────────────────────
CURRENT=$(node -e "process.stdout.write(require('./package.json').version)")
echo ""
echo -e "${BOLD}当前版本：${CYAN}v${CURRENT}${RESET}"

# ── 计算候选版本 ──────────────────────────────────────────────
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
NEXT_PATCH="${MAJOR}.${MINOR}.$((PATCH + 1))"
NEXT_MINOR="${MAJOR}.$((MINOR + 1)).0"
NEXT_MAJOR="$((MAJOR + 1)).0.0"

echo ""
echo "  选择新版本："
echo "  1) patch  →  v${NEXT_PATCH}"
echo "  2) minor  →  v${NEXT_MINOR}"
echo "  3) major  →  v${NEXT_MAJOR}"
echo "  4) 手动输入"
echo ""
read -p "  选择 [1]: " choice
choice="${choice:-1}"

case "$choice" in
  1) NEW_VERSION="$NEXT_PATCH" ;;
  2) NEW_VERSION="$NEXT_MINOR" ;;
  3) NEW_VERSION="$NEXT_MAJOR" ;;
  4)
    read -p "  输入版本号（不含 v）: " NEW_VERSION
    [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "版本号格式无效，应为 x.y.z"
    ;;
  *) die "无效选项" ;;
esac

TAG="v${NEW_VERSION}"

echo ""
echo -e "  ${BOLD}即将发布：${GREEN}${TAG}${RESET}"
read -p "  确认？(y/N) " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || die "已取消"

# ── 更新 package.json ─────────────────────────────────────────
info "更新 package.json → ${NEW_VERSION}"
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  pkg.version = '${NEW_VERSION}';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
success "package.json 已更新"

# ── Git commit + tag + push ───────────────────────────────────
info "提交版本号"
git add package.json
git commit -m "chore: bump version to ${NEW_VERSION}"

info "创建 tag ${TAG}"
git tag "$TAG"

info "推送当前分支 + ${TAG}"
BRANCH=$(git branch --show-current)
git push origin "$BRANCH"
git push origin "$TAG"

# ── 获取仓库 owner/repo ──────────────────────────────────────
REMOTE_URL=$(git remote get-url origin)
REPO=$(echo "$REMOTE_URL" | sed 's/.*github.com[:/]\(.*\)\.git/\1/')

echo ""
success "发布完成！GitHub Actions 开始构建 →"
echo -e "  ${CYAN}https://github.com/${REPO}/actions${RESET}"
echo ""
