import os
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    UserRegister,
    UserResponse,
    Token,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    GoogleAuthRequest,
)
from app.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_password_reset_token,
    verify_password_reset_token,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already registered"
        )

    new_user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
        role="reader",
        field_of_study=user_data.field_of_study,
        preferences_text=user_data.preferences_text,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    access_token = create_access_token(user_id=user.id, role=user.role)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/google", response_model=Token)
def google_login(auth_data: GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        id_info = google_id_token.verify_oauth2_token(
            auth_data.id_token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID or None
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google ID token"
        )

    google_sub = id_info.get("sub")
    email = id_info.get("email")
    full_name = id_info.get("name") or (email.split("@")[0] if email else "Google User")

    try:
      id_info = google_id_token.verify_oauth2_token(
          auth_data.id_token, google_requests.Request(), GOOGLE_CLIENT_ID or None
      )
    except ValueError as e:
      print(f"[GOOGLE AUTH ERROR] {e}")
      raise HTTPException(
          status_code=status.HTTP_401_UNAUTHORIZED,
          detail=f"Invalid Google ID token: {e}",
      )
    
    if not email or not google_sub:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google token did not provide required user information"
        )

    user = db.query(User).filter(
        (User.google_id == google_sub) | (User.email == email)
    ).first()

    if not user:
        user = User(
            email=email,
            google_id=google_sub,
            full_name=full_name,
            role="reader",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if not user.google_id:
            user.google_id = google_sub
            db.commit()

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    access_token = create_access_token(user_id=user.id, role=user.role)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(request_data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request_data.email).first()
    if not user:
        return {"message": "If an account with that email exists, a password reset link has been generated"}

    reset_token = create_password_reset_token(email=user.email)
    print(f"[PASSWORD RESET] Email: {user.email} | Token: {reset_token}")

    return {
        "message": "If an account with that email exists, a password reset link has been generated",
        "dev_reset_token": reset_token
    }


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(reset_data: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = verify_password_reset_token(reset_data.token)
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user.password_hash = hash_password(reset_data.new_password)
    db.commit()
    return {"message": "Password has been reset successfully"}


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user