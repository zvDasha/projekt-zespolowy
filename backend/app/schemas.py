from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator


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

class BookListResponse(BaseModel):
    items: list[BookResponse]
    total: int
    page: int
    page_size: int
    pages: int
    
class BookDetailResponse(BookResponse):
    description: Optional[str] = None
    cover_url: Optional[str] = None


def normalize_isbn(value: str) -> str:
    isbn = value.replace("-", "").replace(" ", "").upper()
    is_isbn13 = len(isbn) == 13 and isbn.isdigit()
    is_isbn10 = len(isbn) == 10 and isbn[:9].isdigit() and (isbn[9].isdigit() or isbn[9] == "X")
    if not (is_isbn13 or is_isbn10):
        raise ValueError("ISBN must have 10 or 13 digits")
    return isbn

def check_publication_year(value: Optional[int]) -> Optional[int]:
    max_year = datetime.now().year + 1
    if value is not None and not (1450 <= value <= max_year):
        raise ValueError(f"publication_year must be between 1450 and {max_year}")
    return value

class BookCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    author: str = Field(..., min_length=1, max_length=255)
    isbn: str
    genre: str = Field(..., min_length=1, max_length=100)
    publication_year: Optional[int] = None
    description: Optional[str] = None
    cover_url: Optional[str] = Field(None, max_length=500)
    copies: int = Field(0, ge=0, le=50, description="Number of copies to create right away")

    @field_validator("isbn")
    @classmethod
    def validate_isbn(cls, v: str) -> str:
        return normalize_isbn(v)

    @field_validator("publication_year")
    @classmethod
    def validate_year(cls, v: Optional[int]) -> Optional[int]:
        return check_publication_year(v)

class BookUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    author: Optional[str] = Field(None, min_length=1, max_length=255)
    isbn: Optional[str] = None
    genre: Optional[str] = Field(None, min_length=1, max_length=100)
    publication_year: Optional[int] = None
    description: Optional[str] = None
    cover_url: Optional[str] = Field(None, max_length=500)

    @field_validator("isbn")
    @classmethod
    def validate_isbn(cls, v: Optional[str]) -> Optional[str]:
        return normalize_isbn(v) if v is not None else None

    @field_validator("publication_year")
    @classmethod
    def validate_year(cls, v: Optional[int]) -> Optional[int]:
        return check_publication_year(v)


class CopyCreate(BaseModel):
    count: int = Field(1, ge=1, le=50)


class CopyResponse(BaseModel):
    id: int
    inventory_number: str
    status: str

    model_config = ConfigDict(from_attributes=True)

class ReservationCreate(BaseModel):
    book_id: int


class ReservationResponse(BaseModel):
    id: int
    status: str
    book_id: int
    book_title: str
    inventory_number: str
    user_id: int
    user_email: str
    reserved_at: datetime
    due_date: Optional[datetime] = None
    returned_at: Optional[datetime] = None