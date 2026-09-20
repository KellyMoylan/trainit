from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import schemas, crud, database, auth_utils

router = APIRouter(prefix="/auth", tags=["auth"])

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/signup", response_model=schemas.UserOut)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db, user)

@router.post("/login", response_model=schemas.Token)
def login(user_credentials: schemas.UserLogin, db: Session = Depends(database.get_db)):
    user = crud.authenticate_user(db, user_credentials.email, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"access_token": auth_utils.issue_token(user), "token_type": "bearer"}

@router.get("/me", response_model=schemas.UserOut)
def read_users_me(current_user: schemas.UserOut = Depends(auth_utils.get_current_user)):
    return current_user

@router.put("/me", response_model=schemas.UserOut)
def update_my_profile(
    profile: schemas.ProfileUpdate,
    current_user=Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    return crud.update_profile(db, current_user, profile)

# Both endpoints answer a wrong current password with 400, not 401, because the frontend treats 401 as an expired session
@router.put("/me/email", response_model=schemas.Token)
def change_my_email(
    change: schemas.EmailChange,
    current_user=Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    if not crud.verify_password(change.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    existing = crud.get_user_by_email(db, email=change.email)
    if existing and existing.id != current_user.id:
        raise HTTPException(status_code=400, detail="Email already registered")
    crud.update_email(db, current_user, change.email)
    # Tokens are issued for the email address, so the old one stops working
    return {"access_token": auth_utils.issue_token(current_user), "token_type": "bearer"}

@router.put("/me/password", response_model=schemas.Token)
def change_my_password(
    change: schemas.PasswordChange,
    current_user=Depends(auth_utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    if not crud.verify_password(change.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    crud.update_password(db, current_user, change.new_password)
    # Every earlier token is now invalid, including this session's, so hand back a fresh one
    return {"access_token": auth_utils.issue_token(current_user), "token_type": "bearer"}