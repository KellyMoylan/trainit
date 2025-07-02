from pydantic import BaseModel
from datetime import datetime, date
from typing import List, Optional

class OrganizationCreate(BaseModel):
    name: str
    description: Optional[str] = None

class OrganizationOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TimeLogCreate(BaseModel):
    duration: float
    notes: Optional[str] = None
    animal_id: Optional[int] = None

class TimeLogOut(BaseModel):
    id: int
    duration: float
    timestamp: datetime
    notes: Optional[str] = None
    animal_id: Optional[int] = None

    class Config:
        from_attributes = True

class AnimalCreate(BaseModel):
    name: str
    species: str
    sex: str
    age: Optional[int] = None
    location: Optional[str] = None

class AnimalOut(BaseModel):
    id: int
    name: str
    species: str
    sex: str
    age: Optional[int] = None
    location: Optional[str] = None
    owner_id: int
    organization_id: int

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    email: str
    password: str
    organization_name: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    organization_id: int
    organization: OrganizationOut

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class PlanStepCreate(BaseModel):
    name: str
    description: Optional[str] = None
    order: int
    estimated_sessions: Optional[int] = None
    is_complete: Optional[bool] = False

class PlanStepOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    order: int
    estimated_sessions: Optional[int] = None
    is_complete: bool

    class Config:
        from_attributes = True

class TrainingPlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    cue_description: Optional[str] = None
    cue_video_url: Optional[str] = None
    criteria: Optional[str] = None
    category: Optional[str] = None
    started_date: Optional[date] = None
    steps: List[PlanStepCreate]

class TrainingPlanOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    cue_description: Optional[str] = None
    cue_video_url: Optional[str] = None
    criteria: Optional[str] = None
    category: Optional[str] = None
    started_date: Optional[date] = None
    animal_id: int
    steps: List[PlanStepOut]

    class Config:
        from_attributes = True

class StepSessionNoteCreate(BaseModel):
    note: Optional[str] = None
    session_count: Optional[int] = None
    performed_date: Optional[date] = None

class StepSessionNoteOut(BaseModel):
    id: int
    step_id: int
    timestamp: datetime
    note: Optional[str] = None
    session_count: Optional[int] = None
    performed_date: Optional[date] = None

    class Config:
        from_attributes = True

class TrainingPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cue_description: Optional[str] = None
    cue_video_url: Optional[str] = None
    criteria: Optional[str] = None
    category: Optional[str] = None
    started_date: Optional[date] = None

class PlanStepUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    estimated_sessions: Optional[int] = None
    is_complete: Optional[bool] = None

class StepSessionNoteUpdate(BaseModel):
    note: Optional[str] = None
    session_count: Optional[int] = None
    performed_date: Optional[date] = None