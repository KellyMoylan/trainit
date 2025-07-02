from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from .. import schemas, crud, database, auth_utils

router = APIRouter(prefix="/animals", tags=["animals"])

@router.post("/", response_model=schemas.AnimalOut)
def create_animal(
    animal: schemas.AnimalCreate,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """Create a new animal for the current user"""
    return crud.create_animal(db, animal, current_user.id)

@router.get("/", response_model=List[schemas.AnimalOut])
def list_animals(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """Get all animals for the current user"""
    return crud.get_user_animals(db, user_id=current_user.id, skip=skip, limit=limit)

@router.get("/{animal_id}", response_model=schemas.AnimalOut)
def get_animal(
    animal_id: int,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """Get a specific animal by ID"""
    animal = crud.get_animal_by_id(db, animal_id, current_user.id)
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    return animal

@router.put("/{animal_id}", response_model=schemas.AnimalOut)
def update_animal(
    animal_id: int,
    animal_update: schemas.AnimalCreate,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """Update an animal"""
    updated_animal = crud.update_animal(db, animal_id, current_user.id, animal_update)
    if not updated_animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    return updated_animal

@router.delete("/{animal_id}")
def delete_animal(
    animal_id: int,
    current_user: schemas.UserOut = Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """Delete an animal"""
    success = crud.delete_animal(db, animal_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Animal not found")
    return {"message": "Animal deleted successfully"} 