from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters long")
    full_name: str = Field(..., min_length=2, max_length=150)
    field_of_study: Optional[str] = Field(None, max_length=150)
    preferences_text: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    field_of_study: Optional[str] = Field(None, max_length=150)
    preferences_text: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, description="New password must be at least 6 characters long")


class AdminUserUpdate(BaseModel):
    role: Optional[Literal["reader", "librarian", "admin"]] = None
    is_active: Optional[bool] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6, description="New password must be at least 6 characters long")


class GoogleAuthRequest(BaseModel):
    id_token: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    field_of_study: Optional[str] = None
    preferences_text: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str


class BookResponse(BaseModel):
    id: int
    title: str
    author: str
    isbn: str
    genre: str
    publication_year: Optional[int] = None
    total_copies: int
    available_copies: int
    average_rating: Optional[float] = None

class BookDetailResponse(BookResponse):
    description: Optional[str] = None
    cover_url: Optional[str] = None

