from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Date, Time, Text
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime, date

def age_in_years(birth_date: date, today: date = None) -> int:
    today = today or date.today()
    had_birthday = (today.month, today.day) >= (birth_date.month, birth_date.day)
    return max(today.year - birth_date.year - (0 if had_birthday else 1), 0)

ROLE_TRAINER = "trainer"
ROLE_SUPERVISOR = "supervisor"
ROLE_CURATOR = "curator"
ROLE_RANK = {ROLE_TRAINER: 1, ROLE_SUPERVISOR: 2, ROLE_CURATOR: 3}

STATUS_ACTIVE = "active"
STATUS_PENDING = "pending"
STATUS_REMOVED = "removed"  # Access ended by a curator; everything the person created is kept

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
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    department = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    role = Column(String, nullable=False, default=ROLE_TRAINER)
    status = Column(String, nullable=False, default=STATUS_ACTIVE)
    token_version = Column(Integer, nullable=False, default=0)
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
    legacy_age = Column("age", Integer, nullable=True)  # Fixed age from before birth dates; used only when birth_date is empty
    birth_date = Column(Date, nullable=True)
    location = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    owner = relationship("User", back_populates="animals")
    organization = relationship("Organization", back_populates="animals")
    logs = relationship("TimeLog", back_populates="animal")
    plans = relationship("TrainingPlan", back_populates="animal")

    @property
    def age(self):
        if self.birth_date:
            return age_in_years(self.birth_date)
        return self.legacy_age

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
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    animal = relationship("Animal", back_populates="plans")
    created_by = relationship("User", foreign_keys=[created_by_id])
    steps = relationship("PlanStep", back_populates="plan", cascade="all, delete-orphan", order_by="PlanStep.order, PlanStep.id")

    @property
    def created_by_name(self):
        creator = self.created_by
        if creator is None:
            return None
        name = f"{creator.first_name or ''} {creator.last_name or ''}".strip()
        return name or creator.email

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
    performed_time = Column(Time, nullable=True)  # Empty on sessions logged before times existed
    step = relationship("PlanStep", back_populates="session_notes")