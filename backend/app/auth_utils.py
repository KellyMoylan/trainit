import logging
import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from . import crud, schemas, database, models

def _load_secret_key() -> str:
    key = os.environ.get("SECRET_KEY")
    if key:
        return key
    # A local SQLite database means development; anything else is a real deployment and must not run on a public key
    if database.SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
        logging.warning("SECRET_KEY is not set; using an insecure development key. Set SECRET_KEY before deploying.")
        return "insecure-development-key-do-not-use-in-production"
    raise RuntimeError("SECRET_KEY environment variable must be set when not using a local SQLite database")

SECRET_KEY = _load_secret_key()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

security = HTTPBearer()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def issue_token(user) -> str:
    # "v" is the user's token version; bumping it (on a password change) invalidates every earlier token
    return create_access_token(
        data={"sub": user.email, "v": user.token_version},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

def verify_token(token: str, credentials_exception):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=email, version=payload.get("v", 0))
    except JWTError:
        raise credentials_exception
    return token_data

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = credentials.credentials
    token_data = verify_token(token, credentials_exception)
    user = crud.get_user_by_email(db, email=token_data.email)
    if user is None or user.token_version != token_data.version:
        raise credentials_exception
    return user

def get_active_user(user = Depends(get_current_user)):
    if user.status != models.STATUS_ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your membership is pending approval")
    return user

def require_role(minimum_role: str):
    def dependency(user = Depends(get_active_user)):
        if models.ROLE_RANK[user.role] < models.ROLE_RANK[minimum_role]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Requires {minimum_role} role")
        return user
    return dependency

require_supervisor = require_role(models.ROLE_SUPERVISOR)
require_curator = require_role(models.ROLE_CURATOR)
