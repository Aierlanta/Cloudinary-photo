<#
.SYNOPSIS
  为当前仓库配置 git merge driver：在把 main 合并到 vercel 时，自动保留 vercel 分支的特化文件版本。

.USAGE
  # 仅对当前仓库生效（推荐）
  pwsh ./scripts/setup-git-merge-drivers.ps1

  # 对当前用户所有仓库生效（可选）
  pwsh ./scripts/setup-git-merge-drivers.ps1 -Global
#>

param(
  [switch]$Global
)

$ErrorActionPreference = "Stop"

# 切到仓库根目录（脚本位于 scripts/ 下）
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$scope = if ($Global.IsPresent) { "--global" } else { "--local" }

git config $scope merge.keepvercel.name "Keep ours (vercel) version for Vercel-specific files"
git config $scope merge.keepvercel.driver true

Write-Host "已配置 merge driver 'keepvercel'（范围：$scope）。"


