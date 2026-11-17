from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database import get_db
from app.init_db import init_database
from app.models import Book


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_database()
    yield


app = FastAPI(title="Library AI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/books")
def get_books(db: Session = Depends(get_db)):
    books = db.query(Book).all()
    return [
        {
            "id": book.id,
            "title": book.title,
            "author": book.author,
            "isbn": book.isbn,
            "genre": book.genre,
            "publication_year": book.publication_year,
            "total_copies": len(book.copies),
            "available_copies": sum(1 for c in book.copies if c.status == "available"),
            "average_rating": round(sum(r.rating for r in book.reviews) / len(book.reviews), 2) if book.reviews else None
        }
        for book in books
    ]


@app.get("/books/{book_id}")
def get_book(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return {
        "id": book.id,
        "title": book.title,
        "author": book.author,
        "isbn": book.isbn,
        "genre": book.genre,
        "publication_year": book.publication_year,
        "description": book.description,
        "cover_url": book.cover_url,
        "total_copies": len(book.copies),
        "available_copies": sum(1 for c in book.copies if c.status == "available"),
        "average_rating": round(sum(r.rating for r in book.reviews) / len(book.reviews), 2) if book.reviews else None
    }
