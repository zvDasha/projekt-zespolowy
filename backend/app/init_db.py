from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash
from app.database import engine, SessionLocal, Base
from app.models import User, Book, BookCopy, Reservation, Review, Favorite, ChatMessage


def init_database():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(User).first():
            return

        # Users
        admin = User(email="admin@library.pl", password_hash=generate_password_hash("admin123"), full_name="Olena Admin", role="admin")
        librarian = User(email="librarian@library.pl", password_hash=generate_password_hash("lib123"), full_name="Marek Bibliotekarz", role="librarian")
        reader = User(
            email="dasha@library.pl",
            password_hash=generate_password_hash("dasha123"),
            full_name="Dasha Studentka",
            role="reader",
            field_of_study="Informatyka",
            preferences_text="Lubię klasykę literatury oraz książki o programowaniu."
        )
        db.add_all([admin, librarian, reader])
        db.flush()

        # Books
        book1 = Book(title="Lalka", author="Bolesław Prus", isbn="9788373271890", genre="Klasyka", publication_year=1890, description="Powieść społeczno-obyczajowa.")
        book2 = Book(title="Clean Code", author="Robert C. Martin", isbn="9780132350884", genre="Informatyka", publication_year=2008, description="Podręcznik dobrego kodu.")
        db.add_all([book1, book2])
        db.flush()

        # Book Copies
        copy1 = BookCopy(book_id=book1.id, inventory_number="INV-001", status="borrowed")
        copy2 = BookCopy(book_id=book1.id, inventory_number="INV-002", status="available")
        copy3 = BookCopy(book_id=book2.id, inventory_number="INV-003", status="available")
        db.add_all([copy1, copy2, copy3])
        db.flush()

        # Reservation, Review, Favorite, Chat
        reservation = Reservation(user_id=reader.id, book_copy_id=copy1.id, status="confirmed", due_date=datetime.utcnow() + timedelta(days=14))
        db.add(reservation)
        db.flush()

        review = Review(user_id=reader.id, book_id=book1.id, reservation_id=reservation.id, rating=5, comment="Świetna książka!")
        favorite = Favorite(user_id=reader.id, book_id=book2.id)
        message = ChatMessage(room_name="Klasyka", user_id=reader.id, content="Cześć! Kto czyta Lalkę?")
        db.add_all([review, favorite, message])

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Database init error: {e}")
    finally:
        db.close()