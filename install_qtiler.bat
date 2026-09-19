@echo off
REM ==========================================================================
REM  Qtiler Installer by MundoGIS
REM  Double-click to install. Requires Windows administrator privileges.
REM ==========================================================================
setlocal enabledelayedexpansion
title Qtiler Installer by MundoGIS

set "QTILER_ELEVATED_ARG="
set "QTILER_FORCED_ROOT=%QTILER_FORCED_ROOT%"

:parse_installer_args
if "%~1"=="" goto installer_args_done
if /i "%~1"=="--elevated" (
    set "QTILER_ELEVATED_ARG=--elevated"
    shift
    goto parse_installer_args
)
if /i "%~1"=="--root" (
    set "QTILER_FORCED_ROOT=%~2"
    shift
    shift
    goto parse_installer_args
)
shift
goto parse_installer_args

:installer_args_done

REM Resolve the real Qtiler package root before elevation. When a batch file is
REM launched from an elevated context, Windows can otherwise start in
REM C:\Windows\System32 and make the installer look incomplete.
set "QTILER_LAUNCH_DIR=%CD%"
set "QTILER_SCRIPT_DIR=%~dp0"
set "QTILER_BOOT_ROOT="
if defined QTILER_FORCED_ROOT (
    if exist "%QTILER_FORCED_ROOT%\package.json" if exist "%QTILER_FORCED_ROOT%\server.js" if exist "%QTILER_FORCED_ROOT%\tools\run_qgis_python.bat" set "QTILER_BOOT_ROOT=%QTILER_FORCED_ROOT%"
)
if exist "%QTILER_SCRIPT_DIR%package.json" if exist "%QTILER_SCRIPT_DIR%server.js" if exist "%QTILER_SCRIPT_DIR%tools\run_qgis_python.bat" set "QTILER_BOOT_ROOT=%QTILER_SCRIPT_DIR%"
if not defined QTILER_BOOT_ROOT (
    if exist "%QTILER_LAUNCH_DIR%\package.json" if exist "%QTILER_LAUNCH_DIR%\server.js" if exist "%QTILER_LAUNCH_DIR%\tools\run_qgis_python.bat" set "QTILER_BOOT_ROOT=%QTILER_LAUNCH_DIR%"
)
if not defined QTILER_BOOT_ROOT set "QTILER_BOOT_ROOT=%QTILER_SCRIPT_DIR%"
if "%QTILER_BOOT_ROOT:~-1%"=="\" set "QTILER_BOOT_ROOT=%QTILER_BOOT_ROOT:~0,-1%"
set "QTILER_INSTALLER_BAT=%QTILER_BOOT_ROOT%\install.bat"
if not exist "%QTILER_INSTALLER_BAT%" set "QTILER_INSTALLER_BAT=%~f0"

REM --- Self-elevate to administrator ---
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    echo A new elevated installer window should open. Keep that window open for installation messages.
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$bat = '%QTILER_INSTALLER_BAT%'; $work = '%QTILER_BOOT_ROOT%'; $q = [char]34; $cmd = 'set ' + $q + 'QTILER_FORCED_ROOT=' + $work + $q + ' & call ' + $q + $bat + $q + ' --elevated --root ' + $q + $work + $q; Start-Process -FilePath $env:ComSpec -ArgumentList @('/d', '/k', $cmd) -WorkingDirectory $work -Verb RunAs"
    if errorlevel 1 (
        echo ERROR: Could not request administrator privileges.
        echo Right-click install.bat and choose Run as administrator.
        pause
        exit /b 1
    )
    exit /b
)

cd /d "%QTILER_BOOT_ROOT%"
if errorlevel 1 (
    echo ERROR: Could not enter installer folder: %QTILER_BOOT_ROOT%
    echo Installer path: %~f0
    echo Launch folder:  %QTILER_LAUNCH_DIR%
    echo Right-click install.bat from the Qtiler folder and choose Run as administrator.
    pause
    exit /b 1
)
set "QTILER_ROOT=%cd%"
set "QTILER_LOG_DIR=%QTILER_ROOT%\logs"
set "QTILER_INSTALL_LOG=%QTILER_LOG_DIR%\install.log"
set "QTILER_SETUP_MODE=new"
set "QTILER_PREVIOUS_ROOT="
set "QTILER_EXISTING_ADMIN_PASSWORD="
set "QTILER_ADMIN_PASSWORD="
set "QTILER_ADMIN_PASSWORD_DISPLAY="
set "QTILER_ADMIN_PASSWORD_PRESERVE=0"
set "QTILERAUTH_EXPECTED=1"
set "QTILERAUTH_INSTALL_STATUS="
set "QTILER_SERVICE_NAME=QTiler"
set "QTILER_SERVICE_NAME_DEFAULT=QTiler"
set "QTILER_VERSION=unknown"
set "QTILER_PREVIOUS_VERSION="
set "QGIS_VALIDATION_ATTEMPTS=0"

echo ================================================================
echo                    Qtiler Installer by MundoGIS
echo ================================================================
echo.

if not exist "%QTILER_LOG_DIR%" mkdir "%QTILER_LOG_DIR%" >nul 2>&1
>>"%QTILER_INSTALL_LOG%" echo.
>>"%QTILER_INSTALL_LOG%" echo ================================================================
>>"%QTILER_INSTALL_LOG%" echo Qtiler install started %date% %time%
>>"%QTILER_INSTALL_LOG%" echo Root: %QTILER_ROOT%
echo Installer log: %QTILER_INSTALL_LOG%
echo.

REM ----------------------------------------------------------------------
REM  Preflight: verify local installer requirements before interactive setup
REM ----------------------------------------------------------------------
echo [Qtiler] Checking installer requirements...
where powershell >nul 2>&1
if errorlevel 1 (
    echo ERROR: Windows PowerShell was not found in PATH.
    echo Qtiler installer requires PowerShell for dialogs, downloads and service checks.
    echo This Windows installation is missing a required system component. Install or repair Windows PowerShell, then run install.bat again.
    >>"%QTILER_INSTALL_LOG%" echo ERROR: PowerShell not found in PATH.
    pause
    exit /b 1
)
where sc.exe >nul 2>&1
if errorlevel 1 (
    echo ERROR: Windows Service Control ^(sc.exe^) was not found in PATH.
    echo Qtiler must install and manage a Windows service. Repair the Windows PATH or Service Control tools, then run install.bat again.
    >>"%QTILER_INSTALL_LOG%" echo ERROR: sc.exe not found in PATH.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Windows Service Control (sc.exe) was not found in PATH.' + [Environment]::NewLine + [Environment]::NewLine + 'Qtiler must install and manage a Windows service. Repair the Windows PATH or Windows service tools, then run install.bat again.', 'Qtiler Installer - Windows Requirement Missing', 'OK', 'Error')" >nul
    pause
    exit /b 1
)
where msiexec.exe >nul 2>&1
if errorlevel 1 (
    echo ERROR: Windows Installer ^(msiexec.exe^) was not found in PATH.
    echo Qtiler may need Windows Installer to install Node.js automatically. Repair Windows Installer, then run install.bat again.
    >>"%QTILER_INSTALL_LOG%" echo ERROR: msiexec.exe not found in PATH.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Windows Installer (msiexec.exe) was not found in PATH.' + [Environment]::NewLine + [Environment]::NewLine + 'Qtiler may need Windows Installer to install Node.js automatically. Repair Windows Installer, then run install.bat again.', 'Qtiler Installer - Windows Requirement Missing', 'OK', 'Error')" >nul
    pause
    exit /b 1
)
if not exist "%QTILER_ROOT%\package.json" goto missing_installer_files
if not exist "%QTILER_ROOT%\server.js" goto missing_installer_files
if not exist "%QTILER_ROOT%\service\install-service.js" goto missing_installer_files
if not exist "%QTILER_ROOT%\service\uninstall-service.js" goto missing_installer_files
if not exist "%QTILER_ROOT%\tools\run_qgis_python.bat" goto missing_installer_files
if not exist "%QTILER_ROOT%\tools\qtilerauth-install-policy.mjs" goto missing_installer_files
if not exist "%QTILER_ROOT%\tools\resolve-qgis-installation.ps1" goto missing_installer_files
if not exist "%QTILER_ROOT%\tools\detect-qtiler-service-root.ps1" goto missing_installer_files
if not exist "%QTILER_ROOT%\tools\qtiler-runtime-state.ps1" goto missing_installer_files
if not exist "%QTILER_ROOT%\tools\qtiler-service.ps1" goto missing_installer_files
if not exist "%QTILER_ROOT%\tools\mesh_build.py" echo WARNING: tools\mesh_build.py was not found. QuantizedMesh builds will not work until it is restored.
if not exist "%QTILER_ROOT%\tools\mesh_dem_to_terrain_runner.mjs" echo WARNING: tools\mesh_dem_to_terrain_runner.mjs was not found. QuantizedMesh builds will not work until it is restored.
for /f "usebackq delims=" %%V in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$pkg = Join-Path $env:QTILER_ROOT 'package.json'; try { $v = ((Get-Content -Raw -LiteralPath $pkg) | ConvertFrom-Json).version; if ($v) { $v } } catch { }"`) do set "QTILER_VERSION=%%V"
if not defined QTILER_VERSION set "QTILER_VERSION=unknown"
echo   Administrator privileges: OK
echo   PowerShell: OK
echo   Windows Service Control: OK
echo   Windows Installer: OK
echo   Required Qtiler files: OK
echo   Qtiler package version: %QTILER_VERSION%
echo   Node.js: checked before QGIS setup and installed automatically if missing
echo   QGIS Desktop: you will be asked for a QGIS 3.x folder after setup mode is selected
echo.
>>"%QTILER_INSTALL_LOG%" echo Preflight OK.
echo [Qtiler] Continuing in this window. Progress and npm installation output will be visible here.
echo.
goto preflight_ok

:missing_installer_files
echo ERROR: This Qtiler folder is incomplete.
echo Required files include package.json, server.js, service scripts and required tools under tools\.
echo.
echo Selected installer root: %QTILER_ROOT%
echo Installer script path:   %~f0
echo Original launch folder:  %QTILER_LAUNCH_DIR%
echo Forced installer root:   %QTILER_FORCED_ROOT%
echo.
echo If the selected root is C:\Windows\System32, Windows is launching the wrong copy or shortcut.
echo Open the extracted Qtiler package folder and run that folder's install.bat.
echo Please extract or copy the full Qtiler package and run install.bat again.
powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('This Qtiler folder is incomplete.' + [Environment]::NewLine + [Environment]::NewLine + 'Required files include package.json, server.js, service scripts and required tools under tools.' + [Environment]::NewLine + [Environment]::NewLine + 'Selected root:' + [Environment]::NewLine + '%QTILER_ROOT%' + [Environment]::NewLine + [Environment]::NewLine + 'Extract the full Qtiler package and run install.bat from that folder.', 'Qtiler Installer - Incomplete Package', 'OK', 'Error')" >nul
>>"%QTILER_INSTALL_LOG%" echo ERROR: Required installer files are missing under %QTILER_ROOT%.
>>"%QTILER_INSTALL_LOG%" echo Installer script path: %~f0
>>"%QTILER_INSTALL_LOG%" echo Original launch folder: %QTILER_LAUNCH_DIR%
>>"%QTILER_INSTALL_LOG%" echo Forced installer root: %QTILER_FORCED_ROOT%
pause
exit /b 1

