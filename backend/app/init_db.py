from datetime import datetime, timedelta, timezone
from werkzeug.security import generate_password_hash
from sqlalchemy import text
from app.database import engine, SessionLocal, Base
from app.models import User, Book, BookCopy, Reservation, Review, Favorite, ChatMessage
from app.db_rules import install_db_rules

def _ensure_default_covers(db):
    default_covers = {
        "9788373271890": "/images/covers/lalka.jpg",
        "9780132350884": "/images/covers/clean-code.jpg",
        "9788372786777": "/images/covers/thinking.jpg",
        "9788308049051": "/images/covers/solaris.jpg",
        "9788328367531": "/images/covers/machine-learning.jpg",
        "9788328069411": "/images/covers/habits.png",
    }
    updated = False
    for isbn, cover_url in default_covers.items():
        book = db.query(Book).filter(Book.isbn == isbn, Book.cover_url.is_(None)).first()
        if book:
            book.cover_url = cover_url
            updated = True
    if updated:
        db.commit()


def update_chat_schema(conn):
    # create_all nie dodaje nowych kolumn do już istniejących tabel.
    conn.execute(text("""
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS room_id INTEGER
        REFERENCES chat_rooms(id) ON DELETE CASCADE
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_chat_messages_room_id ON chat_messages(room_id)"))
    conn.execute(text("""
        UPDATE chat_messages SET room_id = chat_rooms.id
        FROM chat_rooms
        WHERE chat_messages.room_name = chat_rooms.name AND chat_messages.room_id IS NULL
    """))


def init_database():
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        update_chat_schema(conn)
    install_db_rules(engine)
    db = SessionLocal()
    try:
        if db.query(User).first():
            _ensure_default_covers(db)
            return

        # Users (Admin, Librarian, Readers)
        admin = User(
            email="admin@library.pl",
            password_hash=generate_password_hash("admin123"),
            full_name="Olena Admin",
            role="admin"
        )
        librarian = User(
            email="librarian@library.pl",
            password_hash=generate_password_hash("lib123"),
            full_name="Marek Bibliotekarz",
            role="librarian"
        )
        reader1 = User(
            email="maja@library.pl",
            password_hash=generate_password_hash("maja123"),
            full_name="Maja Studentka",
            role="reader",
            field_of_study="Informatyka",
            preferences_text="Lubię klasykę literatury, sztuczną inteligencję oraz książki o programowaniu i architekturze oprogramowania."
        )
        reader2 = User(
            email="kamil@library.pl",
            password_hash=generate_password_hash("kamil123"),
            full_name="Kamil Nowak",
            role="reader",
            field_of_study="Psychologia",
            preferences_text="Interesuję się psychologią poznawczą, rozwojem osobistym oraz literaturą science-fiction."
        )
        db.add_all([admin, librarian, reader1, reader2])
        db.flush()

        # Books
        book1 = Book(
            title="Lalka",
            author="Bolesław Prus",
            isbn="9788373271890",
            genre="Klasyka",
            publication_year=1890,
            description="Powieść społeczno-obyczajowa o losach Stanisława Wokulskiego w XIX-wiecznej Warszawie.",
            cover_url="/images/covers/lalka.jpg",
        )
        book2 = Book(
            title="Clean Code. Czysty kod",
            author="Robert C. Martin",
            isbn="9780132350884",
            genre="Informatyka",
            publication_year=2008,
            description="Podręcznik dobrego programowania i tworzenia czytelnego, łatwego w utrzymaniu kodu.",
            cover_url="/images/covers/clean-code.jpg",
        )
        book3 = Book(
            title="Pułapki myślenia. O myśleniu szybkim i wolnym",
            author="Daniel Kahneman",
            isbn="9788372786777",
            genre="Psychologia",
            publication_year=2011,
            description="Przełomowa książka o dwóch systemach myślenia, które kształtują nasze decyzje i osądy.",
            cover_url="/images/covers/thinking.jpg",
        )
        book4 = Book(
            title="Solaris",
            author="Stanisław Lem",
            isbn="9788308049051",
            genre="Fantastyka",
            publication_year=1961,
            description="Klasyka światowego science-fiction opowiadająca o kontakcie z niezrozumiałą, obcą inteligencją.",
            cover_url="/images/covers/solaris.jpg",
        )
        book5 = Book(
            title="Uczenie maszynowe z użyciem Scikit-Learn i TensorFlow",
            author="Aurélien Géron",
            isbn="9788328367531",
            genre="Informatyka",
            publication_year=2020,
            description="Praktyczny przewodnik po budowaniu inteligentnych systemów, sieciach neuronowych i uczeniu głębokim.",
            cover_url="/images/covers/machine-learning.jpg",
        )
        book6 = Book(
            title="Atomowe nawyki",
            author="James Clear",
            isbn="9788328069411",
            genre="Rozwój osobisty",
            publication_year=2018,
            description="Sprawdzony sposób na budowanie dobrych nawyków i wyzbywanie się złych za pomocą drobnych zmian.",
            cover_url="/images/covers/habits.png",
        )
        db.add_all([book1, book2, book3, book4, book5, book6])
        db.flush()

        # Book Copies (different statuses for testing availability)
        copy1 = BookCopy(book_id=book1.id, inventory_number="INV-001", status="borrowed")
        copy2 = BookCopy(book_id=book1.id, inventory_number="INV-002", status="available")
        copy3 = BookCopy(book_id=book2.id, inventory_number="INV-003", status="available")
        copy4 = BookCopy(book_id=book2.id, inventory_number="INV-004", status="reserved")
        copy5 = BookCopy(book_id=book3.id, inventory_number="INV-005", status="borrowed")
        copy6 = BookCopy(book_id=book3.id, inventory_number="INV-006", status="available")
        copy7 = BookCopy(book_id=book4.id, inventory_number="INV-007", status="available")
        copy8 = BookCopy(book_id=book5.id, inventory_number="INV-008", status="available")
        copy9 = BookCopy(book_id=book5.id, inventory_number="INV-009", status="available")
        copy10 = BookCopy(book_id=book6.id, inventory_number="INV-010", status="available")
        db.add_all([copy1, copy2, copy3, copy4, copy5, copy6, copy7, copy8, copy9, copy10])
        db.flush()

        # Reservations
        now = datetime.now(timezone.utc)
        res1 = Reservation(
            user_id=reader1.id,
            book_copy_id=copy1.id,
            status="confirmed",
            reserved_at=now - timedelta(days=5),
            due_date=now + timedelta(days=9)
        )
        res2 = Reservation(
            user_id=reader1.id,
            book_copy_id=copy4.id,
            status="pending",
            reserved_at=now - timedelta(hours=3)
        )
        res3 = Reservation(
            user_id=reader2.id,
            book_copy_id=copy5.id,
            status="confirmed",
            reserved_at=now - timedelta(days=10),
            due_date=now + timedelta(days=4)
        )
        res4 = Reservation(
            user_id=reader1.id,
            book_copy_id=copy8.id,
            status="returned",
            reserved_at=now - timedelta(days=20),
            due_date=now - timedelta(days=6),
            returned_at=now - timedelta(days=8)
        )
        db.add_all([res1, res2, res3, res4])
        db.flush()

        # Reviews (only for confirmed/returned reservations)
        rev1 = Review(
            user_id=reader1.id,
            book_id=book1.id,
            reservation_id=res1.id,
            rating=5,
            comment="Świetna klasyczna powieść! Bardzo dobrze czyta się ją wieczorami."
        )
        rev2 = Review(
            user_id=reader1.id,
            book_id=book5.id,
            reservation_id=res4.id,
            rating=5,
            comment="Obowiązkowa pozycja dla każdego studenta informatyki zainteresowanego AI/ML."
        )
        rev3 = Review(
            user_id=reader2.id,
            book_id=book3.id,
            reservation_id=res3.id,
            rating=4,
            comment="Bardzo głęboka analiza ludzkiego umysłu, dużo przykładów eksperymentalnych."
        )

        # Favorites & Chat Messages
        fav1 = Favorite(user_id=reader1.id, book_id=book2.id)
        fav2 = Favorite(user_id=reader1.id, book_id=book5.id)
        fav3 = Favorite(user_id=reader2.id, book_id=book4.id)

        msg1 = ChatMessage(room_name="Klasyka", user_id=reader1.id, content="Cześć! Kto w tym semestrze czyta Lalkę?")
        msg2 = ChatMessage(room_name="Informatyka & AI", user_id=reader1.id, content="Polecam książkę Gérona o Machine Learning, są dostępne 2 egzemplarze!")
        msg3 = ChatMessage(room_name="Psychologia", user_id=reader2.id, content="Kahneman super tłumaczy błędy poznawcze, warto przeczytać.")

        db.add_all([rev1, rev2, rev3, fav1, fav2, fav3, msg1, msg2, msg3])
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Database init error: {e}")
    finally:
        db.close()
