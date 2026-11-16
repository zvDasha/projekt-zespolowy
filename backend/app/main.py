from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.init_db import init_database
from app.models import Book


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_database()
    yield


app = FastAPI(title="API", lifespan=lifespan)


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
            "available_copies": sum(1 for c in book.copies if c.status == "available")
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
        "available_copies": sum(1 for c in book.copies if c.status == "available")
    }