:preflight_ok
>>"%QTILER_INSTALL_LOG%" echo Step 0: checking existing Qtiler Windows service.

REM ----------------------------------------------------------------------
REM  Step 0: Choose install/update mode and locate any previous runtime data
REM ----------------------------------------------------------------------
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%QTILER_ROOT%\tools\detect-qtiler-service-root.ps1"`) do set "QTILER_PREVIOUS_ROOT=%%I"

set "QTILER_GUI_CONFIG=%QTILER_ROOT%\temp\qtiler-installer-config.txt"
set "QTILER_PROGRESS_LOG=%QTILER_ROOT%\temp\qtiler-install-progress.txt"
if exist "%QTILER_GUI_CONFIG%" del /q "%QTILER_GUI_CONFIG%" >nul 2>&1
if not exist "%QTILER_ROOT%\temp" mkdir "%QTILER_ROOT%\temp" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -File "%QTILER_ROOT%\tools\qtiler-installer-gui.ps1" -Root "%QTILER_ROOT%" -OutputPath "%QTILER_GUI_CONFIG%" -DefaultPreviousRoot "%QTILER_PREVIOUS_ROOT%"
if errorlevel 2 (
    echo Installation cancelled by user.
    >>"%QTILER_INSTALL_LOG%" echo User cancelled the installer GUI before configuration was returned.
    exit /b 1
)
if errorlevel 1 (
    echo ERROR: The graphical installer could not start.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('The graphical installer failed to start or crashed before returning a valid configuration.' + [Environment]::NewLine + [Environment]::NewLine + 'The installer will stop so the system is left in a safe state instead of hanging.', 'Qtiler Installer - GUI Startup Failed', 'OK', 'Error')" >nul
    >>"%QTILER_INSTALL_LOG%" echo ERROR: GUI could not start or crashed before returning configuration.
    pause
    exit /b 1
)
set "QTILER_GUI_WAIT_SECONDS=0"
:wait_for_gui_config
if exist "%QTILER_GUI_CONFIG%" goto gui_config_loaded
timeout /t 2 /nobreak >nul
set /a QTILER_GUI_WAIT_SECONDS+=2
if %QTILER_GUI_WAIT_SECONDS% GEQ 60 (
    echo ERROR: The installer GUI did not return a valid configuration in time.
    echo This usually means the form stalled, crashed, or failed to validate the QGIS path.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('The Qtiler installer did not return a valid configuration within the expected time.' + [Environment]::NewLine + [Environment]::NewLine + 'This usually means the form stalled, crashed, or the QGIS validation failed.' + [Environment]::NewLine + [Environment]::NewLine + 'The installer will exit safely without leaving the system in an incomplete state.', 'Qtiler Installer - GUI Timeout', 'OK', 'Error')" >nul
    >>"%QTILER_INSTALL_LOG%" echo ERROR: GUI watchdog timed out waiting for configuration file after 60 seconds.
    exit /b 1
)
goto wait_for_gui_config
:gui_config_loaded
set "QTILER_SETUP_MODE="
set "QTILER_INSTALL_MODE="
set "QTILER_LICENSE_ACCEPTED=0"
for /f "usebackq tokens=1,* delims==" %%A in ("%QTILER_GUI_CONFIG%") do call :read_gui_setting "%%A" "%%B"
>>"%QTILER_INSTALL_LOG%" echo GUI configuration parsed. Mode=%QTILER_SETUP_MODE%, profile=%QTILER_INSTALL_MODE%, licenseAccepted=%QTILER_LICENSE_ACCEPTED%, qgisRoot=%QGIS_ROOT%.
if /i not "%QTILER_SETUP_MODE%"=="new" if /i not "%QTILER_SETUP_MODE%"=="update" (
    echo ERROR: The installer did not return a valid mode. The setup cannot continue safely.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('The Qtiler installer returned an invalid setup mode.' + [Environment]::NewLine + [Environment]::NewLine + 'The installer will stop safely instead of continuing with incomplete configuration.', 'Qtiler Installer - Invalid Setup Mode', 'OK', 'Error')" >nul
    pause
    exit /b 1
)
if /i "%QTILER_SETUP_MODE%"=="update" if not defined QTILER_PREVIOUS_ROOT (
    echo ERROR: Update mode requires an existing Qtiler folder.
    pause
    exit /b 1
)
if /i "%QTILER_LICENSE_ACCEPTED%" NEQ "1" (
    echo ERROR: You must accept the Qtiler license terms to continue.
    pause
    exit /b 1
)
if /i "%QTILER_SETUP_MODE%"=="update" set "QTILER_ADMIN_PASSWORD_PRESERVE=1"
>>"%QTILER_INSTALL_LOG%" echo Graphical installer settings loaded. Mode=%QTILER_SETUP_MODE%, profile=%QTILER_INSTALL_MODE%, licenseAccepted=%QTILER_LICENSE_ACCEPTED%.

del /q "%QTILER_GUI_CONFIG%" >nul 2>&1
>"%QTILER_PROGRESS_LOG%" echo Preparing installation^|5^|Starting the Qtiler installation wizard.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$args = @('-NoProfile','-ExecutionPolicy','Bypass','-File','%QTILER_ROOT%\tools\qtiler-installer-gui.ps1','-Root','%QTILER_ROOT%','-OutputPath','%QTILER_PROGRESS_LOG%','-ProgressLog','%QTILER_PROGRESS_LOG%','-InstallLog','%QTILER_INSTALL_LOG%'); Start-Process -FilePath 'powershell.exe' -ArgumentList $args -WindowStyle Normal" >nul
if errorlevel 1 (
    echo ERROR: The installation progress window could not be started.
    >>"%QTILER_INSTALL_LOG%" echo ERROR: The installation progress window could not be started.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('The installation progress window could not be started.' + [Environment]::NewLine + [Environment]::NewLine + 'The installer will stop instead of continuing invisibly.', 'Qtiler Installer - Progress Window Error', 'OK', 'Error')" >nul
    pause
    exit /b 1
)

if defined QTILER_PREVIOUS_ROOT (
    >>"%QTILER_INSTALL_LOG%" echo Existing Qtiler service detected at %QTILER_PREVIOUS_ROOT%.
)
call :write_progress "Preparing installation" 10 "Configuration accepted. Preparing the selected Qtiler setup."
goto previous_root_ok

:ask_previous_root
echo.
echo [Qtiler] Waiting for previous Qtiler installation folder input...
>>"%QTILER_INSTALL_LOG%" echo Waiting for previous Qtiler installation folder input dialog.
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::InputBox('Enter the full path to the existing Qtiler installation that should be updated.' + [Environment]::NewLine + [Environment]::NewLine + 'The installer will stop the Qtiler Windows service if present, back up .env, data, maps, cache, config, uploads, logs and custom plugins, then copy them into this new package.' + [Environment]::NewLine + [Environment]::NewLine + 'Example: C:\Qtiler', 'Qtiler Installer - Previous Installation Path', 'C:\Qtiler')"`) do set "QTILER_PREVIOUS_ROOT=%%I"
if not defined QTILER_PREVIOUS_ROOT (
    echo Installation cancelled by user.
    >>"%QTILER_INSTALL_LOG%" echo Installation cancelled at previous installation folder prompt.
    pause
    exit /b 1
)
set "QTILER_PREVIOUS_ROOT=%QTILER_PREVIOUS_ROOT:"=%"
if "%QTILER_PREVIOUS_ROOT:~-1%"=="\" set "QTILER_PREVIOUS_ROOT=%QTILER_PREVIOUS_ROOT:~0,-1%"
if not exist "%QTILER_PREVIOUS_ROOT%\" (
    >>"%QTILER_INSTALL_LOG%" echo Invalid previous installation folder: %QTILER_PREVIOUS_ROOT%.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('The previous Qtiler folder was not found:' + [Environment]::NewLine + '%QTILER_PREVIOUS_ROOT%' + [Environment]::NewLine + [Environment]::NewLine + 'Please choose an existing Qtiler installation folder.', 'Qtiler Installer - Invalid Previous Folder', 'OK', 'Error')" >nul
    set "QTILER_PREVIOUS_ROOT="
    goto ask_previous_root
)
if not exist "%QTILER_PREVIOUS_ROOT%\.env" if not exist "%QTILER_PREVIOUS_ROOT%\data" if not exist "%QTILER_PREVIOUS_ROOT%\qgisprojects" (
    >>"%QTILER_INSTALL_LOG%" echo Previous folder does not look like a Qtiler runtime folder: %QTILER_PREVIOUS_ROOT%.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('The selected folder does not contain .env, data or qgisprojects.' + [Environment]::NewLine + [Environment]::NewLine + 'Please choose the existing Qtiler installation folder so user data can be preserved safely.', 'Qtiler Installer - Invalid Previous Folder', 'OK', 'Error')" >nul
    set "QTILER_PREVIOUS_ROOT="
    goto ask_previous_root
)
>>"%QTILER_INSTALL_LOG%" echo Previous Qtiler root selected manually: %QTILER_PREVIOUS_ROOT%.

:previous_root_ok

if /i "%QTILER_SETUP_MODE%"=="update" if exist "%QTILER_PREVIOUS_ROOT%\package.json" (
    for /f "usebackq delims=" %%V in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$pkg = Join-Path $env:QTILER_PREVIOUS_ROOT 'package.json'; try { $v = ((Get-Content -Raw -LiteralPath $pkg) | ConvertFrom-Json).version; if ($v) { $v } } catch { }"`) do set "QTILER_PREVIOUS_VERSION=%%V"
)
if /i "%QTILER_SETUP_MODE%"=="update" (
    if defined QTILER_PREVIOUS_VERSION (
        echo Existing Qtiler version detected: %QTILER_PREVIOUS_VERSION%
        echo This installer will update Qtiler to version: %QTILER_VERSION%
        >>"%QTILER_INSTALL_LOG%" echo Previous version: %QTILER_PREVIOUS_VERSION%. Target version: %QTILER_VERSION%.
    ) else (
        echo This installer will update Qtiler to version: %QTILER_VERSION%
        >>"%QTILER_INSTALL_LOG%" echo Previous version not detected. Target version: %QTILER_VERSION%.
    )
    echo.
)

REM ----------------------------------------------------------------------
REM  Step 0a: Ask for Windows service name
REM ----------------------------------------------------------------------
if exist "%QTILER_ROOT%\.env" (
    for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b /c:"QTILER_SERVICE_NAME=" "%QTILER_ROOT%\.env" 2^>nul`) do (
        if /i "%%A"=="QTILER_SERVICE_NAME" set "QTILER_SERVICE_NAME_DEFAULT=%%B"
    )
)
if /i "%QTILER_SETUP_MODE%"=="update" if exist "%QTILER_PREVIOUS_ROOT%\.env" (
    for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b /c:"QTILER_SERVICE_NAME=" "%QTILER_PREVIOUS_ROOT%\.env" 2^>nul`) do (
        if /i "%%A"=="QTILER_SERVICE_NAME" set "QTILER_SERVICE_NAME_DEFAULT=%%B"
    )
)
if not defined QTILER_SERVICE_NAME_DEFAULT set "QTILER_SERVICE_NAME_DEFAULT=QTiler"

