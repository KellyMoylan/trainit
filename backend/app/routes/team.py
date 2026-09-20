from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from .. import schemas, database, auth_utils, models

router = APIRouter(prefix="/team", tags=["team"])

def _get_org_user(db: Session, user_id: int, organization_id: int):
    target = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.organization_id == organization_id
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    return target

def _validate_role(role: str):
    if role not in models.ROLE_RANK:
        raise HTTPException(status_code=400, detail="Invalid role")

@router.get("/members", response_model=List[schemas.MemberOut])
def list_members(
    current_user=Depends(auth_utils.require_supervisor),
    db: Session = Depends(database.get_db)
):
    return db.query(models.User).filter(
        models.User.organization_id == current_user.organization_id,
        models.User.status == models.STATUS_ACTIVE
    ).order_by(models.User.email).all()

@router.get("/requests", response_model=List[schemas.MemberOut])
def list_join_requests(
    current_user=Depends(auth_utils.require_supervisor),
    db: Session = Depends(database.get_db)
):
    return db.query(models.User).filter(
        models.User.organization_id == current_user.organization_id,
        models.User.status == models.STATUS_PENDING
    ).order_by(models.User.email).all()

@router.post("/requests/{user_id}/approve", response_model=schemas.MemberOut)
def approve_join_request(
    user_id: int,
    assignment: schemas.RoleAssign,
    current_user=Depends(auth_utils.require_supervisor),
    db: Session = Depends(database.get_db)
):
    _validate_role(assignment.role)
    if assignment.role == models.ROLE_CURATOR and current_user.role != models.ROLE_CURATOR:
        raise HTTPException(status_code=403, detail="Only a curator can assign the curator role")
    target = _get_org_user(db, user_id, current_user.organization_id)
    if target.status != models.STATUS_PENDING:
        raise HTTPException(status_code=400, detail="User is not a pending request")
    target.role = assignment.role
    target.status = models.STATUS_ACTIVE
    db.commit()
    db.refresh(target)
    return target

@router.delete("/requests/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def reject_join_request(
    user_id: int,
    current_user=Depends(auth_utils.require_supervisor),
    db: Session = Depends(database.get_db)
):
    target = _get_org_user(db, user_id, current_user.organization_id)
    if target.status != models.STATUS_PENDING:
        raise HTTPException(status_code=400, detail="User is not a pending request")
    db.delete(target)
    db.commit()
    return None

@router.delete("/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    user_id: int,
    current_user=Depends(auth_utils.require_curator),
    db: Session = Depends(database.get_db)
):
    """End someone's access. Their animals, plans and sessions stay, and so does the "Created by" name on them."""
    target = _get_org_user(db, user_id, current_user.organization_id)
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't remove yourself")
    if target.status != models.STATUS_ACTIVE:
        raise HTTPException(status_code=400, detail="Only active members can be removed")
    target.status = models.STATUS_REMOVED
    # Ends every login the person has right now
    target.token_version = (target.token_version or 0) + 1
    db.commit()
    return None

@router.get("/removed", response_model=List[schemas.MemberOut])
def list_removed_members(
    current_user=Depends(auth_utils.require_curator),
    db: Session = Depends(database.get_db)
):
    return db.query(models.User).filter(
        models.User.organization_id == current_user.organization_id,
        models.User.status == models.STATUS_REMOVED
    ).order_by(models.User.email).all()

@router.post("/members/{user_id}/restore", response_model=schemas.MemberOut)
def restore_member(
    user_id: int,
    current_user=Depends(auth_utils.require_curator),
    db: Session = Depends(database.get_db)
):
    target = _get_org_user(db, user_id, current_user.organization_id)
    if target.status != models.STATUS_REMOVED:
        raise HTTPException(status_code=400, detail="User has not been removed")
    target.status = models.STATUS_ACTIVE
    db.commit()
    db.refresh(target)
    return target

@router.put("/members/{user_id}/role", response_model=schemas.MemberOut)
def change_member_role(
    user_id: int,
    assignment: schemas.RoleAssign,
    current_user=Depends(auth_utils.require_curator),
    db: Session = Depends(database.get_db)
):
    _validate_role(assignment.role)
    target = _get_org_user(db, user_id, current_user.organization_id)
    if target.status != models.STATUS_ACTIVE:
        raise HTTPException(status_code=400, detail="User is not an active member")
    if target.role == models.ROLE_CURATOR and assignment.role != models.ROLE_CURATOR:
        curator_count = db.query(models.User).filter(
            models.User.organization_id == current_user.organization_id,
            models.User.status == models.STATUS_ACTIVE,
            models.User.role == models.ROLE_CURATOR
        ).count()
        if curator_count <= 1:
            raise HTTPException(status_code=400, detail="An organization must keep at least one curator")
    target.role = assignment.role
    db.commit()
    db.refresh(target)
    return target
