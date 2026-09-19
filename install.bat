@echo off
setlocal EnableExtensions
title MGIS 3D-Planner Installer

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

if not exist "%ROOT%\package.json" (
    echo ERROR: package.json was not found.
    echo Run this installer from the MGIS 3D-Planner project folder.
    pause
    exit /b 1
)

cd /d "%ROOT%"
if errorlevel 1 (
    echo ERROR: Could not enter the project folder.
    pause
    exit /b 1
)

echo ==================================================
echo   MGIS 3D-Planner Installer
echo ==================================================
echo   MundoGIS 3D planning, service-ready installer
echo Project folder: %ROOT%
echo.

set "ENV_FILE=%ROOT%\.env"
set "GUI_CONFIG=%TEMP%\mgis-3d-planner-install.env"
if exist "%GUI_CONFIG%" del /q "%GUI_CONFIG%" >nul 2>&1

echo Launching configuration window...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\install_gui.ps1" -Root "%ROOT%" -OutputPath "%GUI_CONFIG%"
if errorlevel 2 exit /b 0
if errorlevel 1 goto console_env_setup

if not exist "%GUI_CONFIG%" (
    echo ERROR: The installer window did not return a configuration file.
    pause
    exit /b 1
)

call :LoadEnvConfig "%GUI_CONFIG%"
if not "%LICENSE_ACCEPTED%"=="1" (
    echo ERROR: The license terms were not accepted.
    pause
    exit /b 1
)
call :WriteEnvFile
del /q "%GUI_CONFIG%" >nul 2>&1
echo .env updated at %ENV_FILE%
echo.
goto skip_env_setup

:console_env_setup
echo.
echo Falling back to console configuration.
echo.
choice /c LP /n /m "Choose deployment mode [L/P]: "
if errorlevel 2 (
    set "APP_ENV=production"
    set "SESSION_COOKIE_SECURE=true"
    set "TRUST_PROXY=1"
) else (
    set "APP_ENV=development"
    set "APP_URL=http://localhost:3000"
    set "CORS_ORIGIN=http://localhost:3000"
    set "SESSION_COOKIE_SECURE=false"
    set "TRUST_PROXY=0"
)

if /I "%APP_ENV%"=="production" (
    set "SESSION_COOKIE_SAME_SITE=strict"
) else (
    set "SESSION_COOKIE_SAME_SITE=lax"
)

if /I "%APP_ENV%"=="production" (
    call :PromptRequired "Enter production URL (for example https://planner.example.com): " APP_URL
    call :PromptRequired "Enter allowed CORS origin (usually the same URL): " CORS_ORIGIN
) else (
    set "APP_URL=http://localhost:3000"
    set "CORS_ORIGIN=http://localhost:3000"
)

call :PromptOptional "Enter Cesium Ion token (optional): " CESIUM_ION_TOKEN
call :GenerateSecret SESSION_SECRET
call :GenerateSecret JWT_SECRET

echo.
echo The project license is available at: %ROOT%\LICENSE
choice /c YN /n /m "Do you accept the MGIS 3D-Planner license terms? [Y/N]: "
if errorlevel 2 (
    echo ERROR: The license terms were not accepted.
    pause
    exit /b 1
)
set "LICENSE_ACCEPTED=1"

call :WriteEnvFile
echo .env updated at %ENV_FILE%
echo.
:skip_env_setup

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js was not found in PATH.
    echo Install Node.js 24 LTS or Node.js 20.11+ and try again.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm was not found in PATH.
    echo Reinstall Node.js so npm is included, then try again.
    pause
    exit /b 1
)

for /f "usebackq delims=" %%V in (`node -p "process.versions.node"`) do set "NODE_VERSION=%%V"
for /f "tokens=1 delims=." %%A in ("%NODE_VERSION%") do set "NODE_MAJOR=%%A"

echo Node.js detected: %NODE_VERSION%
if %NODE_MAJOR% LSS 20 (
    echo WARNING: This project expects a modern LTS release. Node 24 LTS is recommended.
)
if %NODE_MAJOR% GEQ 25 (
    echo WARNING: Node 25 is not recommended for this project. Use Node 24 LTS.
)
echo.

echo Installing dependencies...
call npm.cmd install
if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

if /I "%INSTALL_SERVICE%"=="true" goto do_service_install

