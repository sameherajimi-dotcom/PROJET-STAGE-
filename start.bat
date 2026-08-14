
@echo off
setlocal EnableExtensions

REM ================================================================
REM
REM              VALEO - INTELLIGENT CAMERA SYSTEM
REM                  Project Startup Script
REM
REM ================================================================
REM
REM Creators:
REM - Iyed Tababi
REM - [Creator 2]
REM - [Creator 3]
REM
REM Platform:
REM - Node.js
REM - Python AI
REM - Roboflow
REM
REM ================================================================


REM ================================================================
REM ===================== ROBOFLOW API KEY =========================
REM ================================================================

set "VALEO_ROBOFLOW_API_KEY=dQudu2taTYXhZN8DmqZo"

set "VALEO_ROBOFLOW_SECOND_API_KEY=KeCJQZgmePtugUhbMNTC"


REM ================================================================
REM ========================== HEADER ===============================
REM ================================================================

color 0B
cls

echo.
echo ======================================================
echo.
echo              VALEO INTELLIGENT CAMERA
echo              AI Vision Control System
echo.
echo ======================================================
echo.
echo  Project : Industrial Camera Detection
echo  Platform: Node.js + Python AI
echo.
echo  Creators:
echo     - Iyed Tababi
echo     - [Creator 2]
echo     - [Creator 3]
echo.
echo ======================================================
echo.


REM ================================================================
REM =================== PROJECT DIRECTORIES ========================
REM ================================================================

set "SCRIPT_DIR=%~dp0"
set "SERVER_DIR=%SCRIPT_DIR%server"
set "VENV=%SCRIPT_DIR%.venv"
set "VALEO_PYTHON=%VENV%\Scripts\python.exe"


REM ================================================================
REM ===================== 1 - NODE.JS CHECK ========================
REM ================================================================

echo [1/6] Checking Node.js...
echo.

where node >nul 2>&1

if errorlevel 1 (
    color 0C
    echo ERROR: Node.js is not installed.
    echo.
    echo Please install Node.js and try again.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%i in ('node -v') do set "NODE_VERSION=%%i"

echo Node.js detected: %NODE_VERSION%
echo.


REM ================================================================
REM ====================== 2 - NPM CHECK ===========================
REM ================================================================

echo [2/6] Checking npm...
echo.

where npm >nul 2>&1

if errorlevel 1 (
    color 0C
    echo ERROR: npm is not installed.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%i in ('npm -v') do set "NPM_VERSION=%%i"

echo npm detected: %NPM_VERSION%
echo.


REM ================================================================
REM ================= 3 - SERVER DIRECTORY =========================
REM ================================================================

echo [3/6] Searching server directory...
echo.

if not exist "%SERVER_DIR%" (
    color 0C
    echo ERROR: Server directory not found.
    echo.
    echo Expected directory:
    echo %SERVER_DIR%
    echo.
    pause
    exit /b 1
)

cd /d "%SERVER_DIR%"

echo Server directory ready.
echo.
echo Location:
echo %SERVER_DIR%
echo.


REM ================================================================
REM ================= 4 - NODE DEPENDENCIES ========================
REM ================================================================

echo [4/6] Checking Node dependencies...
echo.

if not exist "%SERVER_DIR%\node_modules" (

    echo node_modules not found.
    echo Installing npm packages...
    echo.

    call npm install

    if errorlevel 1 (
        color 0C
        echo.
        echo ERROR: npm installation failed.
        echo.
        pause
        exit /b 1
    )

    echo.
    echo npm packages installed successfully.
)

echo.
echo Node dependencies ready.
echo.


REM ================================================================
REM =================== 5 - PYTHON CHECK ===========================
REM ================================================================

echo [5/6] Preparing Python AI environment...
echo.

where python >nul 2>&1

if errorlevel 1 (
    color 0C
    echo ERROR: Python is not installed.
    echo.
    echo Please install Python 3 and try again.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%i in ('python --version') do set "PYTHON_VERSION=%%i"

echo Python detected: %PYTHON_VERSION%
echo.


REM ================================================================
REM ================= CREATE VIRTUAL ENVIRONMENT ===================
REM ================================================================

if not exist "%VENV%\Scripts\python.exe" (

    echo Python virtual environment not found.
    echo Creating Python environment...
    echo.

    python -m venv "%VENV%"

    if errorlevel 1 (
        color 0C
        echo.
        echo ERROR: Could not create Python virtual environment.
        echo.
        pause
        exit /b 1
    )

    echo.
    echo Python environment created successfully.
)

echo.
echo Python environment ready.
echo.


REM ================================================================
REM ======================= UPDATE PIP =============================
REM ================================================================

echo Updating pip...
echo.

"%VENV%\Scripts\python.exe" -m pip install --upgrade pip

if errorlevel 1 (
    color 0C
    echo.
    echo ERROR: Could not update pip.
    echo.
    pause
    exit /b 1
)

echo.
echo pip updated successfully.
echo.


REM ================================================================
REM ==================== ROBOFLOW SDK CHECK ========================
REM ================================================================

echo Checking Roboflow Inference SDK...
echo.

"%VENV%\Scripts\python.exe" -c "import inference_sdk" >nul 2>&1

if %ERRORLEVEL% EQU 0 (

    echo Inference SDK already installed.

) else (

    echo Roboflow Inference SDK not found.
    echo Installing inference-sdk...
    echo.

    "%VENV%\Scripts\python.exe" -m pip install -U inference-sdk

    if errorlevel 1 (
        color 0C
        echo.
        echo ERROR: Inference SDK installation failed.
        echo.
        pause
        exit /b 1
    )

    echo.
    echo Inference SDK installed successfully.
)

echo.
echo AI environment ready.
echo.


REM ================================================================
REM ==================== ROBOFLOW API CHECK ========================
REM ================================================================

echo Checking Roboflow API configuration...
echo.

if "%VALEO_ROBOFLOW_API_KEY%"=="" (
    color 0C
    echo ERROR: Roboflow API key is missing.
    echo.
    pause
    exit /b 1
)

if "%VALEO_ROBOFLOW_SECOND_API_KEY%"=="" (
    color 0C
    echo ERROR: Second Roboflow API key is missing.
    echo.
    pause
    exit /b 1
)

echo Roboflow API key detected.
echo.


REM ================================================================
REM ====================== 6 - START SERVER =========================
REM ================================================================

color 0B

echo.
echo ======================================================
echo.
echo              STARTING VALEO SERVER
echo.
echo ======================================================
echo.
echo  URL          : http://localhost:3000
echo  Access       : Login required (code + password)
echo.
echo  Roboflow AI  : Connected
echo.
echo  Python       : %VALEO_PYTHON%
echo.
echo  Press CTRL+C to stop the server
echo.
echo ======================================================
echo.


REM ================================================================
REM ======================= START SERVER ===========================
REM ================================================================

node server.js


REM ================================================================
REM ========================= SERVER STOP ==========================
REM ================================================================

echo.
echo.
echo ======================================================
echo              VALEO SERVER STOPPED
echo ======================================================
echo.

pause

endlocal
