# setup-prime-global.ps1 — Run this ONCE as Administrator to make Prime global
# Right-click -> Run as Administrator, or: Start-Process powershell -Verb RunAs -ArgumentList "-File `"$PSCommandPath`""
param()

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$UserProfile = $env:USERPROFILE

Write-Host "=== Prime Global Setup ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
Write-Host "User: $UserProfile"

# 1. Fix permissions on ~/.config and ~/.claude so your normal user can write without admin next time
Write-Host "`n[1] Fixing permissions..." -ForegroundColor Yellow
foreach ($dir in @("$UserProfile\.config", "$UserProfile\.config\opencode", "$UserProfile\.claude")) {
  if (Test-Path $dir) {
    Write-Host "  granting $env:USERNAME full control on $dir"
    icacls $dir /grant "${env:USERNAME}:(OI)(CI)F" /T | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Warning "  icacls failed for $dir (may need manual fix)" }
  }
}

# 2. Create global agent dirs
Write-Host "`n[2] Creating global agent directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "$UserProfile\.config\opencode\agent" | Out-Null
New-Item -ItemType Directory -Force -Path "$UserProfile\.config\opencode\agents" | Out-Null
Write-Host "  done"

# 3. Copy prime agent
Write-Host "`n[3] Installing prime agent..." -ForegroundColor Yellow
$srcPrime = Join-Path $ProjectRoot ".opencode\agent\prime.md"
$dstPrime = "$UserProfile\.config\opencode\agent\prime.md"
if (Test-Path $srcPrime) {
  Copy-Item -Force $srcPrime $dstPrime
  Write-Host "  copied to $dstPrime"
  # also copy to `agents` alias for compatibility
  Copy-Item -Force $srcPrime "$UserProfile\.config\opencode\agents\prime.md"
} else {
  Write-Error "Source prime not found: $srcPrime"
}

# 4. Update global opencode.jsonc
Write-Host "`n[4] Updating global opencode.jsonc..." -ForegroundColor Yellow
$globalConfig = "$UserProfile\.config\opencode\opencode.jsonc"
$templateConfig = Join-Path $ProjectRoot "opencode.global.jsonc"
if (Test-Path $templateConfig) {
  if (Test-Path $globalConfig) { Copy-Item -Force $globalConfig "$globalConfig.bak.$(Get-Date -Format yyyyMMdd-HHmmss)" }
  Copy-Item -Force $templateConfig $globalConfig
  Write-Host "  installed $globalConfig (backup created if existed)"
  Write-Host "  content preview:"
  Get-Content $globalConfig | Select-Object -First 20 | ForEach-Object { Write-Host "    $_" }
} else {
  Write-Warning "Template not found: $templateConfig"
}

# 5. Install CLAUDE.md globally (Claude Code loads ~/.claude/CLAUDE.md)
Write-Host "`n[5] Installing CLAUDE.md globally..." -ForegroundColor Yellow
$srcClaude = Join-Path $ProjectRoot "CLAUDE.md"
if (Test-Path $srcClaude) {
  Copy-Item -Force $srcClaude "$UserProfile\.claude\CLAUDE.md"
  Write-Host "  copied to $UserProfile\.claude\CLAUDE.md"
  Copy-Item -Force $srcClaude "$UserProfile\CLAUDE.md"
  Write-Host "  copied to $UserProfile\CLAUDE.md (alt location)"
}

# 6. Install AGENTS.md as global template (optional, not auto-loaded globally but useful as reference)
Write-Host "`n[6] Installing AGENTS.md global reference..." -ForegroundColor Yellow
$srcAgents = Join-Path $ProjectRoot "AGENTS.md"
if (Test-Path $srcAgents) {
  Copy-Item -Force $srcAgents "$UserProfile\.config\opencode\AGENTS.md"
  Write-Host "  copied to $UserProfile\.config\opencode\AGENTS.md"
}

Write-Host "`n=== Done ===" -ForegroundColor Green
Write-Host "Next steps:"
Write-Host "  1. Quit and restart opencode (config is loaded at startup)"
Write-Host "  2. Restart Claude Code / `claude` CLI"
Write-Host "  3. Verify: in opencode TUI you should see agent 'prime' as default (bottom bar)"
Write-Host "  4. For any NEW project, copy AGENTS.md + CLAUDE.md + .opencode/agent/prime.md from this project OR they will inherit global prime via opencode.jsonc"
Write-Host ""
Write-Host "To test prime is active, ask in either tool: 'which agent are you and what are your rules?'"
