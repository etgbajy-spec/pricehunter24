@echo off
echo ========================================
echo    PriceHunter Website Deployer
echo ========================================
echo.

echo [1/4] Checking current directory...
if not exist "index.html" (
    echo ERROR: index.html not found!
    echo Please run this script from the website directory.
    pause
    exit /b 1
)

echo [2/4] Checking Netlify CLI...
netlify --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Netlify CLI not installed!
    echo Please install: npm install -g netlify-cli
    pause
    exit /b 1
)

echo [3/4] Deploying to Netlify...
netlify deploy --prod

if errorlevel 1 (
    echo ERROR: Deployment failed!
    pause
    exit /b 1
)

echo [4/4] Deployment completed successfully!
echo.
echo Site URL: https://pricehunt24.com
echo Netlify URL: https://pricehunter24.netlify.app
echo.
echo Press any key to exit...
pause >nul 