:ask_service_name
if defined QTILER_GUI_CONFIG goto service_name_ok
echo [Qtiler] Waiting for Windows service name input...
>>"%QTILER_INSTALL_LOG%" echo Step 0a: waiting for Windows service name input. Default=%QTILER_SERVICE_NAME_DEFAULT%.
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::InputBox('Choose the Windows Service name for this Qtiler installation.' + [Environment]::NewLine + [Environment]::NewLine + 'Use a unique name if this server will host more than one Qtiler instance.' + [Environment]::NewLine + 'Allowed characters: letters, numbers, spaces, dot, underscore and hyphen.' + [Environment]::NewLine + [Environment]::NewLine + 'Default: %QTILER_SERVICE_NAME_DEFAULT%', 'Qtiler Installer - Windows Service Name', '%QTILER_SERVICE_NAME_DEFAULT%')"`) do set "QTILER_SERVICE_NAME=%%I"
if not defined QTILER_SERVICE_NAME (
    echo Installation cancelled by user.
    >>"%QTILER_INSTALL_LOG%" echo Installation cancelled at Windows service name prompt.
    pause
    exit /b 1
)
set "QTILER_SERVICE_NAME=%QTILER_SERVICE_NAME:"=%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "if ('%QTILER_SERVICE_NAME%' -notmatch '^[A-Za-z0-9._ -]{1,80}$') { exit 1 }"
if errorlevel 1 (
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('The service name must be 1-80 characters and may only contain letters, numbers, spaces, dot, underscore and hyphen.', 'Qtiler Installer - Invalid Service Name', 'OK', 'Error')" >nul
    goto ask_service_name
)
echo Selected Windows service name: %QTILER_SERVICE_NAME%
>>"%QTILER_INSTALL_LOG%" echo Selected Windows service name: %QTILER_SERVICE_NAME%.
echo.

:service_name_ok

if /i "%QTILER_SETUP_MODE%"=="update" (
    echo.
    echo IMPORTANT: Update mode will stop the Qtiler Windows service and back up user runtime data before continuing.
    echo Bundled Qtiler plugins will be updated from this package. Custom plugins and plugin user data will be preserved.
    echo Do not close this installer while the update is running. Closing the window can leave the service stopped or runtime data only partially copied.
    if not defined QTILER_GUI_CONFIG (
        choice /C YN /N /M "Continue with update mode? [Y/N]: "
        if errorlevel 2 (
            echo Update cancelled by user before any update changes were applied.
            >>"%QTILER_INSTALL_LOG%" echo Update cancelled by user before service stop/runtime backup.
            pause
            exit /b 1
        )
    )
    echo.
    echo [Qtiler] Stopping existing service before preserving runtime state...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%QTILER_ROOT%\tools\qtiler-service.ps1" -Action stop -ServiceName "%QTILER_SERVICE_NAME%"
    if errorlevel 1 (
        echo ERROR: Could not stop existing Qtiler Windows service before update.
        powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Could not stop the existing Qtiler Windows service before the update.' + [Environment]::NewLine + [Environment]::NewLine + 'Service: %QTILER_SERVICE_NAME%' + [Environment]::NewLine + [Environment]::NewLine + 'The update was stopped before runtime data was copied. Check Windows Services, then run the installer again as administrator.', 'Qtiler Installer - Update Service Stop Failed', 'OK', 'Error')" >nul
        pause
        exit /b 1
    )
    for /f "usebackq delims=" %%S in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"`) do set "QTILER_BACKUP_STAMP=%%S"
    echo.
    if /i not "%QTILER_PREVIOUS_ROOT%"=="%QTILER_ROOT%" (
        echo.
        echo [Qtiler] Copying runtime state from existing installation...
        powershell -NoProfile -ExecutionPolicy Bypass -File "%QTILER_ROOT%\tools\qtiler-runtime-state.ps1" -SourceRoot "%QTILER_PREVIOUS_ROOT%" -BackupRoot "%QTILER_ROOT%\upgrade-backups\b-%QTILER_BACKUP_STAMP%" -DestinationRoot "%QTILER_ROOT%" -ReplacedBackupRoot "%QTILER_ROOT%\upgrade-backups\r-%QTILER_BACKUP_STAMP%"
        if errorlevel 1 (
            echo ERROR: Could not copy runtime state from the existing installation.
            powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Could not copy runtime data from the existing Qtiler installation.' + [Environment]::NewLine + [Environment]::NewLine + 'Source:' + [Environment]::NewLine + '%QTILER_PREVIOUS_ROOT%' + [Environment]::NewLine + [Environment]::NewLine + 'Backup target:' + [Environment]::NewLine + '%QTILER_ROOT%\upgrade-backups\b-%QTILER_BACKUP_STAMP%' + [Environment]::NewLine + [Environment]::NewLine + 'Check disk space, file permissions, antivirus restrictions and the installer log.', 'Qtiler Installer - Update Backup Failed', 'OK', 'Error')" >nul
            pause
            exit /b 1
        )
        echo.
    ) else (
        echo [Qtiler] Update mode selected in the existing installation folder. Backing up runtime data before continuing...
        powershell -NoProfile -ExecutionPolicy Bypass -File "%QTILER_ROOT%\tools\qtiler-runtime-state.ps1" -SourceRoot "%QTILER_ROOT%" -BackupRoot "%QTILER_ROOT%\upgrade-backups\b-%QTILER_BACKUP_STAMP%"
        if errorlevel 1 (
            echo ERROR: Could not create in-place update backup.
            powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Could not create the in-place update backup.' + [Environment]::NewLine + [Environment]::NewLine + 'Backup target:' + [Environment]::NewLine + '%QTILER_ROOT%\upgrade-backups\b-%QTILER_BACKUP_STAMP%' + [Environment]::NewLine + [Environment]::NewLine + 'Check disk space, file permissions, antivirus restrictions and the installer log.', 'Qtiler Installer - Update Backup Failed', 'OK', 'Error')" >nul
            pause
            exit /b 1
        )
        echo.
    )
)

REM ----------------------------------------------------------------------
REM  Step 0b: Ensure Node.js (latest LTS) is installed before QGIS setup
REM ----------------------------------------------------------------------
call :write_progress "Checking requirements" 16 "Checking Node.js, Windows services and local prerequisites."
call :ensure_node
if errorlevel 1 (
    pause
    exit /b 1
)

REM ----------------------------------------------------------------------
REM  Step 1: Ask for QGIS Desktop installation path (popup window)
REM ----------------------------------------------------------------------
call :write_progress "Validating QGIS" 28 "Locating the QGIS Python environment and validating QGIS 3.x."
:ask_qgis
if defined QTILER_GUI_CONFIG goto qgis_gui_input
echo [Qtiler] Waiting for QGIS Desktop folder input...
echo A QGIS path dialog should be open. If it is hidden, check behind this installer window.
>>"%QTILER_INSTALL_LOG%" echo Step 1: waiting for QGIS Desktop folder input dialog.
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::InputBox('Please enter the full path to your QGIS Desktop installation folder.' + [Environment]::NewLine + [Environment]::NewLine + 'IMPORTANT: Qtiler requires QGIS 3.x (for example 3.34 LTR or 3.40).' + [Environment]::NewLine + 'QGIS 4.x is NOT supported.' + [Environment]::NewLine + [Environment]::NewLine + 'Example: C:\Program Files\QGIS 3.40' + [Environment]::NewLine + [Environment]::NewLine + 'Add the path to QGIS Desktop and click Enter.', 'Qtiler Installer - QGIS Desktop Path', 'C:\Program Files\QGIS 3.40')"`) do set "QGIS_ROOT=%%I"

if not defined QGIS_ROOT (
    echo Installation cancelled by user.
    >>"%QTILER_INSTALL_LOG%" echo Installation cancelled at QGIS Desktop folder prompt.
    pause
    exit /b 1
)

REM Strip surrounding quotes and trailing slash
set "QGIS_ROOT=%QGIS_ROOT:"=%"
if "%QGIS_ROOT:~-1%"=="\" set "QGIS_ROOT=%QGIS_ROOT:~0,-1%"

:qgis_gui_input

echo Selected QGIS folder: %QGIS_ROOT%
>>"%QTILER_INSTALL_LOG%" echo Selected QGIS folder: %QGIS_ROOT%.
echo.

REM Resolve QGIS again in the elevated process and parse a plain text result.
set "QGIS_RESOLVE_RESULT=%QTILER_ROOT%\temp\qtiler-qgis-resolved.txt"
if exist "%QGIS_RESOLVE_RESULT%" del /q "%QGIS_RESOLVE_RESULT%" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -File "%QTILER_ROOT%\tools\resolve-qgis-installation.ps1" -Path "%QGIS_ROOT%" >"%QGIS_RESOLVE_RESULT%" 2>>"%QTILER_INSTALL_LOG%"
if errorlevel 1 goto qgis_validation_failed
set "QGIS_ROOT="
set "QGIS_PREFIX_DIR="
set "QGIS_PYTHON_EXE="
set "OSGEO4W_BIN="
for /f "usebackq tokens=1,* delims==" %%A in ("%QGIS_RESOLVE_RESULT%") do call :read_gui_setting "%%A" "%%B"
del /q "%QGIS_RESOLVE_RESULT%" >nul 2>&1
if not defined QGIS_ROOT goto qgis_validation_failed
if not defined QGIS_PREFIX_DIR goto qgis_validation_failed
if not defined QGIS_PYTHON_EXE goto qgis_validation_failed
if not exist "%QGIS_PYTHON_EXE%" goto qgis_validation_failed
powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:PYTHONHOME = (Get-ChildItem (Join-Path '%QGIS_ROOT%' 'apps\Python*') -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName); $env:PYTHONPATH = '%QGIS_PREFIX_DIR%\python'; $env:PATH = '%QGIS_ROOT%\bin;%QGIS_PREFIX_DIR%\bin;' + $env:PATH; & '%QGIS_PYTHON_EXE%' -c 'import qgis; print(qgis.__file__)'" >>"%QTILER_INSTALL_LOG%" 2>&1
if errorlevel 1 goto qgis_validation_failed
goto qgis_validation_ok

:qgis_validation_failed
call :write_progress "Error" 28 "QGIS validation failed. Check the selected QGIS 3.x folder and installer log."
echo ERROR: QGIS Python could not be validated.
>>"%QTILER_INSTALL_LOG%" echo ERROR: QGIS validation failed for the selected folder.
powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('QGIS Python could not be validated.' + [Environment]::NewLine + [Environment]::NewLine + 'Select the QGIS 3.x installation root, for example C:\QGIS_344 or C:\Program Files\QGIS 3.40.' + [Environment]::NewLine + [Environment]::NewLine + 'Details are available in:' + [Environment]::NewLine + '%QTILER_INSTALL_LOG%', 'Qtiler Installer - QGIS Validation Failed', 'OK', 'Error')" >nul
pause
exit /b 1

