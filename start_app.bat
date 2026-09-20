@echo off
echo Starting TrainIt for local development...
echo.

echo Starting backend (database file: local.db)...
start "TrainIt Backend" cmd /k "set DATABASE_URL=sqlite:///./local.db&& python run_backend.py"

echo Starting frontend...
start "TrainIt Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Backend:  http://localhost:8000  (API docs at /docs)
echo Frontend: http://localhost:5173
echo.
echo First time? Run these once first:
echo   pip install -r backend/requirements.txt
echo   cd frontend ^&^& npm install
echo.
echo Press any key to close this launcher (the two servers keep running)...
pause > nul
