@echo off
cd /d "%~dp0"
set "SOLE_PYTHON=%~dp0my_fastapi_service_sole_list\.venv\Scripts\python.exe"
if not exist "%SOLE_PYTHON%" (
  echo Setting up SOLE for this computer...
  where py >nul 2>nul
  if errorlevel 1 (
    python -m venv "%~dp0my_fastapi_service_sole_list\.venv"
  ) else (
    py -3 -m venv "%~dp0my_fastapi_service_sole_list\.venv"
  )
  if errorlevel 1 goto setup_failed
)
"%SOLE_PYTHON%" -c "import uvicorn, fastapi, psycopg, dotenv" >nul 2>nul
if errorlevel 1 (
  "%SOLE_PYTHON%" -m pip install -r "%~dp0requirements.txt"
  if errorlevel 1 goto setup_failed
)
"%SOLE_PYTHON%" "%~dp0start_project.py" --keep-running
if errorlevel 1 goto launch_failed
exit /b 0

:launch_failed
pause
exit /b 1

:setup_failed
echo Setup failed. Install Python 3.12 and check that this computer can download Python packages.
pause
exit /b 1