:qgis_validation_ok
call :write_progress "QGIS ready" 34 "QGIS 3.x and its Python runtime were validated successfully."

REM Detect QGIS major version from qgis-bin.exe metadata
set "QGIS_MAJOR=0"
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "try { (Get-Item '%QGIS_ROOT%\bin\qgis-bin.exe' -ErrorAction Stop).VersionInfo.FileMajorPart } catch { try { (Get-Item '%QGIS_ROOT%\bin\qgis-bin-ltr.exe' -ErrorAction Stop).VersionInfo.FileMajorPart } catch { 0 } }"`) do set "QGIS_MAJOR=%%V"

if "%QGIS_MAJOR%"=="4" (
    >>"%QTILER_INSTALL_LOG%" echo Unsupported QGIS version detected: major version 4 at %QGIS_ROOT%.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Detected QGIS 4.x at the selected folder.' + [Environment]::NewLine + [Environment]::NewLine + 'Qtiler requires QGIS 3.x (for example 3.34 LTR or 3.40).' + [Environment]::NewLine + 'Please install QGIS 3.x and run this installer again.', 'Qtiler Installer - Unsupported QGIS Version', 'OK', 'Error')" >nul
    exit /b 1
)

echo QGIS validated (major version: %QGIS_MAJOR%, prefix: %QGIS_PREFIX_DIR%).
echo QGIS Python: %QGIS_PYTHON_EXE%
>>"%QTILER_INSTALL_LOG%" echo QGIS validated: major=%QGIS_MAJOR%, prefix=%QGIS_PREFIX_DIR%, python=%QGIS_PYTHON_EXE%.
echo.

REM ----------------------------------------------------------------------
REM  Step 1b: Ask for Qtiler HTTP port (popup window)
REM ----------------------------------------------------------------------
set "QTILER_PORT_DEFAULT=3000"
if exist "%QTILER_ROOT%\.env" (
    for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b /c:"PORT=" "%QTILER_ROOT%\.env" 2^>nul`) do (
        if /i "%%A"=="PORT" set "QTILER_PORT_DEFAULT=%%B"
    )
)

:ask_port
if defined QTILER_GUI_CONFIG goto port_gui_input
echo [Qtiler] Waiting for HTTP port input...
>>"%QTILER_INSTALL_LOG%" echo Step 1b: waiting for HTTP port input dialog. Default=%QTILER_PORT_DEFAULT%.
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::InputBox('Please choose the HTTP port Qtiler should use.' + [Environment]::NewLine + [Environment]::NewLine + 'Use a free TCP port between 1 and 65535.' + [Environment]::NewLine + 'Default: %QTILER_PORT_DEFAULT%' + [Environment]::NewLine + [Environment]::NewLine + 'Examples: 3000, 3080, 8080', 'Qtiler Installer - HTTP Port', '%QTILER_PORT_DEFAULT%')"`) do set "QTILER_PORT=%%I"

if not defined QTILER_PORT (
    echo Installation cancelled by user.
    >>"%QTILER_INSTALL_LOG%" echo Installation cancelled at HTTP port prompt.
    pause
    exit /b 1
)

set "QTILER_PORT=%QTILER_PORT: =%"
set "QTILER_PORT=%QTILER_PORT:"=%"

:port_gui_input
for /f "delims=0123456789" %%A in ("%QTILER_PORT%") do set "QTILER_PORT_INVALID=%%A"
if defined QTILER_PORT_INVALID goto invalid_port
if "%QTILER_PORT%"=="" goto invalid_port
if %QTILER_PORT% LSS 1 goto invalid_port
if %QTILER_PORT% GTR 65535 goto invalid_port
goto port_ok

:invalid_port
set "QTILER_PORT_INVALID="
>>"%QTILER_INSTALL_LOG%" echo Invalid HTTP port entered. Prompting again.
powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('The port must be a number between 1 and 65535.' + [Environment]::NewLine + [Environment]::NewLine + 'Please choose a valid HTTP port for Qtiler.', 'Qtiler Installer - Invalid Port', 'OK', 'Error')" >nul
goto ask_port

:port_ok
set "QTILER_PORT_INVALID="
set "QTILER_PORT_IN_USE="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$conn = Get-NetTCPConnection -LocalPort %QTILER_PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($conn) { $procName = ''; try { $procName = (Get-Process -Id $conn.OwningProcess -ErrorAction Stop).ProcessName } catch {}; Write-Output (($conn.OwningProcess.ToString()) + ' ' + $procName) }"`) do set "QTILER_PORT_IN_USE=%%P"
if defined QTILER_PORT_IN_USE (
    echo WARNING: TCP port %QTILER_PORT% is already in use by process %QTILER_PORT_IN_USE%.
    >>"%QTILER_INSTALL_LOG%" echo WARNING: selected port %QTILER_PORT% already in use by %QTILER_PORT_IN_USE%.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('TCP port %QTILER_PORT% is already in use by process: %QTILER_PORT_IN_USE%' + [Environment]::NewLine + [Environment]::NewLine + 'Choose another port unless you are intentionally updating the service that already owns this port and it will be restarted by this installer.', 'Qtiler Installer - Port In Use', 'OK', 'Warning')" >nul
    choice /C RC /N /M "Port %QTILER_PORT% is in use. Re-enter port or continue anyway [R/C]: "
    if errorlevel 2 (
        echo Continuing with port %QTILER_PORT% by user confirmation.
        >>"%QTILER_INSTALL_LOG%" echo User chose to continue with occupied port %QTILER_PORT%.
    ) else (
        set "QTILER_PORT_IN_USE="
        goto ask_port
    )
)
echo Selected Qtiler HTTP port: %QTILER_PORT%
>>"%QTILER_INSTALL_LOG%" echo Selected Qtiler HTTP port: %QTILER_PORT%.
echo.

REM ----------------------------------------------------------------------
REM  Step 1c: Ask for installation profile and public IIS/HTTPS settings
REM ----------------------------------------------------------------------
if defined QTILER_GUI_CONFIG goto gui_profile_values
echo Installation profile:
echo   T = Test installation
echo   P = Production installation
choice /C TP /N /M "Choose installation profile [T/P]: "
if errorlevel 2 (
    set "QTILER_INSTALL_MODE=production"
) else (
    set "QTILER_INSTALL_MODE=test"
)
>>"%QTILER_INSTALL_LOG%" echo Installation profile selected: %QTILER_INSTALL_MODE%.

set "QTILER_BEHIND_IIS=0"
set "QTILER_HTTPS=0"
set "QTILER_PUBLIC_URL="
set "QTILER_TRUST_PROXY_VALUE=loopback"
set "QTILER_ENABLE_HSTS_VALUE=0"
set "QTILER_CORS_ALLOWED_ORIGINS_VALUE="
set "QTILER_CORS_ALLOW_CREDENTIALS_VALUE=0"

if /i "%QTILER_INSTALL_MODE%"=="production" (
    echo.
    echo Production profile selected.
    >>"%QTILER_INSTALL_LOG%" echo Production profile selected. Waiting for IIS/HTTPS choice.
    choice /C YN /N /M "Will this production install be published through IIS with HTTPS? [Y/N]: "
    if errorlevel 2 (
        set "QTILER_PUBLIC_URL=http://localhost:%QTILER_PORT%"
    ) else (
        set "QTILER_BEHIND_IIS=1"
        set "QTILER_HTTPS=1"
        set "QTILER_TRUST_PROXY_VALUE=loopback"
        set "QTILER_ENABLE_HSTS_VALUE=1"
        goto ask_public_url
    )
) else (
    set "QTILER_PUBLIC_URL=http://localhost:%QTILER_PORT%"
)
goto install_profile_ok

:gui_profile_values
set "QTILER_BEHIND_IIS=0"
set "QTILER_HTTPS=0"
set "QTILER_TRUST_PROXY_VALUE=loopback"
set "QTILER_ENABLE_HSTS_VALUE=0"
set "QTILER_CORS_ALLOWED_ORIGINS_VALUE="
set "QTILER_CORS_ALLOW_CREDENTIALS_VALUE=0"
if not defined QTILER_PUBLIC_URL set "QTILER_PUBLIC_URL=http://localhost:%QTILER_PORT%"
if /i "%QTILER_INSTALL_MODE%"=="production" if /i not "%QTILER_PUBLIC_URL:~0,16%"=="http://localhost" (
    set "QTILER_BEHIND_IIS=1"
    set "QTILER_HTTPS=1"
    set "QTILER_ENABLE_HSTS_VALUE=1"
    set "QTILER_CORS_ALLOWED_ORIGINS_VALUE=%QTILER_PUBLIC_URL%"
    set "QTILER_CORS_ALLOW_CREDENTIALS_VALUE=1"
)
goto install_profile_ok

:ask_public_url
echo [Qtiler] Waiting for public HTTPS URL input...
>>"%QTILER_INSTALL_LOG%" echo Waiting for public HTTPS URL input dialog.
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::InputBox('Enter the public HTTPS URL that IIS will expose for Qtiler.' + [Environment]::NewLine + [Environment]::NewLine + 'Example: https://qtiler.example.com' + [Environment]::NewLine + [Environment]::NewLine + 'This will be written to PUBLIC_BASE_URL in .env.', 'Qtiler Installer - Public HTTPS URL', 'https://qtiler.example.com')"`) do set "QTILER_PUBLIC_URL=%%I"
if not defined QTILER_PUBLIC_URL (
    echo Installation cancelled by user.
    >>"%QTILER_INSTALL_LOG%" echo Installation cancelled at public HTTPS URL prompt.
    pause
    exit /b 1
)
set "QTILER_PUBLIC_URL=%QTILER_PUBLIC_URL: =%"
set "QTILER_PUBLIC_URL=%QTILER_PUBLIC_URL:"=%"
if /i not "%QTILER_PUBLIC_URL:~0,8%"=="https://" (
    >>"%QTILER_INSTALL_LOG%" echo Invalid public HTTPS URL entered: %QTILER_PUBLIC_URL%.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Production behind IIS with HTTPS requires a public URL starting with https://.' + [Environment]::NewLine + [Environment]::NewLine + 'Please enter the public HTTPS URL, for example https://qtiler.example.com.', 'Qtiler Installer - Invalid Public URL', 'OK', 'Error')" >nul
    goto ask_public_url
)
set "QTILER_CORS_ALLOWED_ORIGINS_VALUE=%QTILER_PUBLIC_URL%"
set "QTILER_CORS_ALLOW_CREDENTIALS_VALUE=1"

