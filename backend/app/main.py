from .database import Base, engine, run_migrations
from . import models, crud
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from .routes import auth, plans, animals, plan_steps, team, options

# Each step announces itself, so a stuck start shows in the log exactly where it stopped
print("Startup: creating tables", flush=True)
Base.metadata.create_all(bind=engine)
print("Startup: running migrations", flush=True)
run_migrations()
print("Startup: building organization lists", flush=True)
crud.backfill_organization_options()
print("Startup: done", flush=True)

app = FastAPI(title="TrainIt API", description="Animal Training Plan Tracker", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
        # Origins never end in a slash; a trailing one would stop these from ever matching
        "https://www.train-it.app",
        "https://train-it.app",
        "https://trainit-frontend-szho.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(plans.router)
app.include_router(animals.router)
app.include_router(plan_steps.router)
app.include_router(team.router)
app.include_router(options.router)

@app.exception_handler(crud.OptionError)
def option_error_handler(request: Request, exc: crud.OptionError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

@app.exception_handler(crud.PlanEditForbidden)
def plan_edit_forbidden_handler(request: Request, exc: crud.PlanEditForbidden):
    return JSONResponse(
        status_code=403,
        content={"detail": "Only the plan's creator, a supervisor or a curator can change this plan"},
    )

@app.get("/")
def read_root():
    return {"message": "Welcome to TrainIt API - Animal Training Plan Tracker"}