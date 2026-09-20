from datetime import time
from sqlalchemy import func
from sqlalchemy.orm import Session
from . import models, schemas
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Emails and organization names are compared without regard to case or extra spaces, so
# "Sam@Park.org" and "sam@park.org" are one account and "Coastal  Park" and "coastal park" are one organization
def normalize_email(email: str) -> str:
    return email.strip().lower()

def normalize_organization_name(name: str) -> str:
    return " ".join(name.split())

def get_organization_by_name(db: Session, name: str):
    return db.query(models.Organization).filter(
        func.lower(models.Organization.name) == normalize_organization_name(name).lower()
    ).first()

def create_organization(db: Session, organization: schemas.OrganizationCreate):
    db_organization = models.Organization(**organization.dict())
    db.add(db_organization)
    db.commit()
    db.refresh(db_organization)
    return db_organization

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(func.lower(models.User.email) == normalize_email(email)).first()

def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def create_user(db: Session, user: schemas.UserCreate):
    # Check if organization exists, create if it doesn't
    # The creator of a new organization is its curator; joining an existing one needs approval
    organization = get_organization_by_name(db, user.organization_name)
    if organization:
        role, status = models.ROLE_TRAINER, models.STATUS_PENDING
    else:
        organization = create_organization(db, schemas.OrganizationCreate(name=normalize_organization_name(user.organization_name)))
        role, status = models.ROLE_CURATOR, models.STATUS_ACTIVE

    hashed_pw = pwd_context.hash(user.password)
    db_user = models.User(
        email=normalize_email(user.email),
        first_name=user.first_name,
        last_name=user.last_name,
        hashed_password=hashed_pw,
        organization_id=organization.id,
        role=role,
        status=status
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_profile(db: Session, user: models.User, profile: schemas.ProfileUpdate):
    user.first_name = profile.first_name
    user.last_name = profile.last_name
    user.department = profile.department
    user.bio = profile.bio
    db.commit()
    db.refresh(user)
    return user

def update_email(db: Session, user: models.User, new_email: str):
    user.email = normalize_email(new_email)
    db.commit()
    db.refresh(user)
    return user

def update_password(db: Session, user: models.User, new_password: str):
    user.hashed_password = pwd_context.hash(new_password)
    # Bumping the version makes every token issued before this moment stop working
    user.token_version = (user.token_version or 0) + 1
    db.commit()
    db.refresh(user)
    return user

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def create_animal(db: Session, animal: schemas.AnimalCreate, user_id: int):
    # Get user to get their organization_id
    user = get_user_by_id(db, user_id)
    if not user:
        return None
    
    db_animal = models.Animal(**animal.dict(), owner_id=user_id, organization_id=user.organization_id)
    db.add(db_animal)
    db.commit()
    db.refresh(db_animal)
    return db_animal

def get_user_animals(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    # Get user to get their organization_id
    user = get_user_by_id(db, user_id)
    if not user:
        return []
    
    return db.query(models.Animal).filter(
        models.Animal.organization_id == user.organization_id
    ).offset(skip).limit(limit).all()

def get_animal_by_id(db: Session, animal_id: int, user_id: int):
    # Get user to get their organization_id
    user = get_user_by_id(db, user_id)
    if not user:
        return None
    
    return db.query(models.Animal).filter(
        models.Animal.id == animal_id, 
        models.Animal.organization_id == user.organization_id
    ).first()

def update_animal(db: Session, animal_id: int, user_id: int, animal_update: schemas.AnimalCreate):
    db_animal = get_animal_by_id(db, animal_id, user_id)
    if not db_animal:
        return None
    
    for field, value in animal_update.dict().items():
        setattr(db_animal, field, value)
    
    db.commit()
    db.refresh(db_animal)
    return db_animal

class AnimalHasPlans(Exception):
    def __init__(self, count: int):
        self.count = count

def delete_animal(db: Session, animal_id: int, user_id: int):
    db_animal = get_animal_by_id(db, animal_id, user_id)
    if not db_animal:
        return False

    # Refuse rather than silently deleting a plan's steps and session history along with the animal
    plan_count = db.query(models.TrainingPlan).filter(models.TrainingPlan.animal_id == animal_id).count()
    if plan_count:
        raise AnimalHasPlans(plan_count)

    db.delete(db_animal)
    db.commit()
    return True

def create_log(db: Session, user_id: int, log: schemas.TimeLogCreate):
    # A log may only point at an animal in the user's own organization
    if log.animal_id is not None and not get_animal_by_id(db, log.animal_id, user_id):
        return None
    db_log = models.TimeLog(**log.dict(), user_id=user_id)
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

def get_user_logs(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.TimeLog).filter(models.TimeLog.user_id == user_id).order_by(models.TimeLog.timestamp.desc()).offset(skip).limit(limit).all()

def get_user_stats(db: Session, user_id: int):
    logs = db.query(models.TimeLog).filter(models.TimeLog.user_id == user_id).all()
    total_sessions = len(logs)
    total_time = sum(log.duration for log in logs)
    
    # Calculate this week's time
    from datetime import datetime, timedelta
    week_ago = datetime.utcnow() - timedelta(days=7)
    this_week_logs = db.query(models.TimeLog).filter(
        models.TimeLog.user_id == user_id,
        models.TimeLog.timestamp >= week_ago
    ).all()
    this_week_time = sum(log.duration for log in this_week_logs)
    
    return {
        "total_sessions": total_sessions,
        "total_time": total_time,
        "this_week_time": this_week_time
    }

class PlanEditForbidden(Exception):
    pass

def assert_can_edit_plan(db: Session, plan: models.TrainingPlan, user_id: int):
    # Only a plan's creator, or a supervisor/curator, may change it or anything under it
    user = get_user_by_id(db, user_id)
    if user.id == plan.created_by_id or user.role in (models.ROLE_SUPERVISOR, models.ROLE_CURATOR):
        return
    raise PlanEditForbidden()

def create_plan_with_steps(db: Session, animal_id: int, plan_data: schemas.TrainingPlanCreate, user_id: int):
    # Verify the animal belongs to the user's organization
    animal = get_animal_by_id(db, animal_id, user_id)
    if not animal:
        return None
    
    db_plan = models.TrainingPlan(
        name=plan_data.name,
        description=plan_data.description,
        cue_description=plan_data.cue_description,
        cue_video_url=plan_data.cue_video_url,
        criteria=plan_data.criteria,
        category=plan_data.category,
        started_date=plan_data.started_date,
        animal_id=animal_id,
        created_by_id=user_id
    )
    db.add(db_plan)
    db.flush()  # Get plan id before adding steps
    for step in plan_data.steps:
        db_step = models.PlanStep(
            name=step.name,
            description=step.description,
            order=step.order,
            estimated_sessions=step.estimated_sessions,
            plan_id=db_plan.id,
            is_complete=1 if getattr(step, 'is_complete', False) else 0
        )
        db.add(db_step)
    db.commit()
    db.refresh(db_plan)
    return db_plan

def get_plans_for_animal(db: Session, animal_id: int, user_id: int):
    # Verify the animal belongs to the user's organization
    animal = get_animal_by_id(db, animal_id, user_id)
    if not animal:
        return []
    
    return db.query(models.TrainingPlan).filter(models.TrainingPlan.animal_id == animal_id).all()

def get_plan_with_steps(db: Session, plan_id: int, user_id: int):
    # Get plan and verify the animal belongs to the user's organization
    plan = db.query(models.TrainingPlan).filter(models.TrainingPlan.id == plan_id).first()
    if not plan:
        return None
    
    # Check if the animal belongs to the user's organization
    animal = get_animal_by_id(db, plan.animal_id, user_id)
    if not animal:
        return None
    
    return plan

def add_plan_step(db: Session, plan_id: int, step_data: schemas.PlanStepAdd, user_id: int):
    plan = get_plan_with_steps(db, plan_id, user_id)
    if not plan:
        return None
    assert_can_edit_plan(db, plan, user_id)
    next_order = max((step.order for step in plan.steps), default=0) + 1
    db_step = models.PlanStep(
        name=step_data.name or f"Step {len(plan.steps) + 1}",
        description=step_data.description,
        order=next_order,
        estimated_sessions=step_data.estimated_sessions,
        plan_id=plan.id,
        is_complete=0,
    )
    db.add(db_step)
    db.commit()
    db.refresh(db_step)
    return db_step

def add_step_session_note(db: Session, step_id: int, note_data: schemas.StepSessionNoteCreate, user_id: int):
    # Verify the step belongs to a plan for an animal in the user's organization
    step = db.query(models.PlanStep).filter(models.PlanStep.id == step_id).first()
    if not step:
        return None
    
    plan = db.query(models.TrainingPlan).filter(models.TrainingPlan.id == step.plan_id).first()
    if not plan:
        return None
    
    animal = get_animal_by_id(db, plan.animal_id, user_id)
    if not animal:
        return None
    
    assert_can_edit_plan(db, plan, user_id)
    db_note = models.StepSessionNote(
        step_id=step_id,
        note=note_data.note,
        session_count=note_data.session_count,
        performed_date=note_data.performed_date,
        performed_time=note_data.performed_time
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note

def get_notes_for_step(db: Session, step_id: int, user_id: int):
    # Verify the step belongs to a plan for an animal in the user's organization
    step = db.query(models.PlanStep).filter(models.PlanStep.id == step_id).first()
    if not step:
        return []
    
    plan = db.query(models.TrainingPlan).filter(models.TrainingPlan.id == step.plan_id).first()
    if not plan:
        return []
    
    animal = get_animal_by_id(db, plan.animal_id, user_id)
    if not animal:
        return []
    
    notes = db.query(models.StepSessionNote).filter(models.StepSessionNote.step_id == step_id).all()
    # Chronological by when the session happened, not when the note was typed in; entry time breaks ties
    # Untimed sessions come first within a day, then timed ones by time; entry order breaks any remaining tie
    return sorted(notes, key=lambda n: (
        n.performed_date or n.timestamp.date(),
        n.performed_time is not None,
        n.performed_time or time.min,
        n.timestamp,
        n.id,
    ))

def mark_step_complete(db: Session, step_id: int, user_id: int):
    # Verify the step belongs to a plan for an animal in the user's organization
    step = db.query(models.PlanStep).filter(models.PlanStep.id == step_id).first()
    if not step:
        return None
    
    plan = db.query(models.TrainingPlan).filter(models.TrainingPlan.id == step.plan_id).first()
    if not plan:
        return None
    
    animal = get_animal_by_id(db, plan.animal_id, user_id)
    if not animal:
        return None
    
    assert_can_edit_plan(db, plan, user_id)
    step.is_complete = 1
    db.commit()
    db.refresh(step)
    return step

def update_plan(db: Session, plan_id: int, plan_update: schemas.TrainingPlanUpdate, user_id: int):
    plan = get_plan_with_steps(db, plan_id, user_id)
    if not plan:
        return None
    assert_can_edit_plan(db, plan, user_id)
    for field, value in plan_update.dict(exclude_unset=True).items():
        setattr(plan, field, value)
    db.commit()
    db.refresh(plan)
    return plan

def delete_plan(db: Session, plan_id: int, user_id: int):
    plan = get_plan_with_steps(db, plan_id, user_id)
    if not plan:
        return False
    assert_can_edit_plan(db, plan, user_id)
    db.delete(plan)
    db.commit()
    return True

def update_step(db: Session, step_id: int, step_update: schemas.PlanStepUpdate, user_id: int):
    # Verify the step belongs to a plan for an animal in the user's organization
    step = db.query(models.PlanStep).filter(models.PlanStep.id == step_id).first()
    if not step:
        return None
    
    plan = db.query(models.TrainingPlan).filter(models.TrainingPlan.id == step.plan_id).first()
    if not plan:
        return None
    
    animal = get_animal_by_id(db, plan.animal_id, user_id)
    if not animal:
        return None
    
    assert_can_edit_plan(db, plan, user_id)
    for field, value in step_update.dict(exclude_unset=True).items():
        if field == "is_complete":
            # The column is an integer flag; PostgreSQL refuses a true/false value there even though SQLite accepts it
            value = 1 if value else 0
        setattr(step, field, value)
    db.commit()
    db.refresh(step)
    return step

def delete_step(db: Session, step_id: int, user_id: int):
    # Verify the step belongs to a plan for an animal in the user's organization
    step = db.query(models.PlanStep).filter(models.PlanStep.id == step_id).first()
    if not step:
        return False
    
    plan = db.query(models.TrainingPlan).filter(models.TrainingPlan.id == step.plan_id).first()
    if not plan:
        return False
    
    animal = get_animal_by_id(db, plan.animal_id, user_id)
    if not animal:
        return False
    
    assert_can_edit_plan(db, plan, user_id)
    db.delete(step)
    db.commit()
    return True

def update_session_note(db: Session, note_id: int, note_update: schemas.StepSessionNoteUpdate, user_id: int):
    # Verify the note belongs to a step for a plan for an animal in the user's organization
    note = db.query(models.StepSessionNote).filter(models.StepSessionNote.id == note_id).first()
    if not note:
        return None
    
    step = db.query(models.PlanStep).filter(models.PlanStep.id == note.step_id).first()
    if not step:
        return None
    
    plan = db.query(models.TrainingPlan).filter(models.TrainingPlan.id == step.plan_id).first()
    if not plan:
        return None
    
    animal = get_animal_by_id(db, plan.animal_id, user_id)
    if not animal:
        return None
    
    assert_can_edit_plan(db, plan, user_id)
    for field, value in note_update.dict(exclude_unset=True).items():
        setattr(note, field, value)
    db.commit()
    db.refresh(note)
    return note

def delete_session_note(db: Session, note_id: int, user_id: int):
    # Verify the note belongs to a step for a plan for an animal in the user's organization
    note = db.query(models.StepSessionNote).filter(models.StepSessionNote.id == note_id).first()
    if not note:
        return False
    
    step = db.query(models.PlanStep).filter(models.PlanStep.id == note.step_id).first()
    if not step:
        return False
    
    plan = db.query(models.TrainingPlan).filter(models.TrainingPlan.id == step.plan_id).first()
    if not plan:
        return False
    
    animal = get_animal_by_id(db, plan.animal_id, user_id)
    if not animal:
        return False
    
    assert_can_edit_plan(db, plan, user_id)
    db.delete(note)
    db.commit()
    return True