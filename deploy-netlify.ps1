# deploy-netlify.ps1
# Helper PowerShell script to deploy the generated `dist` folder to Netlify using Netlify CLI.
# IMPORTANT: Do NOT store your NETLIFY_AUTH_TOKEN in this file. Export it as an environment variable before running.
# Usage:
# 1. In PowerShell (temporary for session):
#    $Env:NETLIFY_AUTH_TOKEN = "YOUR_TOKEN_HERE"
# 2. (Optional) set site id if you want to deploy to an existing site:
#    $siteId = "YOUR_NETLIFY_SITE_ID"
#    Or leave $siteId empty to select interactively: $siteId = ""
# 3. Run the script from repo root:
#    .\deploy-netlify.ps1

param(
    [string]$Dir = "dist",
    [string]$Message = "preview 1.0.3",
    [string]$SiteId = ""
)

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Host "npx not found. Install Node.js/npm or run: npm i -g netlify-cli"
    exit 1
}

if (-not (Test-Path -Path $Dir)) {
    Write-Host "Directory '$Dir' not found. Make sure you ran the web export (e.g. npm run build:web) and that the folder exists." -ForegroundColor Red
    exit 1
}

if (-not $Env:NETLIFY_AUTH_TOKEN) {
    Write-Host "NETLIFY_AUTH_TOKEN is not set in the environment. Export your token first:" -ForegroundColor Yellow
    Write-Host "$Env:NETLIFY_AUTH_TOKEN = 'YOUR_TOKEN'   # temporary for this shell"
    exit 1
}

# Build the netlify deploy command
$cmd = "npx netlify-cli deploy --dir=$Dir --message '$Message'"
if ($SiteId -ne "") { $cmd += " --site $SiteId" }

Write-Host "Running: $cmd"

# Execute
Invoke-Expression $cmd

Write-Host "Done. Check the CLI output for the published URL(s)."