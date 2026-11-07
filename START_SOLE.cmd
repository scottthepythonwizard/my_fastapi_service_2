@echo off
cd /d "%~dp0"
set "SOLE_PYTHON=%~dp0my_fastapi_service_sole_list\.venv\Scripts\python.exe"
if not exist "%SOLE_PYTHON%" (
  echo The SOLE Python environment is missing. See README_SUPABASE.md for setup.
  pause
  exit /b 1
)
"%SOLE_PYTHON%" "%~dp0start_project.py" --keep-running
if errorlevel 1 pause