:install_profile_ok
echo.
echo Selected installation profile: %QTILER_INSTALL_MODE%
echo Public base URL: %QTILER_PUBLIC_URL%
>>"%QTILER_INSTALL_LOG%" echo Public base URL: %QTILER_PUBLIC_URL%. IIS=%QTILER_BEHIND_IIS%, HTTPS=%QTILER_HTTPS%.
if "%QTILER_BEHIND_IIS%"=="1" echo IIS reverse proxy: yes, HTTPS enabled
if not "%QTILER_BEHIND_IIS%"=="1" echo IIS reverse proxy: no automatic IIS/HTTPS settings
if "%QTILER_BEHIND_IIS%"=="1" (
    echo.
    echo IMPORTANT: IIS URL Rewrite must proxy to this exact local target:
    echo   http://localhost:%QTILER_PORT%/{R:1}
    echo PUBLIC_BASE_URL must remain the public HTTPS URL, not localhost.
)
echo.

REM ----------------------------------------------------------------------
REM  Step 1d: Ask for the initial QtilerAuth admin password
REM ----------------------------------------------------------------------
if exist "%QTILER_ROOT%\.env" (
    for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b /c:"QTILER_DEFAULT_ADMIN_PASSWORD=" "%QTILER_ROOT%\.env" 2^>nul`) do (
        if /i "%%A"=="QTILER_DEFAULT_ADMIN_PASSWORD" set "QTILER_EXISTING_ADMIN_PASSWORD=%%B"
    )
)
if /i "%QTILER_SETUP_MODE%"=="update" if defined QTILER_EXISTING_ADMIN_PASSWORD (
    set "QTILER_ADMIN_PASSWORD_PRESERVE=1"
    set "QTILER_ADMIN_PASSWORD_DISPLAY=preserved from existing .env"
    echo Existing QtilerAuth admin bootstrap password will be preserved from .env.
    >>"%QTILER_INSTALL_LOG%" echo Existing QtilerAuth admin bootstrap password preserved from .env.
    echo.
    goto admin_password_ok
)

:ask_admin_password
if defined QTILER_GUI_CONFIG goto admin_password_ok
echo [Qtiler] Waiting for initial QtilerAuth admin password input...
>>"%QTILER_INSTALL_LOG%" echo Step 1d: waiting for initial QtilerAuth admin password dialogs.
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName Microsoft.VisualBasic; Add-Type -AssemblyName System.Windows.Forms; $pattern='^[A-Za-z0-9._@#+=-]{8,128}$'; while ($true) { $p=[Microsoft.VisualBasic.Interaction]::InputBox('Choose the initial QtilerAuth administrator password.' + [Environment]::NewLine + [Environment]::NewLine + 'Username: admin' + [Environment]::NewLine + 'Allowed characters: letters, numbers, . _ @ # + = -' + [Environment]::NewLine + 'Length: 8-128 characters' + [Environment]::NewLine + [Environment]::NewLine + 'You will see this password again at the end so you can copy and store it.', 'Qtiler Installer - Admin Password', ''); if ([string]::IsNullOrWhiteSpace($p)) { exit 2 }; $c=[Microsoft.VisualBasic.Interaction]::InputBox('Confirm the initial QtilerAuth administrator password.', 'Qtiler Installer - Confirm Admin Password', ''); if ($p -ne $c) { [System.Windows.Forms.MessageBox]::Show('The passwords do not match. Please try again.', 'Qtiler Installer - Password Mismatch', 'OK', 'Error') > $null; continue }; if ($p -notmatch $pattern) { [System.Windows.Forms.MessageBox]::Show('The password must be 8-128 characters and may only contain letters, numbers, . _ @ # + = -', 'Qtiler Installer - Invalid Password', 'OK', 'Error') > $null; continue }; Write-Output $p; exit 0 }"`) do set "QTILER_ADMIN_PASSWORD=%%I"
if not defined QTILER_ADMIN_PASSWORD (
    echo Installation cancelled by user.
    >>"%QTILER_INSTALL_LOG%" echo Installation cancelled at QtilerAuth admin password prompt.
    pause
    exit /b 1
)
set "QTILER_ADMIN_PASSWORD_DISPLAY=%QTILER_ADMIN_PASSWORD%"
echo Initial QtilerAuth admin password selected for username: admin
>>"%QTILER_INSTALL_LOG%" echo Initial QtilerAuth admin password selected for username admin.
echo.

:admin_password_ok

REM Resolve Qt plugin path (qt5 preferred, qt6 fallback)
set "QT_PLUGINS_DIR=%QGIS_PREFIX_DIR%\qtplugins"
if exist "%QGIS_ROOT%\apps\qt5\plugins" set "QT_PLUGINS_DIR=%QGIS_PREFIX_DIR%\qtplugins;%QGIS_ROOT%\apps\qt5\plugins"
if exist "%QGIS_ROOT%\apps\qt6\plugins" set "QT_PLUGINS_DIR=%QGIS_PREFIX_DIR%\qtplugins;%QGIS_ROOT%\apps\qt6\plugins"

REM ----------------------------------------------------------------------
REM  Step 2: Update .env so Qtiler service can locate QGIS at runtime
REM          Preserves existing keys (tuning, secrets, etc.). A timestamped
REM          backup is created before any modification.
REM ----------------------------------------------------------------------
call :write_progress "Writing configuration" 43 "Saving the QGIS, service, port and security settings."
echo [Qtiler] Updating .env (preserving existing values) ...
>>"%QTILER_INSTALL_LOG%" echo Step 2: updating .env.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$envFile = Join-Path '%QTILER_ROOT%' '.env';" ^
  "$qtilerRoot = '%QTILER_ROOT%';" ^
    "$existingEnv = @{};" ^
    "if (Test-Path $envFile) { Get-Content -LiteralPath $envFile | ForEach-Object { $m = [regex]::Match($_, '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$'); if ($m.Success) { $existingEnv[$m.Groups[1].Value] = $m.Groups[2].Value } } };" ^
    "$adminPassword = '%QTILER_ADMIN_PASSWORD%';" ^
    "if ('%QTILER_ADMIN_PASSWORD_PRESERVE%' -eq '1' -and $existingEnv.ContainsKey('QTILER_DEFAULT_ADMIN_PASSWORD')) { $adminPassword = [string]$existingEnv['QTILER_DEFAULT_ADMIN_PASSWORD'] };" ^
    "if ([string]::IsNullOrWhiteSpace($adminPassword)) { Write-Host 'ERROR: QTILER_DEFAULT_ADMIN_PASSWORD is required.'; exit 1 };" ^
  "$nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source; if (-not $nodeExe) { $nodeExe = 'C:\Program Files\nodejs\node.exe' };" ^
                                                                "$q = [char]34; $updates = [ordered]@{ PORT = '%QTILER_PORT%'; QTILER_SERVICE_NAME = '%QTILER_SERVICE_NAME%'; QTILER_INSTALL_MODE = '%QTILER_INSTALL_MODE%'; PUBLIC_BASE_URL = '%QTILER_PUBLIC_URL%'; QTILER_BEHIND_IIS = '%QTILER_BEHIND_IIS%'; QTILER_PUBLIC_HTTPS = '%QTILER_HTTPS%'; QTILER_TRUST_PROXY = '%QTILER_TRUST_PROXY_VALUE%'; QTILER_ENABLE_HSTS = '%QTILER_ENABLE_HSTS_VALUE%'; QTILER_CORS_ALLOWED_ORIGINS = '%QTILER_CORS_ALLOWED_ORIGINS_VALUE%'; QTILER_CORS_ALLOW_CREDENTIALS = '%QTILER_CORS_ALLOW_CREDENTIALS_VALUE%'; QTILER_DEFAULT_ADMIN_PASSWORD = $adminPassword; PYTHON_EXE = '%QGIS_PYTHON_EXE%'; OSGEO4W_BIN = '%QGIS_ROOT%\bin'; QGIS_PREFIX = '%QGIS_PREFIX_DIR%'; QT_PLUGIN_PATH = '%QT_PLUGINS_DIR%'; PYTHONPATH = '%QGIS_PREFIX_DIR%\python'; QTILER_HOME = $qtilerRoot; NODE_EXE = $nodeExe; QUANTIZED_MESH_BUILD_CMD = ($q + '%QGIS_PYTHON_EXE%' + $q + ' ' + $q + (Join-Path $qtilerRoot 'tools\mesh_build.py') + $q); QUANTIZED_MESH_ENGINE_CMD = ($q + $nodeExe + $q + ' ' + $q + (Join-Path $qtilerRoot 'tools\mesh_dem_to_terrain_runner.mjs') + $q); QUANTIZED_MESH_ENGINE_MODULE = (Join-Path $qtilerRoot 'ThirdParty\mesh-dem-to-terrain\dist\index.js') };" ^
  "if (Test-Path $envFile) { $ts = Get-Date -Format 'yyyyMMdd_HHmmss'; Copy-Item $envFile ($envFile + '.bak.' + $ts) -Force; $lines = Get-Content -LiteralPath $envFile } elseif (Test-Path (Join-Path $qtilerRoot '.env.example')) { $lines = Get-Content -LiteralPath (Join-Path $qtilerRoot '.env.example') } else { $lines = @('# Qtiler environment configuration - generated by install.bat') };" ^
  "$out = New-Object System.Collections.Generic.List[string]; $seen = @{};" ^
  "foreach ($line in $lines) { $m = [regex]::Match($line, '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*='); if ($m.Success -and $updates.Contains($m.Groups[1].Value)) { $k = $m.Groups[1].Value; $out.Add($k + '=' + $updates[$k]); $seen[$k] = $true } else { $patched = $line -ireplace [regex]::Escape('C:\Qtiler'), $qtilerRoot; $out.Add($patched) } };" ^
  "foreach ($k in $updates.Keys) { if (-not $seen.ContainsKey($k)) { $out.Add($k + '=' + $updates[$k]) } };" ^
  "Set-Content -LiteralPath $envFile -Value $out -Encoding UTF8"
if errorlevel 1 (
    echo ERROR: failed to update .env.
    >>"%QTILER_INSTALL_LOG%" echo ERROR: failed to update .env.
    pause
    exit /b 1
)
echo .env updated. Existing tuning and secrets preserved.
>>"%QTILER_INSTALL_LOG%" echo .env updated successfully.
echo.
echo Configured in .env:
echo   QTILER_INSTALL_MODE=%QTILER_INSTALL_MODE%
echo   PORT=%QTILER_PORT%
echo   QTILER_SERVICE_NAME=%QTILER_SERVICE_NAME%
echo   PUBLIC_BASE_URL=%QTILER_PUBLIC_URL%
echo   QTILER_BEHIND_IIS=%QTILER_BEHIND_IIS%
echo   QTILER_PUBLIC_HTTPS=%QTILER_HTTPS%
echo   QTILER_TRUST_PROXY=%QTILER_TRUST_PROXY_VALUE%
echo   QTILER_ENABLE_HSTS=%QTILER_ENABLE_HSTS_VALUE%
echo   QTILER_CORS_ALLOWED_ORIGINS=%QTILER_CORS_ALLOWED_ORIGINS_VALUE%
echo   QTILER_DEFAULT_ADMIN_PASSWORD=%QTILER_ADMIN_PASSWORD_DISPLAY%
echo.
echo You can change these values later in %QTILER_ROOT%\.env and restart the selected Qtiler Windows service.
echo Initial QtilerAuth admin username is: admin
echo Initial QtilerAuth admin password is stored in .env as QTILER_DEFAULT_ADMIN_PASSWORD.
echo.

