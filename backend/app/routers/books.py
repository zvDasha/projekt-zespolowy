import math
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Book, BookCopy, Reservation, Review, User
from app.schemas import (
    BookCreate,
    BookDetailResponse,
    BookListResponse,
    BookResponse,
    BookUpdate,
    CopyCreate,
    CopyResponse,
    normalize_isbn,
)
from app.security import require_roles

router = APIRouter(prefix="/books", tags=["Books"])

staff_only = require_roles("librarian", "admin")

def _book_stats(book: Book) -> dict:
    ratings = [r.rating for r in book.reviews]
    return {
        "total_copies": len(book.copies),
        "available_copies": sum(1 for c in book.copies if c.status == "available"),
        "average_rating": round(sum(ratings) / len(ratings), 2) if ratings else None,
    }
def _to_detail(book: Book) -> BookDetailResponse:
    return BookDetailResponse(
        id=book.id, title=book.title, author=book.author, isbn=book.isbn,
        genre=book.genre, publication_year=book.publication_year,
        description=book.description, cover_url=book.cover_url, **_book_stats(book),
    )

def _get_book_or_404(db: Session, book_id: int) -> Book:
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book

def _ensure_isbn_free(db: Session, isbn: str, exclude_book_id: int | None = None) -> None:
    query = db.query(Book).filter(Book.isbn == isbn)
    if exclude_book_id is not None:
        query = query.filter(Book.id != exclude_book_id)
    if query.first():
        raise HTTPException(status_code=409, detail="Book with this ISBN already exists")

def _new_copies(book_id: int, count: int) -> list[BookCopy]:
    return [
        BookCopy(
            book_id=book_id,
            inventory_number=f"INV-{book_id}-{uuid.uuid4().hex[:6].upper()}",
            status="available",
        )
        for _ in range(count)
    ]

def _commit_or_409(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflict with existing data (duplicate ISBN?)")

# public access
SortOption = Literal["title", "-title", "year", "-year", "rating", "-rating", "added", "-added"]


@router.get("", response_model=BookListResponse)
def list_books(
    q: Optional[str] = Query(None, max_length=100, description="Fragment of title or author"),
    genre: Optional[str] = Query(None, max_length=100),
    isbn: Optional[str] = Query(None, max_length=20),
    year_from: Optional[int] = Query(None, ge=0),
    year_to: Optional[int] = Query(None, ge=0),
    available_only: bool = False,
    sort: SortOption = "title",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    ):
    copies_sq = (
        select(
            BookCopy.book_id,
            func.count().label("total_copies"),
            func.count().filter(BookCopy.status == "available").label("available_copies"),
        )
        .group_by(BookCopy.book_id)
        .subquery()
    )
    ratings_sq = (
        select(Review.book_id, func.avg(Review.rating).label("average_rating"))
        .group_by(Review.book_id)
        .subquery()
    )
    total_copies = func.coalesce(copies_sq.c.total_copies, 0)
    available_copies = func.coalesce(copies_sq.c.available_copies, 0)
    average_rating = ratings_sq.c.average_rating

    stmt = (
        select(Book, total_copies, available_copies, average_rating)
        .outerjoin(copies_sq, copies_sq.c.book_id == Book.id)
        .outerjoin(ratings_sq, ratings_sq.c.book_id == Book.id)
    )

    # filtry
    if q:
        stmt = stmt.where(
            or_(Book.title.icontains(q, autoescape=True), Book.author.icontains(q, autoescape=True))
        )
    if genre:
        stmt = stmt.where(func.lower(Book.genre) == genre.lower())
    if isbn:
        try:
            stmt = stmt.where(Book.isbn == normalize_isbn(isbn))
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
    if year_from is not None:
        stmt = stmt.where(Book.publication_year >= year_from)
    if year_to is not None:
        stmt = stmt.where(Book.publication_year <= year_to)
    if available_only:
        stmt = stmt.where(available_copies > 0)

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))

    sort_columns = {
        "title": Book.title,
        "year": Book.publication_year,
        "rating": average_rating,
        "added": Book.created_at,
    }
    column = sort_columns[sort.lstrip("-")]
    order = column.desc() if sort.startswith("-") else column.asc()
    stmt = stmt.order_by(order.nulls_last(), Book.id)  # Book.id = stabilna kolejność stron

    rows = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()

    items = [
        BookResponse(
            id=book.id, title=book.title, author=book.author, isbn=book.isbn,
            genre=book.genre, publication_year=book.publication_year,
            total_copies=total_c, available_copies=avail_c,
            average_rating=round(float(avg), 2) if avg is not None else None,
        )
        for book, total_c, avail_c, avg in rows
    ]
    return BookListResponse(
        items=items, total=total, page=page, page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0,
    )


