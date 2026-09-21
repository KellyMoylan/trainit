from collections import Counter
from datetime import datetime, time
from typing import Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from . import models, schemas
from .database import SessionLocal
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
    # A new organization starts with the standard species so animals can be added straight away; locations start empty
    for name in DEFAULT_SPECIES:
        db.add(models.OrganizationOption(organization_id=db_organization.id, kind=models.OPTION_SPECIES, name=name))
    db.commit()
    return db_organization

# ---- Each organization's own lists of locations and species ----
# Animals keep the name as text, and every path that writes it goes through the list, so one place can't
# end up as "Lagoon A" and "Lagon A". Comparisons ignore case and extra spaces.

DEFAULT_SPECIES = [
    "Beluga Whale", "Bottle Nose Dolphin", "Common Dolphin", "Pacific White-sided Dolphin",
    "False Killer Whale", "Killer Whale", "Black Sea Dolphin", "Manatee", "California Sea Lion",
    "Sea Otter", "Harbor Seal", "Fur Seal", "Grey Seal", "Northern Elephant Seal", "Walrus",
]

class OptionError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code

def option_key(value):
    return " ".join((value or "").split()).lower()

def _org_animals(db: Session, organization_id: int):
    return db.query(models.Animal).filter(models.Animal.organization_id == organization_id).all()

def _options(db: Session, organization_id: int, kind: str):
    rows = db.query(models.OrganizationOption).filter(
        models.OrganizationOption.organization_id == organization_id,
        models.OrganizationOption.kind == kind,
    ).all()
    return sorted(rows, key=lambda option: option_key(option.name))

def _find_option(db: Session, organization_id: int, kind: str, name: str):
    key = option_key(name)
    return next((option for option in _options(db, organization_id, kind) if option_key(option.name) == key), None)

def _get_option(db: Session, organization_id: int, kind: str, option_id: int):
    option = db.query(models.OrganizationOption).filter(
        models.OrganizationOption.id == option_id,
        models.OrganizationOption.organization_id == organization_id,
        models.OrganizationOption.kind == kind,
    ).first()
    if not option:
        raise OptionError("Not found", 404)
    return option

def list_options(db: Session, organization_id: int, kind: str):
    in_use = Counter(option_key(getattr(animal, kind)) for animal in _org_animals(db, organization_id))
    return [
        {"id": option.id, "name": option.name, "animal_count": in_use[option_key(option.name)]}
        for option in _options(db, organization_id, kind)
    ]

def add_option(db: Session, organization_id: int, kind: str, name: str):
    existing = _find_option(db, organization_id, kind, name)
    if existing:
        raise OptionError(f'"{existing.name}" is already in the list', 409)
    option = models.OrganizationOption(organization_id=organization_id, kind=kind, name=name)
    db.add(option)
    db.commit()
    db.refresh(option)
    return option

def rename_option(db: Session, organization_id: int, kind: str, option_id: int, name: str):
    option = _get_option(db, organization_id, kind, option_id)
    clash = _find_option(db, organization_id, kind, name)
    if clash and clash.id != option.id:
        raise OptionError(f'"{clash.name}" already exists. To combine the two, delete one and move its animals to the other.', 409)
    old_key = option_key(option.name)
    for animal in _org_animals(db, organization_id):
        if option_key(getattr(animal, kind)) == old_key:
            setattr(animal, kind, name)
    option.name = name
    db.commit()
    db.refresh(option)
    return option

def delete_option(db: Session, organization_id: int, kind: str, option_id: int, move_to_id: Optional[int] = None, unassign: bool = False):
    """Animals using the entry have to go somewhere: another entry (move_to_id), or, for locations, nowhere (unassign)."""
    option = _get_option(db, organization_id, kind, option_id)
    key = option_key(option.name)
    users = [animal for animal in _org_animals(db, organization_id) if option_key(getattr(animal, kind)) == key]
    if users:
        plural = "s" if len(users) != 1 else ""
        if unassign and kind == models.OPTION_LOCATION:
            new_value = None
        elif move_to_id is not None:
            target = _get_option(db, organization_id, kind, move_to_id)
            if target.id == option.id:
                raise OptionError(f"Choose a different {kind} to move the animals to")
            new_value = target.name
        else:
            raise OptionError(f"{len(users)} animal{plural} use this {kind}. Choose where to move them first.", 409)
        for animal in users:
            setattr(animal, kind, new_value)
    db.delete(option)
    db.commit()

