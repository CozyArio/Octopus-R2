Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string]$message) {
  Write-Host "==> $message" -ForegroundColor Cyan
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$pkg = Get-Content -Raw "package.json" | ConvertFrom-Json
$version = [string]$pkg.version
if ([string]::IsNullOrWhiteSpace($version)) {
  throw "package.json version is empty."
}

$tag = "v$version"
Write-Step "Preparing local release for $tag"

# Ensure commit state is clean enough for tagging/publishing.
$status = git status --short
if ($status) {
  throw "Working tree is not clean. Commit or stash changes first."
}

# Ensure GH_TOKEN exists; fallback to gh auth token if available.
if (-not $env:GH_TOKEN) {
  try {
    $token = gh auth token
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($token)) {
      $env:GH_TOKEN = $token.Trim()
      Write-Step "Using token from gh auth token"
    }
  } catch {
    # no-op
  }
}

if (-not $env:GH_TOKEN) {
  throw "GH_TOKEN is not set and gh auth token was unavailable. Run: gh auth login"
}

Write-Step "Pushing main branch"
git push origin main

Write-Step "Ensuring tag $tag exists"
$tagExists = $false
try {
  git rev-parse "$tag" | Out-Null
  $tagExists = $true
} catch {
  $tagExists = $false
}

if (-not $tagExists) {
  git tag $tag
}

Write-Step "Pushing tag $tag"
git push origin $tag

Write-Step "Building and publishing release artifacts"
npm run dist:publish

Write-Step "Release flow completed for $tag"
