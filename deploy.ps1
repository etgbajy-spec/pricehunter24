Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    PriceHunter Website Deployer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check current directory
Write-Host "[1/4] Checking current directory..." -ForegroundColor Yellow
if (-not (Test-Path "index.html")) {
    Write-Host "ERROR: index.html not found!" -ForegroundColor Red
    Write-Host "Please run this script from the website directory." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 2: Check Netlify CLI
Write-Host "[2/4] Checking Netlify CLI..." -ForegroundColor Yellow
try {
    $null = netlify --version
} catch {
    Write-Host "ERROR: Netlify CLI not installed!" -ForegroundColor Red
    Write-Host "Please install: npm install -g netlify-cli" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 3: Deploy
Write-Host "[3/4] Deploying to Netlify..." -ForegroundColor Yellow
$result = netlify deploy --prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Deployment failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 4: Success
Write-Host "[4/4] Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Site URL: https://pricehunt24.com" -ForegroundColor Cyan
Write-Host "Netlify URL: https://pricehunter24.netlify.app" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit" 