def resolve_animal_choices(db: Session, organization_id: int, species: str, location: Optional[str]):
    """The organization's spelling of an animal's species and location, or an error if it isn't in the lists."""
    species_option = _find_option(db, organization_id, models.OPTION_SPECIES, species)
    if not species_option:
        raise OptionError(f'"{species.strip()}" is not in your species list. A supervisor can add it under Locations and species.', 422)
    location_name = None
    if location and location.strip():
        location_option = _find_option(db, organization_id, models.OPTION_LOCATION, location)
        if not location_option:
            raise OptionError(f'"{location.strip()}" is not in your location list. A supervisor can add it under Locations and species.', 422)
        location_name = location_option.name
    return species_option.name, location_name

def backfill_organization_options():
    """One time, when the lists first exist: build each organization's lists from its animals. Spellings that
    differ only by case or spacing are merged into the most common one, and the animals are updated to match."""
    db = SessionLocal()
    try:
        if db.query(models.OrganizationOption).first() is not None:
            return
        for organization in db.query(models.Organization).all():
            animals = _org_animals(db, organization.id)
            for kind, defaults in ((models.OPTION_SPECIES, DEFAULT_SPECIES), (models.OPTION_LOCATION, [])):
                names = {option_key(name): name for name in defaults}
                spellings = {}
                for animal in animals:
                    value = " ".join((getattr(animal, kind) or "").split())
                    if value:
                        spellings.setdefault(option_key(value), Counter())[value] += 1
                for key, votes in spellings.items():
                    if key not in names:
                        names[key] = sorted(votes.items(), key=lambda item: (-item[1], item[0]))[0][0]
                for animal in animals:
                    key = option_key(getattr(animal, kind))
                    if key:
                        setattr(animal, kind, names[key])
                    elif kind == models.OPTION_LOCATION:
                        animal.location = None
                for name in names.values():
                    db.add(models.OrganizationOption(organization_id=organization.id, kind=kind, name=name))
        db.commit()
    finally:
        db.close()

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
    
    fields = animal.dict()
    fields["species"], fields["location"] = resolve_animal_choices(db, user.organization_id, animal.species, animal.location)
    db_animal = models.Animal(**fields, owner_id=user_id, organization_id=user.organization_id)
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
    
    fields = animal_update.dict()
    fields["species"], fields["location"] = resolve_animal_choices(db, db_animal.organization_id, animal_update.species, animal_update.location)
    for field, value in fields.items():
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

# ---- Comments on a step ----
# Supervisors and curators (the routes require it) can comment on any step in their organization, including
# on plans they didn't create. Everyone in the organization can read them. Only the author edits a comment.

class CommentForbidden(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message

def _step_in_organization(db: Session, step_id: int, user_id: int):
    step = db.query(models.PlanStep).filter(models.PlanStep.id == step_id).first()
    if not step:
        return None
    # A step belongs to a plan, which belongs to an animal, which belongs to an organization
    return step if get_animal_by_id(db, step.plan.animal_id, user_id) else None

def _comment_in_organization(db: Session, comment_id: int, user_id: int):
    comment = db.query(models.StepComment).filter(models.StepComment.id == comment_id).first()
    if not comment or not _step_in_organization(db, comment.step_id, user_id):
        return None
    return comment

def get_step_comments(db: Session, step_id: int, user_id: int):
    step = _step_in_organization(db, step_id, user_id)
    return None if step is None else list(step.comments)

def add_step_comment(db: Session, step_id: int, body: str, user_id: int):
    if not _step_in_organization(db, step_id, user_id):
        return None
    comment = models.StepComment(step_id=step_id, author_id=user_id, body=body)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment

def update_step_comment(db: Session, comment_id: int, body: str, user_id: int):
    comment = _comment_in_organization(db, comment_id, user_id)
    if not comment:
        return None
    if comment.author_id != user_id:
        raise CommentForbidden("You can only edit your own comments")
    comment.body = body
    comment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(comment)
    return comment

def delete_step_comment(db: Session, comment_id: int, user_id: int):
    comment = _comment_in_organization(db, comment_id, user_id)
    if not comment:
        return False
    user = get_user_by_id(db, user_id)
    if comment.author_id != user_id and user.role != models.ROLE_CURATOR:
        raise CommentForbidden("Only the author or a curator can delete a comment")
    db.delete(comment)
    db.commit()
    return True