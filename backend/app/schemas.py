import re
from pydantic import BaseModel, field_validator
from datetime import datetime, date, time
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
    birth_date: Optional[date] = None
    location: Optional[str] = None

    @field_validator("birth_date")
    @classmethod
    def birth_date_not_in_future(cls, value):
        if value is not None and value > date.today():
            raise ValueError("Birth date cannot be in the future")
        return value

class AnimalOut(BaseModel):
    id: int
    name: str
    species: str
    sex: str
    birth_date: Optional[date] = None
    age: Optional[int] = None
    location: Optional[str] = None
    owner_id: int
    organization_id: int

    class Config:
        from_attributes = True

class PersonName(BaseModel):
    first_name: str
    last_name: str

    @field_validator("first_name", "last_name")
    @classmethod
    def name_not_blank(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be blank")
        if len(value) > 100:
            raise ValueError("Name is too long")
        return value

def check_password_rules(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters")
    # bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password must be at most 72 bytes")
    return value

def check_email_format(value: str) -> str:
    value = value.strip()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
        raise ValueError("Enter a valid email address")
    return value

class UserCreate(PersonName):
    email: str
    password: str
    organization_name: str

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        return check_email_format(value)

    @field_validator("password")
    @classmethod
    def valid_password(cls, value):
        return check_password_rules(value)

    @field_validator("organization_name")
    @classmethod
    def organization_name_not_blank(cls, value):
        value = " ".join(value.split())
        if not value:
            raise ValueError("Organization name cannot be blank")
        if len(value) > 100:
            raise ValueError("Organization name is too long")
        return value

class ProfileUpdate(PersonName):
    department: Optional[str] = None
    bio: Optional[str] = None

    @field_validator("department", "bio")
    @classmethod
    def blank_to_none_and_limit(cls, value, info):
        if value is None:
            return None
        value = value.strip()
        limit = 100 if info.field_name == "department" else 1000
        if len(value) > limit:
            raise ValueError(f"{info.field_name} must be at most {limit} characters")
        return value or None

class EmailChange(BaseModel):
    email: str
    current_password: str

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        return check_email_format(value)

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def valid_password(cls, value):
        return check_password_rules(value)

class UserLogin(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None
    organization_id: int
    role: str
    status: str
    organization: OrganizationOut

    class Config:
        from_attributes = True

class MemberOut(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str
    status: str

    class Config:
        from_attributes = True

class RoleAssign(BaseModel):
    role: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    version: int = 0

class PlanStepCreate(BaseModel):
    name: str
    description: Optional[str] = None
    order: int
    estimated_sessions: Optional[int] = None
    is_complete: Optional[bool] = False

class PlanStepAdd(BaseModel):
    # Adds a step to an existing plan; it goes at the end, and a blank name becomes "Step N"
    name: Optional[str] = None
    description: Optional[str] = None
    estimated_sessions: Optional[int] = None

    @field_validator("name", "description")
    @classmethod
    def blank_to_none(cls, value):
        if value is None:
            return None
        return value.strip() or None

    @field_validator("estimated_sessions")
    @classmethod
    def at_least_one_session(cls, value):
        if value is not None and value < 1:
            raise ValueError("A step needs at least 1 estimated session")
        return value

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
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    steps: List[PlanStepOut]

    class Config:
        from_attributes = True

class StepSessionNoteCreate(BaseModel):
    note: Optional[str] = None
    session_count: Optional[int] = None
    performed_date: Optional[date] = None
    performed_time: Optional[time] = None

class StepSessionNoteOut(BaseModel):
    id: int
    step_id: int
    timestamp: datetime
    note: Optional[str] = None
    session_count: Optional[int] = None
    performed_date: Optional[date] = None
    performed_time: Optional[time] = None

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
    performed_time: Optional[time] = None