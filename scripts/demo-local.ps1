[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

$repoRoot = Split-Path -Parent $PSScriptRoot
$composeProject = "mangal-local-demo"
$databaseUrl = "postgresql://mangal:mangal_local_only@127.0.0.1:5432/mangal?schema=public"
$platformProcess = $null
$storefrontProcess = $null
$postgresStarted = $false
$logRoot = Join-Path $repoRoot ".data\demo-local"

function Write-Step([string]$message) {
  Write-Host "`n→ $message" -ForegroundColor Cyan
}

function Invoke-Checked([string]$label, [string]$file, [string[]]$arguments) {
  Write-Step $label
  $output = @(& $file @arguments 2>&1)
  if ($LASTEXITCODE -ne 0) {
    $details = ($output | Select-Object -Last 12) -join [Environment]::NewLine
    throw "$label не выполнен.$([Environment]::NewLine)$details"
  }
  Write-Host "✓ $label" -ForegroundColor Green
}

function New-LocalSecret {
  $bytes = [byte[]]::new(32)
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return [Convert]::ToBase64String($bytes)
}

function Test-LocalPort([int]$port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connection = $client.ConnectAsync("127.0.0.1", $port)
    return $connection.Wait(350) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Test-DockerEngineRunning {
  $stdoutPath = [System.IO.Path]::GetTempFileName()
  $stderrPath = [System.IO.Path]::GetTempFileName()
  try {
    $dockerPath = (Get-Command docker -ErrorAction Stop).Source
    $process = Start-Process -FilePath $dockerPath `
      -ArgumentList @("info", "--format", "{{.ServerVersion}}") `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath `
      -WindowStyle Hidden `
      -PassThru
    if (-not $process.WaitForExit(5000)) {
      try { $process.Kill() } catch { }
      return $false
    }
    return $process.ExitCode -eq 0
  } catch {
    return $false
  } finally {
    Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
  }
}

function Start-DemoProcess([string]$command, [string]$stdoutName, [string]$stderrName) {
  $stdoutPath = Join-Path $logRoot $stdoutName
  $stderrPath = Join-Path $logRoot $stderrName
  return Start-Process -FilePath "cmd.exe" `
    -ArgumentList @("/d", "/s", "/c", $command) `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -WindowStyle Hidden `
    -PassThru
}

function Get-ProcessFailure([System.Diagnostics.Process]$process, [string]$name, [string]$stderrName) {
  if (-not $process.HasExited) { return $null }
  $path = Join-Path $logRoot $stderrName
  $tail = if (Test-Path -LiteralPath $path) { (Get-Content -LiteralPath $path -Tail 12 -Encoding utf8) -join [Environment]::NewLine } else { "Лог отсутствует" }
  return "$name завершился раньше времени (код $($process.ExitCode)).$([Environment]::NewLine)$tail"
}

function Wait-ForHttp([string]$uri, [System.Diagnostics.Process]$process, [string]$name, [string]$stderrName, [int]$timeoutSeconds) {
  $deadline = [DateTime]::UtcNow.AddSeconds($timeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    $failure = Get-ProcessFailure $process $name $stderrName
    if ($failure) { throw $failure }
    try {
      $response = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -eq 200) { return $response }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  throw "$name не ответил за $timeoutSeconds секунд. Проверьте лог в $logRoot."
}

function Stop-ProcessTree($process) {
  if ($null -eq $process) { return }
  try {
    if (-not $process.HasExited) {
      & taskkill.exe /PID $process.Id /T /F 2>&1 | Out-Null
    }
  } catch { }
}

function Set-SafeDemoEnvironment {
  $piiKey = New-LocalSecret
  $env:DOTENV_CONFIG_PATH = Join-Path $repoRoot "tests\fixtures\empty.env"
  $env:DATABASE_URL = $databaseUrl
  $env:DIRECT_URL = $databaseUrl
  $env:DATABASE_POOL_MAX = "3"
  $env:DATABASE_CONNECT_TIMEOUT_MS = "5000"
  $env:DATABASE_STATEMENT_TIMEOUT_MS = "10000"
  $env:PII_KEY_RING_JSON = @{
    activeKeyId = "local-demo"
    keys = @{ "local-demo" = $piiKey }
  } | ConvertTo-Json -Compress
  $env:PHONE_LOOKUP_HMAC_KEY = New-LocalSecret
  $env:ADMIN_SESSION_HMAC_KEY = New-LocalSecret
  $env:MFA_ENCRYPTION_KEY = New-LocalSecret
  $env:CSRF_HMAC_KEY = New-LocalSecret
  $env:INTERNAL_JOBS_TOKEN = New-LocalSecret
  $env:STOREFRONT_REVALIDATE_SECRET = New-LocalSecret
  $env:DEMO_RESET_SECRET = New-LocalSecret
  $env:DEMO_MODE = "true"
  $env:PERSONAL_DATA_LEGAL_BASIS = "CONTRACT"
  $env:ALLOWED_STOREFRONT_ORIGINS = "http://localhost:3000"
  $env:ADMIN_BASE_URL = "http://localhost:3001"
  $env:NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
  $env:PLATFORM_API_URL = "http://localhost:3001"
  $env:NEXT_PUBLIC_PLATFORM_API_URL = "http://localhost:3001"
  $env:STORAGE_DRIVER = "local"
  $env:LOCAL_MEDIA_ROOT = Join-Path $repoRoot ".data\media"
  $env:MEDIA_PUBLIC_BASE_URL = "http://localhost:3001"
  $env:NEXT_PUBLIC_MEDIA_BASE_URL = "http://localhost:3001"
  $env:NEXT_PUBLIC_YANDEX_METRIKA_ID = ""
  $env:BLOB_READ_WRITE_TOKEN = ""
  $env:YOOKASSA_SHOP_ID = ""
  $env:YOOKASSA_SECRET_KEY = ""
  $env:TBANK_TERMINAL_KEY = ""
  $env:TBANK_PASSWORD = ""
  $env:ADMIN_BOOTSTRAP_EMAIL = ""
  $env:ADMIN_BOOTSTRAP_PASSWORD = ""
}

try {
  Set-Location -LiteralPath $repoRoot

  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker не найден. Установите и запустите Docker Desktop, затем повторите команду."
  }
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "npm не найден. Установите Node.js 24 LTS, затем повторите команду."
  }

  Write-Step "Проверка Docker Engine"
  if (-not (Test-DockerEngineRunning)) {
    throw "Запусти Docker Desktop, дождись состояния Running и снова выполни npm run demo:local"
  }
  Write-Host "✓ Docker Engine работает" -ForegroundColor Green
  Invoke-Checked "Проверка Docker Compose" "docker" @("compose", "version")

  if (Test-LocalPort 3000) { throw "Порт 3000 уже занят. Закройте другой storefront и повторите команду." }
  if (Test-LocalPort 3001) { throw "Порт 3001 уже занят. Закройте другой platform API и повторите команду." }

  Set-SafeDemoEnvironment
  New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $env:LOCAL_MEDIA_ROOT -Force | Out-Null

  Invoke-Checked "Запуск отдельной demo PostgreSQL" "docker" @("compose", "-p", $composeProject, "up", "-d", "--wait", "postgres")
  $postgresStarted = $true

  if (-not (Test-Path -LiteralPath (Join-Path $repoRoot "node_modules\.bin\prisma.cmd"))) {
    Invoke-Checked "Установка npm-зависимостей" "npm.cmd" @("ci", "--no-audit", "--no-fund")
  }

  Invoke-Checked "Генерация Prisma Client" "npm.cmd" @("run", "prisma:generate")
  Invoke-Checked "Применение миграций" "npm.cmd" @("run", "db:migrate:deploy")
  Invoke-Checked "Заполнение вымышленного demo-каталога" "npm.cmd" @("run", "db:seed")

  Write-Step "Запуск platform API"
  $platformProcess = Start-DemoProcess "npm run dev:platform" "platform.log" "platform-error.log"
  $catalogResponse = Wait-ForHttp "http://localhost:3001/api/public/catalog" $platformProcess "Platform API" "platform-error.log" 90
  $catalog = $catalogResponse.Content | ConvertFrom-Json
  $products = @($catalog.categories | ForEach-Object { @($_.products) })
  if ($products.Count -eq 0) { throw "Platform API ответил, но demo-каталог пуст." }
  $firstProductName = [string]$products[0].name
  Write-Host "✓ Platform API отвечает, товаров: $($products.Count)" -ForegroundColor Green

  Write-Step "Запуск storefront"
  $storefrontProcess = Start-DemoProcess "npm run dev:storefront" "storefront.log" "storefront-error.log"
  $storefrontResponse = Wait-ForHttp "http://localhost:3000" $storefrontProcess "Storefront" "storefront-error.log" 90
  if (-not $storefrontResponse.Content.Contains($firstProductName)) {
    throw "Storefront ответил HTTP 200, но товар «$firstProductName» не найден в HTML."
  }

  Write-Host "`n============================================================" -ForegroundColor Green
  Write-Host "  ДЕМО ГОТОВО: http://localhost:3000" -ForegroundColor Green
  Write-Host "  Для остановки нажмите Ctrl+C" -ForegroundColor DarkGray
  Write-Host "============================================================`n" -ForegroundColor Green

  try { Start-Process "http://localhost:3000" | Out-Null } catch { }

  while ($true) {
    $platformFailure = Get-ProcessFailure $platformProcess "Platform API" "platform-error.log"
    if ($platformFailure) { throw $platformFailure }
    $storefrontFailure = Get-ProcessFailure $storefrontProcess "Storefront" "storefront-error.log"
    if ($storefrontFailure) { throw $storefrontFailure }
    Start-Sleep -Seconds 1
  }
} catch [System.Management.Automation.PipelineStoppedException] {
  # Ctrl+C: cleanup is performed in finally.
} catch {
  Write-Host "`nДЕМО НЕ ЗАПУЩЕНО" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Yellow
  exit 1
} finally {
  Stop-ProcessTree $storefrontProcess
  Stop-ProcessTree $platformProcess
  if ($postgresStarted) {
    & docker compose -p $composeProject stop postgres 2>&1 | Out-Null
  }
  Write-Host "`nДемо остановлено." -ForegroundColor DarkGray
}