REM ----------------------------------------------------------------------
REM  Step 3: Node.js was checked before QGIS and profile setup
REM ----------------------------------------------------------------------
call :write_progress "Installing dependencies" 58 "Installing the locked production dependency tree with npm ci."
>>"%QTILER_INSTALL_LOG%" echo Step 3: Node.js and npm were checked before interactive setup.
echo Node.js and npm are ready.
echo.

REM ----------------------------------------------------------------------
REM  Step 4: Install Qtiler npm dependencies
REM ----------------------------------------------------------------------
echo [Qtiler] Installing Node.js dependencies ^(npm ci^)...
>>"%QTILER_INSTALL_LOG%" echo Step 4: running npm.cmd ci --omit=dev --no-audit --no-fund.
call npm.cmd ci --omit=dev --no-audit --no-fund
if errorlevel 1 (
    echo ERROR: npm ci failed.
    >>"%QTILER_INSTALL_LOG%" echo ERROR: npm ci failed with exit code %errorlevel%.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('npm ci failed while installing the locked Qtiler dependencies.' + [Environment]::NewLine + [Environment]::NewLine + 'Check the installer log:' + [Environment]::NewLine + '%QTILER_INSTALL_LOG%' + [Environment]::NewLine + [Environment]::NewLine + 'Also verify that package-lock.json is present, internet access works, and antivirus is not blocking npm.', 'Qtiler Installer - Dependency Install Failed', 'OK', 'Error')" >nul
    pause
    exit /b 1
)
>>"%QTILER_INSTALL_LOG%" echo npm ci completed successfully.
echo.

REM ----------------------------------------------------------------------
REM  Step 4b: Apply QtilerAuth licensing policy
REM ----------------------------------------------------------------------
call :write_progress "Preparing QtilerAuth" 69 "Creating or preserving the QtilerAuth trial and license state."
echo [Qtiler] Applying QtilerAuth licensing policy...
>>"%QTILER_INSTALL_LOG%" echo Step 4b: applying QtilerAuth licensing policy.
if not exist data mkdir data >nul 2>&1
for /f "usebackq tokens=1,* delims==" %%A in (`node tools\qtilerauth-install-policy.mjs "%QTILER_ROOT%" "%QTILER_SETUP_MODE%"`) do (
    if /i "%%A"=="QTILERAUTH_EXPECTED" set "QTILERAUTH_EXPECTED=%%B"
    if /i "%%A"=="QTILERAUTH_INSTALL_STATUS" set "QTILERAUTH_INSTALL_STATUS=%%B"
)
if errorlevel 1 (
    echo ERROR: Could not apply QtilerAuth licensing policy.
    >>"%QTILER_INSTALL_LOG%" echo ERROR: could not apply QtilerAuth licensing policy.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('QtilerAuth licensing policy could not be applied.' + [Environment]::NewLine + [Environment]::NewLine + 'The installer stopped to avoid issuing or renewing a trial incorrectly.' + [Environment]::NewLine + [Environment]::NewLine + 'Check the installer log:' + [Environment]::NewLine + '%QTILER_INSTALL_LOG%', 'Qtiler Installer - Licensing Policy Failed', 'OK', 'Error')" >nul
    pause
    exit /b 1
)
if not defined QTILERAUTH_INSTALL_STATUS (
    echo ERROR: QtilerAuth licensing policy did not return a status.
    >>"%QTILER_INSTALL_LOG%" echo ERROR: QtilerAuth licensing policy did not return a status.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('QtilerAuth licensing policy did not return a status.' + [Environment]::NewLine + [Environment]::NewLine + 'The installer stopped to avoid enabling QtilerAuth in an unsafe state.' + [Environment]::NewLine + [Environment]::NewLine + 'Check the installer log:' + [Environment]::NewLine + '%QTILER_INSTALL_LOG%', 'Qtiler Installer - Licensing Policy Failed', 'OK', 'Error')" >nul
    pause
    exit /b 1
)
>>"%QTILER_INSTALL_LOG%" echo QtilerAuth licensing policy applied. Expected=%QTILERAUTH_EXPECTED%, status=%QTILERAUTH_INSTALL_STATUS%.
echo.

REM ----------------------------------------------------------------------
REM  Step 5: Install Qtiler as a Windows service
REM ----------------------------------------------------------------------
call :write_progress "Registering Windows service" 78 "Installing the Qtiler Windows service definition."
echo [Qtiler] Stopping existing Windows service if it is already running...
>>"%QTILER_INSTALL_LOG%" echo Step 5: stopping existing Qtiler Windows service if present. Requested service name: %QTILER_SERVICE_NAME%.
powershell -NoProfile -ExecutionPolicy Bypass -File "%QTILER_ROOT%\tools\qtiler-service.ps1" -Action stop -ServiceName "%QTILER_SERVICE_NAME%"
if errorlevel 1 (
    echo ERROR: Could not stop existing Qtiler Windows service: %QTILER_SERVICE_NAME%
    >>"%QTILER_INSTALL_LOG%" echo ERROR: could not stop existing Qtiler Windows service %QTILER_SERVICE_NAME%.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Could not stop the existing Qtiler Windows service.' + [Environment]::NewLine + [Environment]::NewLine + 'Service: %QTILER_SERVICE_NAME%' + [Environment]::NewLine + [Environment]::NewLine + 'Close applications using Qtiler, check Windows Services, then run the installer again.', 'Qtiler Installer - Service Stop Failed', 'OK', 'Error')" >nul
    pause
    exit /b 1
)
echo.

echo [Qtiler] Removing existing Windows service definition if present...
>>"%QTILER_INSTALL_LOG%" echo Step 5: removing existing Qtiler Windows service definition if present. Requested service name: %QTILER_SERVICE_NAME%.
powershell -NoProfile -ExecutionPolicy Bypass -File "%QTILER_ROOT%\tools\qtiler-service.ps1" -Action exists -ServiceName "%QTILER_SERVICE_NAME%"
if %errorlevel% equ 0 (
    node service\uninstall-service.js
    if errorlevel 1 (
        echo ERROR: Could not remove existing Qtiler Windows service: %QTILER_SERVICE_NAME%
        >>"%QTILER_INSTALL_LOG%" echo ERROR: node service\uninstall-service.js failed.
        powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Could not remove the existing Qtiler Windows service definition.' + [Environment]::NewLine + [Environment]::NewLine + 'Service: %QTILER_SERVICE_NAME%' + [Environment]::NewLine + [Environment]::NewLine + 'Check Windows Services and run the installer again as administrator.', 'Qtiler Installer - Service Removal Failed', 'OK', 'Error')" >nul
        pause
        exit /b 1
    )
    powershell -NoProfile -ExecutionPolicy Bypass -File "%QTILER_ROOT%\tools\qtiler-service.ps1" -Action wait-removed -ServiceName "%QTILER_SERVICE_NAME%"
    if errorlevel 1 (
        echo ERROR: Existing Qtiler Windows service did not uninstall cleanly: %QTILER_SERVICE_NAME%
        >>"%QTILER_INSTALL_LOG%" echo ERROR: existing Qtiler Windows service did not uninstall within timeout.
        powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('The existing Qtiler Windows service did not uninstall within the timeout.' + [Environment]::NewLine + [Environment]::NewLine + 'Service: %QTILER_SERVICE_NAME%' + [Environment]::NewLine + [Environment]::NewLine + 'Check Windows Services, wait a moment, then run the installer again as administrator.', 'Qtiler Installer - Service Removal Timeout', 'OK', 'Error')" >nul
        pause
        exit /b 1
    )
) else (
    echo   No existing Qtiler service definition found.
    >>"%QTILER_INSTALL_LOG%" echo No existing Qtiler service definition found.
)
echo.

echo [Qtiler] Installing Qtiler as a Windows service...
>>"%QTILER_INSTALL_LOG%" echo Step 5: installing Qtiler Windows service as %QTILER_SERVICE_NAME%.
node service\install-service.js
if errorlevel 1 (
    echo ERROR: Windows service installation failed.
    >>"%QTILER_INSTALL_LOG%" echo ERROR: Windows service installation failed.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Windows service installation failed.' + [Environment]::NewLine + [Environment]::NewLine + 'Service: %QTILER_SERVICE_NAME%' + [Environment]::NewLine + [Environment]::NewLine + 'Run the installer as administrator and check that antivirus or Windows policy is not blocking service creation.', 'Qtiler Installer - Service Install Failed', 'OK', 'Error')" >nul
    pause
    exit /b 1
)
>>"%QTILER_INSTALL_LOG%" echo Windows service installation command completed.
echo.

REM ----------------------------------------------------------------------
REM  Step 5b: Start the Windows service and wait until HTTP is really ready
REM ----------------------------------------------------------------------
call :write_progress "Starting Qtiler" 87 "Starting the Windows service and initializing Qtiler."
echo [Qtiler] Starting Windows service...
>>"%QTILER_INSTALL_LOG%" echo Step 5b: starting Qtiler Windows service %QTILER_SERVICE_NAME%.
powershell -NoProfile -ExecutionPolicy Bypass -File "%QTILER_ROOT%\tools\qtiler-service.ps1" -Action start -ServiceName "%QTILER_SERVICE_NAME%"
if errorlevel 1 (
    echo ERROR: Could not start Qtiler Windows service: %QTILER_SERVICE_NAME%
    >>"%QTILER_INSTALL_LOG%" echo ERROR: could not start Qtiler Windows service %QTILER_SERVICE_NAME%.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Could not start the Qtiler Windows service.' + [Environment]::NewLine + [Environment]::NewLine + 'Service: %QTILER_SERVICE_NAME%' + [Environment]::NewLine + [Environment]::NewLine + 'Check Windows Services and the Qtiler logs under:' + [Environment]::NewLine + '%QTILER_ROOT%\logs', 'Qtiler Installer - Service Start Failed', 'OK', 'Error')" >nul
    pause
    exit /b 1
)

