from sqlalchemy.orm import Session
from . import models, schemas
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_organization_by_name(db: Session, name: str):
    return db.query(models.Organization).filter(models.Organization.name == name).first()

def create_organization(db: Session, organization: schemas.OrganizationCreate):
    db_organization = models.Organization(**organization.dict())
    db.add(db_organization)
    db.commit()
    db.refresh(db_organization)
    return db_organization

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def create_user(db: Session, user: schemas.UserCreate):
    # Check if organization exists, create if it doesn't
    organization = get_organization_by_name(db, user.organization_name)
    if not organization:
        organization = create_organization(db, schemas.OrganizationCreate(name=user.organization_name))
    
    hashed_pw = pwd_context.hash(user.password)
    db_user = models.User(
        email=user.email, 
        hashed_password=hashed_pw,
        organization_id=organization.id
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

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

def delete_animal(db: Session, animal_id: int, user_id: int):
    db_animal = get_animal_by_id(db, animal_id, user_id)
    if not db_animal:
        return False
    
    db.delete(db_animal)
    db.commit()
    return True

def create_log(db: Session, user_id: int, log: schemas.TimeLogCreate):
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

def create_plan_with_steps(db: Session, animal_id: int, plan_data: schemas.TrainingPlanCreate, user_id: int):
    # Verify the animal belongs to the user's organization
    animal = get_animal_by_id(db, animal_id, user_id)
    if not animal:
        return None
    
    db_plan = models.TrainingPlan(
        name=plan_data.name,
        description=plan_data.description,
        animal_id=animal_id
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
    
    db_note = models.StepSessionNote(
        step_id=step_id,
        note=note_data.note,
        session_count=note_data.session_count,
        performed_date=note_data.performed_date
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
    
    return db.query(models.StepSessionNote).filter(models.StepSessionNote.step_id == step_id).order_by(models.StepSessionNote.timestamp.asc()).all()

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
    
    step.is_complete = 1
    db.commit()
    db.refresh(step)
    return step

def update_plan(db: Session, plan_id: int, plan_update: schemas.TrainingPlanUpdate, user_id: int):
    plan = get_plan_with_steps(db, plan_id, user_id)
    if not plan:
        return None
    for field, value in plan_update.dict(exclude_unset=True).items():
        setattr(plan, field, value)
    db.commit()
    db.refresh(plan)
    return plan

def delete_plan(db: Session, plan_id: int, user_id: int):
    plan = get_plan_with_steps(db, plan_id, user_id)
    if not plan:
        return False
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
    
    for field, value in step_update.dict(exclude_unset=True).items():
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
    
    db.delete(note)
    db.commit()
    return True