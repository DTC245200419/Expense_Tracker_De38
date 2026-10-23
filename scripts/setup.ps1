# Sinh file .env voi mat khau ngau nhien (Windows PowerShell).
# Chay:  powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# Script tu choi ghi de .env da ton tai de khong lam mat mat khau dang dung.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

if (Test-Path $envFile) {
  Write-Host "File .env da ton tai: $envFile" -ForegroundColor Yellow
  Write-Host "Xoa file nay neu muon sinh lai (luu y: database da khoi tao se giu mat khau cu)."
  exit 1
}

function New-Secret([int]$bytes) {
  $buf = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
  return (($buf | ForEach-Object { $_.ToString("x2") }) -join "")
}

$content = @"
# Sinh tu dong boi scripts/setup.ps1 - KHONG commit file nay
DB_NAME=expense
POSTGRES_PASSWORD=$(New-Secret 16)
APP_DB_PASSWORD=$(New-Secret 16)
EXPORTER_DB_PASSWORD=$(New-Secret 16)

SESSION_SECRET=$(New-Secret 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$(New-Secret 12)
ADMIN_DISPLAY_NAME=Quan tri vien
COOKIE_SECURE=false

PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=$(New-Secret 12)

GRAFANA_ADMIN_PASSWORD=$(New-Secret 12)

NGINX_HTTP_PORT=8080
NGINX_HTTPS_PORT=8443
PGADMIN_PORT=8081
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
"@

[System.IO.File]::WriteAllText($envFile, $content, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Da tao $envFile" -ForegroundColor Green
Write-Host "Tai khoan web: admin / xem ADMIN_PASSWORD trong .env"
Write-Host "pgAdmin: admin@example.com / PGADMIN_PASSWORD; Grafana: admin / GRAFANA_ADMIN_PASSWORD"
