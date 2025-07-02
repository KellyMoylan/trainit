@echo off
echo Starting TrainIt Application...
echo.

echo Starting Backend Server...
start "TrainIt Backend" cmd /k "python run_backend.py"

echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak > nul

echo Starting Frontend Server...
start "TrainIt Frontend" cmd /k "python serve_frontend.py"

echo.
echo Both servers are starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit this launcher...
pause > nul 