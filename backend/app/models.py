from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Date, Text
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    users = relationship("User", back_populates="organization")
    animals = relationship("Animal", back_populates="organization")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    organization = relationship("Organization", back_populates="users")
    logs = relationship("TimeLog", back_populates="user")
    animals = relationship("Animal", back_populates="owner")

class Animal(Base):
    __tablename__ = "animals"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    species = Column(String, nullable=False)
    sex = Column(String, nullable=False)  # Male, Female, Unknown
    age = Column(Integer, nullable=True)  # Age in years
    location = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    owner = relationship("User", back_populates="animals")
    organization = relationship("Organization", back_populates="animals")
    logs = relationship("TimeLog", back_populates="animal")
    plans = relationship("TrainingPlan", back_populates="animal")

class TrainingPlan(Base):
    __tablename__ = "training_plans"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    cue_description = Column(Text, nullable=True)
    cue_video_url = Column(String, nullable=True)
    criteria = Column(Text, nullable=True)
    category = Column(String, nullable=True)
    started_date = Column(Date, nullable=True)
    animal_id = Column(Integer, ForeignKey("animals.id"), nullable=False)
    animal = relationship("Animal", back_populates="plans")
    steps = relationship("PlanStep", back_populates="plan", cascade="all, delete-orphan")

class PlanStep(Base):
    __tablename__ = "plan_steps"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    order = Column(Integer, nullable=False)
    estimated_sessions = Column(Integer, nullable=True)
    plan_id = Column(Integer, ForeignKey("training_plans.id"), nullable=False)
    plan = relationship("TrainingPlan", back_populates="steps")
    session_notes = relationship("StepSessionNote", back_populates="step", cascade="all, delete-orphan")
    is_complete = Column(Integer, default=0)  # 0 = not complete, 1 = complete

class TimeLog(Base):
    __tablename__ = "timelogs"
    id = Column(Integer, primary_key=True, index=True)
    duration = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)
    notes = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    animal_id = Column(Integer, ForeignKey("animals.id"), nullable=True)
    user = relationship("User", back_populates="logs")
    animal = relationship("Animal", back_populates="logs")

class StepSessionNote(Base):
    __tablename__ = "step_session_notes"
    id = Column(Integer, primary_key=True, index=True)
    step_id = Column(Integer, ForeignKey("plan_steps.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    note = Column(Text, nullable=True)
    session_count = Column(Integer, nullable=True)
    performed_date = Column(Date, nullable=True)
    step = relationship("PlanStep", back_populates="session_notes")