echo [Qtiler] Waiting for Qtiler HTTP endpoint to become ready on port %QTILER_PORT%...
call :write_progress "Checking readiness" 94 "Waiting for Qtiler and QtilerAuth to respond on the configured port."
>>"%QTILER_INSTALL_LOG%" echo Step 5b: waiting for HTTP readiness on port %QTILER_PORT%.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$rootUrl = 'http://127.0.0.1:%QTILER_PORT%/';" ^
    "$authUrl = 'http://127.0.0.1:%QTILER_PORT%/auth/login-status';" ^
        "$authExpected = '%QTILERAUTH_EXPECTED%' -eq '1';" ^
  "$deadline = (Get-Date).AddMinutes(2);" ^
    "$rootReady = $false;" ^
        "$authReady = -not $authExpected;" ^
    "$authBody = '{\"username\":\"__bootstrap_probe__\"}';" ^
  "while ((Get-Date) -lt $deadline) {" ^
    "  if (-not $rootReady) {" ^
    "    try {" ^
    "      $resp = Invoke-WebRequest -Uri $rootUrl -UseBasicParsing -TimeoutSec 5 -MaximumRedirection 0 -ErrorAction Stop;" ^
    "      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { $rootReady = $true }" ^
    "    } catch {" ^
    "      $status = $null;" ^
    "      try { $status = [int]$_.Exception.Response.StatusCode } catch {}" ^
    "      if ($status -and $status -ge 200 -and $status -lt 500) { $rootReady = $true }" ^
    "    }" ^
    "  }" ^
    "  if ($authExpected -and $rootReady -and -not $authReady) {" ^
    "    try {" ^
    "      $authResp = Invoke-RestMethod -Uri $authUrl -Method Post -UseBasicParsing -TimeoutSec 5 -ContentType 'application/json' -Body $authBody -ErrorAction Stop;" ^
    "      if ($null -ne $authResp -and $authResp.PSObject.Properties.Name -contains 'requireCaptcha') { $authReady = $true }" ^
    "    } catch {" ^
    "      $authStatus = $null;" ^
    "      try { $authStatus = [int]$_.Exception.Response.StatusCode } catch {}" ^
    "      if ($authStatus -eq 200) { $authReady = $true }" ^
    "    }" ^
    "  }" ^
    "  if ($rootReady -and $authReady) { break }" ^
  "  Start-Sleep -Milliseconds 2000;" ^
  "}" ^
    "if (-not $rootReady) { Write-Host ('ERROR: Qtiler did not become ready at ' + $rootUrl + ' within the timeout.'); exit 1 }" ^
    "if ($authExpected -and -not $authReady) { Write-Host ('ERROR: QtilerAuth did not become ready at ' + $authUrl + ' within the timeout.'); exit 1 }" ^
    "Write-Host ('  Qtiler is responding at ' + $rootUrl);" ^
    "if ($authExpected) { Write-Host ('  QtilerAuth is responding at ' + $authUrl) } else { Write-Host '  QtilerAuth readiness skipped because it is not enabled by the preserved license state.' }"
if errorlevel 1 (
    echo ERROR: Qtiler service started but Qtiler or the expected QtilerAuth endpoint did not become ready in time.
    echo Check logs in %QTILER_ROOT%\logs and Windows Services for %QTILER_SERVICE_NAME% startup details.
    >>"%QTILER_INSTALL_LOG%" echo ERROR: Qtiler service started but HTTP/QtilerAuth readiness failed. QtilerAuth expected=%QTILERAUTH_EXPECTED%.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('The Windows service started, but Qtiler did not become ready in time.' + [Environment]::NewLine + [Environment]::NewLine + 'Service: %QTILER_SERVICE_NAME%' + [Environment]::NewLine + 'Port: %QTILER_PORT%' + [Environment]::NewLine + [Environment]::NewLine + 'Check the installer log and application logs under:' + [Environment]::NewLine + '%QTILER_ROOT%\logs', 'Qtiler Installer - Service Readiness Failed', 'OK', 'Error')" >nul
    pause
    exit /b 1
)
>>"%QTILER_INSTALL_LOG%" echo Qtiler HTTP readiness passed. QtilerAuth expected=%QTILERAUTH_EXPECTED%, status=%QTILERAUTH_INSTALL_STATUS%.
echo.

if /i "%QTILERAUTH_EXPECTED%"=="1" (
    echo [Qtiler] Restarting Windows service so every worker shares the same QtilerAuth session secret...
    >>"%QTILER_INSTALL_LOG%" echo Step 5c: restarting Qtiler Windows service after first QtilerAuth readiness.
    powershell -NoProfile -ExecutionPolicy Bypass -File "%QTILER_ROOT%\tools\qtiler-service.ps1" -Action restart -ServiceName "%QTILER_SERVICE_NAME%"
    if errorlevel 1 (
        echo ERROR: Could not restart Qtiler Windows service after first QtilerAuth readiness: %QTILER_SERVICE_NAME%
        >>"%QTILER_INSTALL_LOG%" echo ERROR: could not restart Qtiler Windows service after first QtilerAuth readiness.
        powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('QtilerAuth became ready, but the Windows service could not be restarted.' + [Environment]::NewLine + [Environment]::NewLine + 'Service: %QTILER_SERVICE_NAME%' + [Environment]::NewLine + [Environment]::NewLine + 'Restart the service once from Windows Services before the first login.', 'Qtiler Installer - Service Restart Failed', 'OK', 'Error')" >nul
        pause
        exit /b 1
    )
    echo [Qtiler] Waiting for Qtiler to become ready again on port %QTILER_PORT%...
    >>"%QTILER_INSTALL_LOG%" echo Step 5c: waiting for HTTP readiness after service restart.
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$rootUrl = 'http://127.0.0.1:%QTILER_PORT%/';" ^
        "$authUrl = 'http://127.0.0.1:%QTILER_PORT%/auth/login-status';" ^
        "$deadline = (Get-Date).AddMinutes(2);" ^
        "$rootReady = $false;" ^
        "$authReady = $false;" ^
        "$authBody = '{\"username\":\"__bootstrap_probe__\"}';" ^
        "while ((Get-Date) -lt $deadline) {" ^
        "  if (-not $rootReady) {" ^
        "    try {" ^
        "      $resp = Invoke-WebRequest -Uri $rootUrl -UseBasicParsing -TimeoutSec 5 -MaximumRedirection 0 -ErrorAction Stop;" ^
        "      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { $rootReady = $true }" ^
        "    } catch {" ^
        "      $status = $null;" ^
        "      try { $status = [int]$_.Exception.Response.StatusCode } catch {}" ^
        "      if ($status -and $status -ge 200 -and $status -lt 500) { $rootReady = $true }" ^
        "    }" ^
        "  }" ^
        "  if ($rootReady -and -not $authReady) {" ^
        "    try {" ^
        "      $authResp = Invoke-RestMethod -Uri $authUrl -Method Post -UseBasicParsing -TimeoutSec 5 -ContentType 'application/json' -Body $authBody -ErrorAction Stop;" ^
        "      if ($null -ne $authResp -and $authResp.PSObject.Properties.Name -contains 'requireCaptcha') { $authReady = $true }" ^
        "    } catch {" ^
        "      $authStatus = $null;" ^
        "      try { $authStatus = [int]$_.Exception.Response.StatusCode } catch {}" ^
        "      if ($authStatus -eq 200) { $authReady = $true }" ^
        "    }" ^
        "  }" ^
        "  if ($rootReady -and $authReady) { break }" ^
        "  Start-Sleep -Milliseconds 2000;" ^
        "}" ^
        "if (-not $rootReady -or -not $authReady) { Write-Host 'ERROR: Qtiler did not become ready again after the service restart.'; exit 1 }" ^
        "Write-Host ('  Qtiler and QtilerAuth are ready after restart at ' + $rootUrl)"
    if errorlevel 1 (
        echo ERROR: Qtiler service restarted but did not become ready again in time.
        >>"%QTILER_INSTALL_LOG%" echo ERROR: Qtiler service restarted but HTTP/QtilerAuth readiness failed.
        powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('The Windows service was restarted, but Qtiler did not become ready again in time.' + [Environment]::NewLine + [Environment]::NewLine + 'Service: %QTILER_SERVICE_NAME%' + [Environment]::NewLine + 'Port: %QTILER_PORT%' + [Environment]::NewLine + [Environment]::NewLine + 'Check Windows Services and logs under:' + [Environment]::NewLine + '%QTILER_ROOT%\logs', 'Qtiler Installer - Service Restart Readiness Failed', 'OK', 'Error')" >nul
        pause
        exit /b 1
    )
    >>"%QTILER_INSTALL_LOG%" echo Qtiler HTTP readiness after restart passed.
    echo.
)

REM ----------------------------------------------------------------------
REM  Step 6: Success notification
REM ----------------------------------------------------------------------
call :write_progress "Completed" 100 "Qtiler is installed and the Windows service is ready."
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Add-Type -AssemblyName System.Windows.Forms;" ^
    "$balloon = [char]::ConvertFromUtf32(0x1F388); $party = [char]::ConvertFromUtf32(0x1F389);" ^
    "$nl = [Environment]::NewLine;" ^
    "$isUpdate = $env:QTILER_SETUP_MODE -ieq 'update';" ^
    "$headline = if ($isUpdate) { 'Qtiler update completed successfully.' } else { 'Qtiler installation completed successfully.' };" ^
    "$versionLine = if ($isUpdate) { 'Updated to version: ' + $env:QTILER_VERSION } else { 'Installed version: ' + $env:QTILER_VERSION };" ^
    "$previousLine = if ($isUpdate -and $env:QTILER_PREVIOUS_VERSION) { 'Previous version: ' + $env:QTILER_PREVIOUS_VERSION + $nl } else { '' };" ^
    "$passwordNote = if ($isUpdate) { 'The existing administrator password was preserved.' } else { 'Store this administrator password now.' };" ^
    "$body = ($balloon + ' ' + $party + ' ' + $balloon + $nl + $nl + $headline + $nl + $versionLine + $nl + $previousLine + $nl + 'Setup mode: ' + $env:QTILER_SETUP_MODE + $nl + 'Configured profile: ' + $env:QTILER_INSTALL_MODE + $nl + 'Windows service: ' + $env:QTILER_SERVICE_NAME + $nl + 'Public URL: ' + $env:QTILER_PUBLIC_URL + $nl + 'Port: ' + $env:QTILER_PORT + $nl + 'IIS / HTTPS: ' + $env:QTILER_BEHIND_IIS + ' / ' + $env:QTILER_HTTPS + $nl + 'QtilerAuth status: ' + $env:QTILERAUTH_INSTALL_STATUS + $nl + $nl + 'Administrator login:' + $nl + 'Username: admin' + $nl + 'Password: ' + $env:QTILER_ADMIN_PASSWORD_DISPLAY + $nl + $nl + $passwordNote + $nl + $nl + 'Updates preserve .env, users, licenses, uploaded projects, cache and plugin user data.' + $nl + 'Bundled Qtiler plugins are updated from the installed package; custom plugins are preserved.' + $nl + 'Updates do not issue or renew QtilerAuth trial licenses.' + $nl + $nl + 'These settings are stored in .env. Restart the selected Windows service after editing .env.' + $nl + $nl + 'For license contract questions about the authentication plugin, contact support@mundogis.se.');" ^
    "[System.Windows.Forms.MessageBox]::Show($body, 'Qtiler Installation Complete', 'OK', 'Information')" >nul