choice /c YN /n /m "Install MGIS 3D-Planner as a Windows service now? [Y/N]: "
if errorlevel 2 goto skip_service_install

:do_service_install

echo.
echo Installing Windows service...
node "%ROOT%\service.js"
if errorlevel 1 (
    echo.
    echo ERROR: Windows service installation failed.
    echo You can retry later by running: node "%ROOT%\service.js"
    pause
    exit /b 1
)
echo Windows service installed successfully.
echo.
:skip_service_install

echo.
echo Installation completed successfully.
echo Thank you for installing MGIS 3D-Planner.
echo.
echo Next steps:
echo   1. Review your .env file if it exists, or create one if your deployment needs it.
echo   2. Run: npm start
echo   3. For development: npm run dev
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Thank you for installing MGIS 3D-Planner. The installation has finished successfully.', 'MGIS 3D-Planner Installer', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null"
echo.
pause
exit /b 0

:LoadEnvConfig
for /f "usebackq tokens=1,* delims==" %%A in ("%~1") do call :ApplyEnvPair "%%A" "%%B"
exit /b 0

:ApplyEnvPair
set "KEY=%~1"
set "VALUE=%~2"
if /I "%KEY%"=="APP_ENV" set "APP_ENV=%VALUE%"
if /I "%KEY%"=="APP_URL" set "APP_URL=%VALUE%"
if /I "%KEY%"=="CORS_ORIGIN" set "CORS_ORIGIN=%VALUE%"
if /I "%KEY%"=="SESSION_COOKIE_SECURE" set "SESSION_COOKIE_SECURE=%VALUE%"
if /I "%KEY%"=="SESSION_COOKIE_SAME_SITE" set "SESSION_COOKIE_SAME_SITE=%VALUE%"
if /I "%KEY%"=="SESSION_SECRET" set "SESSION_SECRET=%VALUE%"
if /I "%KEY%"=="JWT_SECRET" set "JWT_SECRET=%VALUE%"
if /I "%KEY%"=="CESIUM_ION_TOKEN" set "CESIUM_ION_TOKEN=%VALUE%"
if /I "%KEY%"=="TRUST_PROXY" set "TRUST_PROXY=%VALUE%"
if /I "%KEY%"=="INSTALL_SERVICE" set "INSTALL_SERVICE=%VALUE%"
if /I "%KEY%"=="LICENSE_ACCEPTED" set "LICENSE_ACCEPTED=%VALUE%"
exit /b 0

:WriteEnvFile
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$content = @(
        '# Environment mode',
        ('APP_ENV=' + $env:APP_ENV),
        'PORT=3000',
        ('TRUST_PROXY=' + $env:TRUST_PROXY),
        '',
        ('APP_URL=' + $env:APP_URL),
        ('CORS_ORIGIN=' + $env:CORS_ORIGIN),
        ('SESSION_COOKIE_SECURE=' + $env:SESSION_COOKIE_SECURE),
        ('SESSION_COOKIE_SAME_SITE=' + $env:SESSION_COOKIE_SAME_SITE),
        '',
        ('SESSION_SECRET=' + $env:SESSION_SECRET),
        ('JWT_SECRET=' + $env:JWT_SECRET),
        ('CESIUM_ION_TOKEN=' + $env:CESIUM_ION_TOKEN)
    ) -join [Environment]::NewLine; Set-Content -LiteralPath $env:ENV_FILE -Value $content -Encoding ASCII"
exit /b 0

:GenerateSecret
for /f "usebackq delims=" %%S in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[Convert]::ToBase64String((1..48 ^| ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))"`) do set "%~1=%%S"
exit /b 0

:PromptRequired
setlocal
set "PROMPT_TEXT=%~1"
set "TARGET_VAR=%~2"
:prompt_required_loop
set "INPUT_VALUE="
set /p "INPUT_VALUE=%PROMPT_TEXT%"
if not defined INPUT_VALUE (
    echo This value is required.
    goto prompt_required_loop
)
endlocal & set "%TARGET_VAR%=%INPUT_VALUE%"
exit /b 0

:PromptOptional
setlocal
set "PROMPT_TEXT=%~1"
set "TARGET_VAR=%~2"
set "INPUT_VALUE="
set /p "INPUT_VALUE=%PROMPT_TEXT%"
endlocal & set "%TARGET_VAR%=%INPUT_VALUE%"
exit /b 0
