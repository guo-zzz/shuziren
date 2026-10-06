param(
  [string]$Model = "qwen2.5:7b",
  [switch]$Lan
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Test-Port([string]$HostName, [int]$Port) {
  try {
    return (Test-NetConnection -ComputerName $HostName -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet)
  } catch {
    return $false
  }
}

$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
  Write-Host "[ERROR] Ollama is not installed. Install it from https://ollama.com/download/windows" -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

if (-not (Test-Port "127.0.0.1" 11434)) {
  Write-Host "[INFO] Starting Ollama service..."
  Start-Process -FilePath $ollama.Source -ArgumentList "serve" -WindowStyle Minimized | Out-Null
  for ($i = 0; $i -lt 30 -and -not (Test-Port "127.0.0.1" 11434); $i++) {
    Start-Sleep -Seconds 1
  }
}

if (-not (Test-Port "127.0.0.1" 11434)) {
  Write-Host "[ERROR] Ollama did not start on port 11434." -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

$models = (& $ollama.Source list 2>$null | Out-String)
if ($models -notmatch [regex]::Escape($Model)) {
  Write-Host "[INFO] Pulling model $Model (first run may take several minutes)..."
  & $ollama.Source pull $Model
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to pull model $Model." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
  }
}

$env:DEMO_BACKEND_BASE_URL = "http://127.0.0.1:11434"
$env:DEMO_BACKEND_MODEL = $Model
$env:DEMO_BACKEND_API_KEY = ""
$env:DEMO_BACKEND_STREAM = "true"
$env:DEMO_MODE = "auto"
$env:DEMO_HOST = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }

Write-Host ""
Write-Host "[READY] Model: $Model"
Write-Host "[READY] Backend: $env:DEMO_BACKEND_BASE_URL"
if ($Lan) {
  Write-Host "[READY] Demo listens on all network interfaces: http://<主机IP>:8090"
  Write-Host "[NOTE] If other computers cannot connect, allow TCP port 8090 in Windows Firewall."
} else {
  Write-Host "[READY] Demo: http://127.0.0.1:8090"
}
Write-Host "[INFO] Press Ctrl+C to stop the Demo."
Write-Host ""

& node server.mjs
