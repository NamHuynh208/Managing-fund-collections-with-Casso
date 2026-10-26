# Tao zip ban giao sach se (loai node_modules, dist, cache, .env bi mat).
# Cach dung (PowerShell, chay tu thu muc quy-clb hoac chi duong):
#   powershell -ExecutionPolicy Bypass -File scripts\package.ps1
# Them .env that (chi khi nap vao VPS rieng, khong chia se):
#   powershell -ExecutionPolicy Bypass -File scripts\package.ps1 -IncludeSecrets

param(
    [switch]$IncludeSecrets = $false,
    [string]$OutDir = "."
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path "docker-compose.prod.yml")) {
    Write-Error "Hay chay script nay tu thu muc goc quy-clb (chua docker-compose.prod.yml)."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$zip = Join-Path $OutDir "quy-clb-$stamp.zip"
$stage = Join-Path $env:TEMP "quy-clb-$stamp"

if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Path $stage | Out-Null

# Robocopy: /E thu muc con, /XD loai thu muc, /XF loai file
$excDirs = @("node_modules", "node_modules_sai", "dist", ".git", "__pycache__",
             ".vite", "staticfiles", "venv", ".venv")
$excFiles = @("*.log", "*.pyc", "*.bak", "*.sai", "db.sqlite3", "*.dump", "*.sql.gz")
if (-not $IncludeSecrets) {
    # khong ke kem bien bi mat; chi giu mau .example
    $excFiles += @(".env", ".env.prod")
}

robocopy . $stage /E /XD @excDirs /XF @excFiles /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Error "Robocopy loi (code $LASTEXITCODE)" }

Compress-Archive -Path "$stage\*" -DestinationPath $zip -Force
Remove-Item -Recurse -Force $stage

$size = "{0:N1} MB" -f ((Get-Item $zip).Length / 1MB)
Write-Host "Da tao: $zip ($size)"
if (-not $IncludeSecrets) {
    Write-Host "Luu y: zip KHONG chua .env / .env.prod. Tren VPS hay: cp .env.prod.example .env.prod roi dien gia tri that."
}
