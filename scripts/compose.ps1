# Wrapper chay Docker Compose theo giai doan (PowerShell).
#   powershell -ExecutionPolicy Bypass -File scripts\compose.ps1 1 up -d --build
#   powershell -ExecutionPolicy Bypass -File scripts\compose.ps1 3 ps -a
#   powershell -ExecutionPolicy Bypass -File scripts\compose.ps1 tls up -d --build
param(
  [Parameter(Position = 0)][string]$Stage = "3",
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$files = @("-f", (Join-Path $root "compose.yaml"))
switch ($Stage) {
  "1" { }
  "2" { $files += @("-f", (Join-Path $root "compose.monitoring.yaml")) }
  "3" { $files += @("-f", (Join-Path $root "compose.monitoring.yaml"), "-f", (Join-Path $root "compose.logging.yaml")) }
  "tls" { $files += @("-f", (Join-Path $root "compose.monitoring.yaml"), "-f", (Join-Path $root "compose.logging.yaml"), "-f", (Join-Path $root "compose.tls.yaml")) }
  default { Write-Error "Giai doan khong hop le: $Stage (1|2|3|tls)"; exit 1 }
}
& docker compose --project-directory $root @files @Rest
exit $LASTEXITCODE
