from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from .. import schemas, crud, database, auth_utils

router = APIRouter(prefix="/plans", tags=["training plans"])

@router.get("/", summary="List all plans (placeholder)")
def list_plans():
    return {"message": "Plans route placeholder"}

@router.post("/animal/{animal_id}", response_model=schemas.TrainingPlanOut)
def create_plan_for_animal(
    animal_id: int,
    plan: schemas.TrainingPlanCreate,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    result = crud.create_plan_with_steps(db, animal_id, plan, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Animal not found or not in your organization")
    return result

@router.get("/animal/{animal_id}", response_model=List[schemas.TrainingPlanOut])
def get_plans_for_animal(
    animal_id: int,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    return crud.get_plans_for_animal(db, animal_id, current_user.id)

@router.get("/{plan_id}", response_model=schemas.TrainingPlanOut)
def get_plan(
    plan_id: int,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    plan = crud.get_plan_with_steps(db, plan_id, current_user.id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found or not in your organization")
    return plan

@router.post("/log", response_model=schemas.TimeLogOut)
def log_training_session(
    log: schemas.TimeLogCreate,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """Log a training session for the current user"""
    return crud.create_log(db, user_id=current_user.id, log=log)

@router.get("/stats")
def get_user_stats(
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """Get training statistics for the current user"""
    return crud.get_user_stats(db, user_id=current_user.id)

@router.get("/logs")
def get_user_logs(
    skip: int = 0,
    limit: int = 10,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """Get recent training logs for the current user"""
    logs = crud.get_user_logs(db, user_id=current_user.id, skip=skip, limit=limit)
    return logs

@router.put("/{plan_id}", response_model=schemas.TrainingPlanOut)
def update_plan(
    plan_id: int,
    plan_update: schemas.TrainingPlanUpdate,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    updated_plan = crud.update_plan(db, plan_id, plan_update, current_user.id)
    if not updated_plan:
        raise HTTPException(status_code=404, detail="Plan not found or not in your organization")
    return updated_plan

@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(
    plan_id: int,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    success = crud.delete_plan(db, plan_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Plan not found or not in your organization")
    return None