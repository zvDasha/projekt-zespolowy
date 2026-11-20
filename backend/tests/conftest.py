import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.database import Base, get_db
from app.main import app
from app.models import Book, BookCopy, Reservation, Review, User
from app.security import create_access_token

TEST_URL = make_url(os.getenv("DATABASE_URL", "postgresql+psycopg://library_admin:secret123@localhost:5432/library_db"))
TEST_URL = TEST_URL.set(database=f"{TEST_URL.database}_test")

#Testy działają na osobnej bazie <nazwa>_test

@pytest.fixture(scope="session")
def engine():
    admin = create_engine(TEST_URL.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        if not conn.scalar(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": TEST_URL.database}):
            conn.execute(text(f'CREATE DATABASE "{TEST_URL.database}"'))
    engine = create_engine(TEST_URL)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield engine


@pytest.fixture
def db(engine):
    with engine.connect() as conn:
        trans = conn.begin()
        session = Session(bind=conn, join_transaction_mode="create_savepoint")
        yield session
        session.close()
        trans.rollback()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)  
    app.dependency_overrides.clear()


@pytest.fixture
def headers_for(db):
    """headers_for("librarian") -> nagłówek Authorization dla nowego użytkownika z tą rolą."""
    def _make(role: str) -> dict:
        user = User(email=f"{role}{id(object())}@test.pl", full_name="Test", role=role)
        db.add(user)
        db.flush()
        return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}
    return _make


@pytest.fixture
def make_book(db):
    def _make(title: str, ratings: tuple[int, ...] = (), copies: int = 0, **kwargs) -> Book:
        book = Book(title=title, author=kwargs.pop("author", "Autor"),
                    isbn=kwargs.pop("isbn", f"978{abs(hash(title)) % 10**10:010d}"),
                    genre=kwargs.pop("genre", "Test"), **kwargs)
        db.add(book)
        db.flush()
        db.add_all(BookCopy(book_id=book.id, inventory_number=f"T-{book.id}-{i}") for i in range(copies))
        for i, rating in enumerate(ratings):  # każda ocena z własną potwierdzoną rezerwacją
            user = User(email=f"r{book.id}-{i}@test.pl", full_name="R", role="reader")
            copy = BookCopy(book_id=book.id, inventory_number=f"R-{book.id}-{i}", status="borrowed")
            db.add_all([user, copy])
            db.flush()
            res = Reservation(user_id=user.id, book_copy_id=copy.id, status="confirmed")
            db.add(res)
            db.flush()
            db.add(Review(user_id=user.id, book_id=book.id, reservation_id=res.id, rating=rating))
        db.flush()
        return book
    return _make
