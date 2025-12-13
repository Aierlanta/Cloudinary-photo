#!/usr/bin/env bash
set -euo pipefail

# 为当前仓库配置 git merge driver：在把 main 合并到 vercel 时，自动保留 vercel 分支的特化文件版本。
#
# 用法：
#   ./scripts/setup-git-merge-drivers.sh          # 仅对当前仓库生效（推荐）
#   ./scripts/setup-git-merge-drivers.sh --global # 对当前用户所有仓库生效（可选）

scope="${1:---local}"

if [[ "$scope" != "--local" && "$scope" != "--global" ]]; then
  echo "用法: $0 [--local|--global]" >&2
  exit 2
fi

git config "$scope" merge.keepvercel.name "Keep ours (vercel) version for Vercel-specific files"
git config "$scope" merge.keepvercel.driver true

echo "已配置 merge driver 'keepvercel'（范围：$scope）。"


