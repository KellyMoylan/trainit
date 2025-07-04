from .database import Base, engine
from . import models
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import auth, plans, animals, plan_steps

Base.metadata.create_all(bind=engine)

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
        "https://www.train-it.app",
        "https://trainit-frontend-szho.onrender.com/",
        "https://train-it.app/",
        "null",  # For file:// protocol
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(plans.router)
app.include_router(animals.router)
app.include_router(plan_steps.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to TrainIt API - Animal Training Plan Tracker"}