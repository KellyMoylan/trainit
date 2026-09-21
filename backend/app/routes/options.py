from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from .. import schemas, database, auth_utils, crud, models

router = APIRouter(prefix="/options", tags=["options"])

# The URL says "locations" and "species"; the tables and animals use the singular "location"
KINDS = {"locations": models.OPTION_LOCATION, "species": models.OPTION_SPECIES}
Kind = Literal["locations", "species"]

def _as_out(option: models.OrganizationOption, db: Session, organization_id: int):
    kind = option.kind
    return next(item for item in crud.list_options(db, organization_id, kind) if item["id"] == option.id)

@router.get("/species/suggestions", response_model=List[str])
def species_suggestions(
    current_user=Depends(auth_utils.require_supervisor),
    db: Session = Depends(database.get_db)
):
    """Standard species this organization hasn't added yet"""
    have = {crud.option_key(item["name"]) for item in crud.list_options(db, current_user.organization_id, models.OPTION_SPECIES)}
    return [name for name in crud.DEFAULT_SPECIES if crud.option_key(name) not in have]

@router.get("/{kind}", response_model=List[schemas.OptionOut])
def list_options(
    kind: Kind,
    current_user=Depends(auth_utils.get_active_user),
    db: Session = Depends(database.get_db)
):
    return crud.list_options(db, current_user.organization_id, KINDS[kind])

@router.post("/{kind}", response_model=schemas.OptionOut, status_code=status.HTTP_201_CREATED)
def add_option(
    kind: Kind,
    body: schemas.OptionName,
    current_user=Depends(auth_utils.require_supervisor),
    db: Session = Depends(database.get_db)
):
    option = crud.add_option(db, current_user.organization_id, KINDS[kind], body.name)
    return _as_out(option, db, current_user.organization_id)

@router.put("/{kind}/{option_id}", response_model=schemas.OptionOut)
def rename_option(
    kind: Kind,
    option_id: int,
    body: schemas.OptionName,
    current_user=Depends(auth_utils.require_supervisor),
    db: Session = Depends(database.get_db)
):
    """Rename an entry. Animals using the old name are updated to the new one."""
    option = crud.rename_option(db, current_user.organization_id, KINDS[kind], option_id, body.name)
    return _as_out(option, db, current_user.organization_id)

@router.delete("/{kind}/{option_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_option(
    kind: Kind,
    option_id: int,
    move_to: Optional[int] = None,
    unassign: bool = False,
    current_user=Depends(auth_utils.require_supervisor),
    db: Session = Depends(database.get_db)
):
    """Delete an entry. If animals use it, say where they go: move_to another entry, or unassign (locations only)."""
    crud.delete_option(db, current_user.organization_id, KINDS[kind], option_id, move_to, unassign)
    return None