echo ================================================================
if /i "%QTILER_SETUP_MODE%"=="update" (
    echo  Qtiler update completed successfully.
    if defined QTILER_PREVIOUS_VERSION echo  Previous version: %QTILER_PREVIOUS_VERSION%
    echo  Updated to version: %QTILER_VERSION%
) else (
    echo  Qtiler installation completed successfully.
    echo  Installed version: %QTILER_VERSION%
)
echo.
echo  Configuration written to .env:
echo    Setup mode:     %QTILER_SETUP_MODE%
echo    Profile:        %QTILER_INSTALL_MODE%
echo    Service:        %QTILER_SERVICE_NAME%
echo    Public URL:     %QTILER_PUBLIC_URL%
echo    Port:           %QTILER_PORT%
echo    IIS:            %QTILER_BEHIND_IIS%
echo    HTTPS:          %QTILER_HTTPS%
echo    Admin user:     admin
echo    Admin password: %QTILER_ADMIN_PASSWORD_DISPLAY%
echo    QtilerAuth:     %QTILERAUTH_INSTALL_STATUS%
echo.
echo  You can change these settings later in:
echo    %QTILER_ROOT%\.env
echo  Restart the %QTILER_SERVICE_NAME% service after editing .env.
echo.
echo  QtilerAuth policy:
echo    Eligible new installs enable the first 3-month trial.
echo    Updates preserve existing license/trial state and never renew a trial.
echo    If the preserved QtilerAuth license or trial is expired, QtilerAuth stays disabled.
echo    Bundled Qtiler plugins are updated from this package; custom plugins are preserved.
echo  For questions about license contracts for this authentication
echo  plugin, please contact support@mundogis.se.
echo ================================================================
echo.
>>"%QTILER_INSTALL_LOG%" echo Install completed successfully.
endlocal
exit /b 0

:read_gui_setting
set "QTILER_GUI_KEY=%~1"
set "QTILER_GUI_VALUE=%~2"
if /i "%QTILER_GUI_KEY%"=="QTILER_SETUP_MODE" set "QTILER_SETUP_MODE=%QTILER_GUI_VALUE%"
if /i "%QTILER_GUI_KEY%"=="QTILER_INSTALL_MODE" set "QTILER_INSTALL_MODE=%QTILER_GUI_VALUE%"
if /i "%QTILER_GUI_KEY%"=="QTILER_PREVIOUS_ROOT" set "QTILER_PREVIOUS_ROOT=%QTILER_GUI_VALUE%"
if /i "%QTILER_GUI_KEY%"=="QTILER_SERVICE_NAME" set "QTILER_SERVICE_NAME=%QTILER_GUI_VALUE%"
if /i "%QTILER_GUI_KEY%"=="QGIS_ROOT" set "QGIS_ROOT=%QTILER_GUI_VALUE%"
if /i "%QTILER_GUI_KEY%"=="QGIS_PREFIX_DIR" set "QGIS_PREFIX_DIR=%QTILER_GUI_VALUE%"
if /i "%QTILER_GUI_KEY%"=="QGIS_PREFIX" set "QGIS_PREFIX_DIR=%QTILER_GUI_VALUE%"
if /i "%QTILER_GUI_KEY%"=="QGIS_PYTHON_EXE" set "QGIS_PYTHON_EXE=%QTILER_GUI_VALUE%"
if /i "%QTILER_GUI_KEY%"=="PYTHON_EXE" set "QGIS_PYTHON_EXE=%QTILER_GUI_VALUE%"
if /i "%QTILER_GUI_KEY%"=="OSGEO4W_BIN" set "OSGEO4W_BIN=%QTILER_GUI_VALUE%"
if /i "%QTILER_GUI_KEY%"=="QTILER_PORT" set "QTILER_PORT=%QTILER_GUI_VALUE%"
if /i "%QTILER_GUI_KEY%"=="QTILER_PUBLIC_URL" set "QTILER_PUBLIC_URL=%QTILER_GUI_VALUE%"
if /i "%QTILER_GUI_KEY%"=="QTILER_ADMIN_PASSWORD" set "QTILER_ADMIN_PASSWORD=%QTILER_GUI_VALUE%"
if /i "%QTILER_GUI_KEY%"=="QTILER_LICENSE_ACCEPTED" set "QTILER_LICENSE_ACCEPTED=%QTILER_GUI_VALUE%"
exit /b 0

:write_progress
if not defined QTILER_PROGRESS_LOG exit /b 0
>>"%QTILER_PROGRESS_LOG%" echo %~1^|%~2^|%~3
set "QTILER_PROGRESS_LABEL=%~1"
set "QTILER_PROGRESS_VALUE=%~2"
if not defined QTILER_PROGRESS_VALUE set "QTILER_PROGRESS_VALUE=0"
set /a QTILER_PROGRESS_BAR_FILLED=QTILER_PROGRESS_VALUE*20/100
set "QTILER_PROGRESS_BAR="
for /L %%I in (1,1,20) do (
    if %%I LEQ %QTILER_PROGRESS_BAR_FILLED% (
        set "QTILER_PROGRESS_BAR=!QTILER_PROGRESS_BAR!#"
    ) else (
        set "QTILER_PROGRESS_BAR=!QTILER_PROGRESS_BAR!."
    )
)
echo [Qtiler] [%QTILER_PROGRESS_BAR%] %QTILER_PROGRESS_VALUE%%% - %~3
echo %QTILER_PROGRESS_LABEL%: %~3
exit /b 0

:ensure_node
REM ----------------------------------------------------------------------
REM  Ensure Node.js (latest LTS) is installed
REM ----------------------------------------------------------------------
>>"%QTILER_INSTALL_LOG%" echo Checking Node.js and npm.
where node >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('node -v') do set "NODE_VER=%%v"
    echo Node.js detected: !NODE_VER!
    set "NODE_MAJOR=!NODE_VER:v=!"
    for /f "tokens=1 delims=." %%M in ("!NODE_MAJOR!") do set "NODE_MAJOR=%%M"
    set "NODE_MAJOR_INVALID="
    for /f "delims=0123456789" %%M in ("!NODE_MAJOR!") do set "NODE_MAJOR_INVALID=%%M"
    if "!NODE_MAJOR!"=="" set "NODE_MAJOR_INVALID=empty"
    if defined NODE_MAJOR_INVALID (
        echo ERROR: Could not parse Node.js version: !NODE_VER!
        echo Please install the latest Node.js LTS from https://nodejs.org and run install.bat again.
        >>"%QTILER_INSTALL_LOG%" echo ERROR: Could not parse Node.js version: !NODE_VER!
        powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Qtiler could not read the installed Node.js version: !NODE_VER!' + [Environment]::NewLine + [Environment]::NewLine + 'Install or repair the latest Node.js LTS from https://nodejs.org, then run install.bat again.', 'Qtiler Installer - Node.js Error', 'OK', 'Error')" >nul
        exit /b 1
    )
    if !NODE_MAJOR! LSS 20 (
        echo ERROR: Qtiler requires Node.js 20 LTS or newer. Detected: !NODE_VER!
        echo Please install the latest Node.js LTS from https://nodejs.org and run install.bat again.
        >>"%QTILER_INSTALL_LOG%" echo ERROR: Node.js version too old: !NODE_VER!
        powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Qtiler requires Node.js 20 LTS or newer.' + [Environment]::NewLine + [Environment]::NewLine + 'Detected version: !NODE_VER!' + [Environment]::NewLine + [Environment]::NewLine + 'Install the latest Node.js LTS from https://nodejs.org, then run install.bat again.', 'Qtiler Installer - Node.js Too Old', 'OK', 'Error')" >nul
        exit /b 1
    )
) else (
    echo Node.js not found. Downloading the latest LTS installer...
    >>"%QTILER_INSTALL_LOG%" echo Node.js not found. Downloading latest LTS installer.
    set "NODE_MSI=%TEMP%\nodejs_lts_x64.msi"
    if exist "!NODE_MSI!" del /q "!NODE_MSI!" >nul 2>&1
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { $lts = (Invoke-RestMethod 'https://nodejs.org/dist/index.json') | Where-Object { $_.lts } | Select-Object -First 1; $url = 'https://nodejs.org/dist/' + $lts.version + '/node-' + $lts.version + '-x64.msi'; Write-Host ('Downloading ' + $url); Invoke-WebRequest -Uri $url -OutFile '%TEMP%\nodejs_lts_x64.msi' -UseBasicParsing } catch { Write-Host ('ERROR: ' + $_.Exception.Message); exit 1 }"
    if not exist "!NODE_MSI!" (
        echo ERROR: Failed to download Node.js installer. Please install Node.js LTS manually from https://nodejs.org and re-run this installer.
        >>"%QTILER_INSTALL_LOG%" echo ERROR: failed to download Node.js installer.
        powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Qtiler could not download the Node.js LTS installer.' + [Environment]::NewLine + [Environment]::NewLine + 'Check the internet connection or proxy settings, install Node.js LTS manually from https://nodejs.org, then run install.bat again.', 'Qtiler Installer - Node.js Download Failed', 'OK', 'Error')" >nul
        exit /b 1
    )
    echo Installing Node.js silently. This may take a few minutes...
    >>"%QTILER_INSTALL_LOG%" echo Installing Node.js silently from !NODE_MSI!.
    msiexec /i "!NODE_MSI!" /qn /norestart
    if errorlevel 1 (
        echo ERROR: Node.js installation failed ^(msiexec exit code %errorlevel%^).
        >>"%QTILER_INSTALL_LOG%" echo ERROR: Node.js msiexec failed with exit code %errorlevel%.
        powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Node.js installation failed.' + [Environment]::NewLine + [Environment]::NewLine + 'Windows Installer exit code: %errorlevel%' + [Environment]::NewLine + [Environment]::NewLine + 'Install Node.js LTS manually from https://nodejs.org, then run install.bat again.', 'Qtiler Installer - Node.js Install Failed', 'OK', 'Error')" >nul
        exit /b 1
    )
    REM Refresh PATH from registry so node/npm are visible in this shell
    for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%b"
    set "PATH=!SYS_PATH!;%ProgramFiles%\nodejs;%PATH%"
    where node >nul 2>&1
    if errorlevel 1 (
        echo Node.js installed, but not visible in this shell.
        echo Please close this window, open a new one, and run install.bat again.
        >>"%QTILER_INSTALL_LOG%" echo ERROR: Node.js installed but not visible in PATH.
        powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Node.js was installed, but it is not visible in the current PATH.' + [Environment]::NewLine + [Environment]::NewLine + 'Close this installer window, open a new elevated command prompt, and run install.bat again.', 'Qtiler Installer - Node.js PATH Not Updated', 'OK', 'Warning')" >nul
        exit /b 1
    )
    for /f "tokens=*" %%v in ('node -v') do set "NODE_VER=%%v"
    echo Node.js installed: !NODE_VER!
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not available even though Node.js is installed.
    echo Repair or reinstall Node.js LTS, then run install.bat again.
    >>"%QTILER_INSTALL_LOG%" echo ERROR: npm not found after Node.js check.
    powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('npm is not available even though Node.js is installed.' + [Environment]::NewLine + [Environment]::NewLine + 'Repair or reinstall Node.js LTS from https://nodejs.org, then run install.bat again.', 'Qtiler Installer - npm Missing', 'OK', 'Error')" >nul
    exit /b 1
)
for /f "tokens=*" %%v in ('npm.cmd -v') do set "NPM_VER=%%v"
echo npm detected: !NPM_VER!
>>"%QTILER_INSTALL_LOG%" echo Node.js !NODE_VER!, npm !NPM_VER!.
echo.
exit /b 0