@router.get("/genres", response_model=list[str])
def list_genres(db: Session = Depends(get_db)):
    """Lista gatunków do filtra na froncie. Musi być PRZED /{book_id}."""
    return db.scalars(select(Book.genre).distinct().order_by(Book.genre)).all()


@router.get("/{book_id}", response_model=BookDetailResponse)
def get_book(book_id: int, db: Session = Depends(get_db)):
    return _to_detail(_get_book_or_404(db, book_id))

# books (librarian / admin)

@router.post("", response_model=BookDetailResponse, status_code=status.HTTP_201_CREATED)
def create_book(data: BookCreate, db: Session = Depends(get_db), _: User = Depends(staff_only)):
    _ensure_isbn_free(db, data.isbn)

    book = Book(**data.model_dump(exclude={"copies"}))
    db.add(book)
    db.flush()  
    db.add_all(_new_copies(book.id, data.copies))
    _commit_or_409(db)
    db.refresh(book)
    return _to_detail(book)


@router.patch("/{book_id}", response_model=BookDetailResponse)
def update_book(
    book_id: int, data: BookUpdate, db: Session = Depends(get_db), _: User = Depends(staff_only)
):
    book = _get_book_or_404(db, book_id)
    changes = data.model_dump(exclude_unset=True)

    for field in ("title", "author", "isbn", "genre"):
        if field in changes and changes[field] is None:
            raise HTTPException(status_code=422, detail=f"{field} cannot be null")

    if "isbn" in changes:
        _ensure_isbn_free(db, changes["isbn"], exclude_book_id=book_id)

    for field, value in changes.items():
        setattr(book, field, value)
    _commit_or_409(db)
    db.refresh(book)
    return _to_detail(book)


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(book_id: int, db: Session = Depends(get_db), _: User = Depends(staff_only)):
    book = _get_book_or_404(db, book_id)

    has_reservations = (
        db.query(Reservation)
        .join(BookCopy, Reservation.book_copy_id == BookCopy.id)
        .filter(BookCopy.book_id == book_id)
        .first()
    )
    if has_reservations:
        raise HTTPException(
            status_code=409, detail="Book has reservation history and cannot be deleted"
        )

    db.delete(book)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# copies (librarian / admin)

@router.get("/{book_id}/copies", response_model=list[CopyResponse])
def list_copies(book_id: int, db: Session = Depends(get_db), _: User = Depends(staff_only)):
    book = _get_book_or_404(db, book_id)
    return sorted(book.copies, key=lambda c: c.id)


@router.post(
    "/{book_id}/copies", response_model=list[CopyResponse], status_code=status.HTTP_201_CREATED
)
def add_copies(
    book_id: int, data: CopyCreate, db: Session = Depends(get_db), _: User = Depends(staff_only)
):
    _get_book_or_404(db, book_id)
    copies = _new_copies(book_id, data.count)
    db.add_all(copies)
    db.commit()
    for c in copies:
        db.refresh(c)
    return copies


@router.delete("/{book_id}/copies/{copy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_copy(
    book_id: int, copy_id: int, db: Session = Depends(get_db), _: User = Depends(staff_only)
):
    copy = db.get(BookCopy, copy_id)
    if not copy or copy.book_id != book_id:
        raise HTTPException(status_code=404, detail="Copy not found")
    if copy.status != "available":
        raise HTTPException(status_code=409, detail="Only available copies can be deleted")
    if db.query(Reservation).filter(Reservation.book_copy_id == copy_id).first():
        raise HTTPException(
            status_code=409, detail="Copy has reservation history and cannot be deleted"
        )

    db.delete(copy)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)