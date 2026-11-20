import uuid 

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Book, BookCopy, Reservation, User
from app.schemas import (
    BookCreate,
    BookDetailResponse,
    BookResponse,
    BookUpdate,
    CopyCreate,
    CopyResponse,
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
@router.get("", response_model=list[BookResponse])
def list_books(db: Session = Depends(get_db)):
    books = db.query(Book).all()
    return [
        BookResponse(
            id=b.id, title=b.title, author=b.author, isbn=b.isbn,
            genre=b.genre, publication_year=b.publication_year, **_book_stats(b),
        )
        for b in books
    ]


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