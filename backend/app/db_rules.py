from sqlalchemy import text
from sqlalchemy.engine import Engine

REVIEW_REQUIRES_RESERVATION = """
CREATE OR REPLACE FUNCTION review_requires_confirmed_reservation() RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM reservations r
        JOIN book_copies c ON c.id = r.book_copy_id
        WHERE r.id = NEW.reservation_id
          AND r.user_id = NEW.user_id
          AND c.book_id = NEW.book_id
          AND r.status IN ('confirmed', 'returned')
    ) THEN
        RAISE EXCEPTION 'Review requires a confirmed reservation of this book by this user'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


def install_db_rules(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(text(REVIEW_REQUIRES_RESERVATION))
        conn.execute(text("DROP TRIGGER IF EXISTS trg_review_requires_reservation ON reviews"))
        conn.execute(text("""
            CREATE TRIGGER trg_review_requires_reservation
            BEFORE INSERT OR UPDATE OF reservation_id, user_id, book_id ON reviews
            FOR EACH ROW EXECUTE FUNCTION review_requires_confirmed_reservation()
        """))