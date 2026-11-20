from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Book
from app.schemas import BookResponse, BookDetailResponse

router = APIRouter(prefix="/books", tags=["Books"])

def _book_stats(book: Book) -> dict:
    ratings = [r.rating for r in book.reviews]
    return {
        "total_copies": len(book.copies),
        "available_copies": sum(1 for c in book.copies if c.status == "available"),
        "average_rating": round(sum(ratings) / len(ratings), 2) if ratings else None,
    }

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
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return BookDetailResponse(
        id=book.id, title=book.title, author=book.author, isbn=book.isbn,
        genre=book.genre, publication_year=book.publication_year,
        description=book.description, cover_url=book.cover_url, **_book_stats(book),
    )
