from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from .. import schemas, crud, database, auth_utils

router = APIRouter(prefix="/steps", tags=["plan steps"])

@router.post("/{step_id}/notes", response_model=schemas.StepSessionNoteOut)
def add_note_to_step(
    step_id: int,
    note: schemas.StepSessionNoteCreate,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    result = crud.add_step_session_note(db, step_id, note, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Step not found or not in your organization")
    return schemas.StepSessionNoteOut.model_validate(result)

@router.get("/{step_id}/notes", response_model=List[schemas.StepSessionNoteOut])
def list_notes_for_step(
    step_id: int,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    return crud.get_notes_for_step(db, step_id, current_user.id)

@router.post("/{step_id}/complete", response_model=schemas.StepSessionNoteOut)
def mark_step_complete(
    step_id: int,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    result = crud.mark_step_complete(db, step_id, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Step not found or not in your organization")
    return result

@router.put("/{step_id}", response_model=schemas.PlanStepOut)
def update_step(
    step_id: int,
    step_update: schemas.PlanStepUpdate,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    updated_step = crud.update_step(db, step_id, step_update, current_user.id)
    if not updated_step:
        raise HTTPException(status_code=404, detail="Step not found or not in your organization")
    return updated_step

@router.delete("/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_step(
    step_id: int,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    success = crud.delete_step(db, step_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Step not found or not in your organization")
    return None

@router.put("/notes/{note_id}", response_model=schemas.StepSessionNoteOut)
def update_session_note(
    note_id: int,
    note_update: schemas.StepSessionNoteUpdate,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    updated_note = crud.update_session_note(db, note_id, note_update, current_user.id)
    if not updated_note:
        raise HTTPException(status_code=404, detail="Session note not found or not in your organization")
    return updated_note

@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session_note(
    note_id: int,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    success = crud.delete_session_note(db, note_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Session note not found or not in your organization")
    return None 