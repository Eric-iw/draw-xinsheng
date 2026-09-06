# 头像一键同步脚本
# 用法：照片只放到 backend\uploads\stuimg（命名 姓名-学号.扩展名），
# 然后在 draw-register 目录执行：  ./sync-avatars.ps1
# 脚本会把照片同步到 public\uploads\stuimg 并重建 avatars.json，
# 之后执行 npx vercel --prod 部署即可。
$ErrorActionPreference = 'Stop'

$src = Join-Path $PSScriptRoot '..\backend\uploads\stuimg'
$dst = Join-Path $PSScriptRoot 'public\uploads\stuimg'
$manifest = Join-Path $PSScriptRoot 'avatars.json'

if (-not (Test-Path $src)) {
  Write-Error "源目录不存在：$src（请确认 backend\uploads\stuimg）"
  exit 1
}

New-Item -ItemType Directory -Force $dst | Out-Null
# 清空目标后整体复制，保证删除的照片也能同步移除
Remove-Item (Join-Path $dst '*') -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $src '*') $dst -Force

$names = @(Get-ChildItem $dst -File | ForEach-Object { $_.Name })
$json = $names | ConvertTo-Json
[System.IO.File]::WriteAllText($manifest, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "已同步 $($names.Count) 张头像到 public\uploads\stuimg，并重建 avatars.json"
