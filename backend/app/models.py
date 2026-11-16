from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=True)
    google_id = Column(String(255), unique=True, nullable=True)
    full_name = Column(String(150), nullable=False)
    role = Column(String(20), default="reader", nullable=False)  # reader | librarian | admin
    field_of_study = Column(String(150), nullable=True)
    preferences_text = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    reservations = relationship("Reservation", back_populates="user")
    reviews = relationship("Review", back_populates="user")
    favorites = relationship("Favorite", back_populates="user", cascade="all, delete-orphan")


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), index=True, nullable=False)
    author = Column(String(255), index=True, nullable=False)
    isbn = Column(String(20), unique=True, index=True, nullable=False)
    genre = Column(String(100), index=True, nullable=False)
    publication_year = Column(Integer, index=True, nullable=True)
    description = Column(Text, nullable=True)
    cover_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    copies = relationship("BookCopy", back_populates="book", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="book", cascade="all, delete-orphan")


class BookCopy(Base):
    __tablename__ = "book_copies"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    inventory_number = Column(String(50), unique=True, nullable=False)
    status = Column(String(20), default="available", index=True)  # available | reserved | borrowed

    book = relationship("Book", back_populates="copies")


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    book_copy_id = Column(Integer, ForeignKey("book_copies.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), default="pending", index=True)  # pending | confirmed | returned | cancelled
    reserved_at = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="reservations")
    book_copy = relationship("BookCopy")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), unique=True, nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="check_rating_1_5"),
        UniqueConstraint("user_id", "book_id", name="uq_one_review_per_book"),
    )

    user = relationship("User", back_populates="reviews")
    book = relationship("Book", back_populates="reviews")


class Favorite(Base):
    __tablename__ = "favorites"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), primary_key=True)

    user = relationship("User", back_populates="favorites")
    book = relationship("Book")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    room_name = Column(String(100), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)