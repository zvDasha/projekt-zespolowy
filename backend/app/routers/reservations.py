from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Book, BookCopy, Reservation, User
from app.schemas import ReservationCreate, ReservationHistorySummary, ReservationResponse
from app.security import get_current_user, require_roles

router = APIRouter(prefix="/reservations", tags=["Reservations"])

staff_only = require_roles("librarian", "admin")

LOAN_DAYS = 14
ACTIVE_STATUSES = ("pending", "confirmed")
StatusFilter = Literal["pending", "confirmed", "returned", "cancelled", "active"]


def _is_overdue(r: Reservation) -> bool:
    if r.status != "confirmed" or not r.due_date:
        return False
    due = r.due_date if r.due_date.tzinfo else r.due_date.replace(tzinfo=timezone.utc)
    return due < datetime.now(timezone.utc)


def _to_response(r: Reservation) -> ReservationResponse:
    book = r.book_copy.book
    review = r.review
    return ReservationResponse(
        id=r.id,
        status=r.status,
        book_id=r.book_copy.book_id,
        book_title=book.title,
        book_author=book.author,
        book_genre=book.genre,
        book_cover_url=book.cover_url,
        inventory_number=r.book_copy.inventory_number,
        user_id=r.user_id,
        user_email=r.user.email,
        reserved_at=r.reserved_at,
        due_date=r.due_date,
        returned_at=r.returned_at,
        is_overdue=_is_overdue(r),
        has_review=review is not None,
        user_rating=review.rating if review else None,
    )


# pulls copy, book, user and review in one query
_WITH_DETAILS = (
    joinedload(Reservation.book_copy).joinedload(BookCopy.book),
    joinedload(Reservation.user),
    joinedload(Reservation.review),
)


def _apply_status_filter(query, status_filter: Optional[str]):
    if not status_filter:
        return query
    if status_filter == "active":
        return query.filter(Reservation.status.in_(ACTIVE_STATUSES))
    return query.filter(Reservation.status == status_filter)


def _get_locked_reservation(db: Session, reservation_id: int) -> Reservation:
    reservation = (
        db.query(Reservation).filter(Reservation.id == reservation_id).with_for_update().first()
    )
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    return reservation


def _require_status(reservation: Reservation, expected: str) -> None:
    if reservation.status != expected:
        raise HTTPException(
            status_code=409,
            detail=f"Reservation is '{reservation.status}', expected '{expected}'",
        )


# reader

@router.post("", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
def create_reservation(
    data: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.get(Book, data.book_id):
        raise HTTPException(status_code=404, detail="Book not found")


    db.query(User).filter(User.id == current_user.id).with_for_update().one()

    already_has = (
        db.query(Reservation)
        .join(BookCopy, Reservation.book_copy_id == BookCopy.id)
        .filter(
            Reservation.user_id == current_user.id,
            BookCopy.book_id == data.book_id,
            Reservation.status.in_(ACTIVE_STATUSES),
        )
        .first()
    )
    if already_has:
        raise HTTPException(status_code=409, detail="You already have an active reservation for this book")

    copy = (
        db.query(BookCopy)
        .filter(BookCopy.book_id == data.book_id, BookCopy.status == "available")
        .order_by(BookCopy.id)
        .with_for_update(skip_locked=True)
        .first()
    )
    if not copy:
        raise HTTPException(status_code=409, detail="No available copies")

    copy.status = "reserved"
    reservation = Reservation(
        user_id=current_user.id,
        book_copy_id=copy.id,
        status="pending",
        reserved_at=datetime.now(timezone.utc),
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)
    return _to_response(reservation)


@router.get("/me", response_model=list[ReservationResponse])
def my_reservations(
    status_filter: Optional[StatusFilter] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(Reservation)
        .options(*_WITH_DETAILS)
        .filter(Reservation.user_id == current_user.id)
    )
    query = _apply_status_filter(query, status_filter)
    reservations = query.order_by(Reservation.reserved_at.desc(), Reservation.id.desc()).all()
    return [_to_response(r) for r in reservations]


@router.get("/me/history", response_model=ReservationHistorySummary)
def my_reservation_history(
    status_filter: Optional[StatusFilter] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    all_rows = (
        db.query(Reservation)
        .options(*_WITH_DETAILS)
        .filter(Reservation.user_id == current_user.id)
        .order_by(Reservation.reserved_at.desc(), Reservation.id.desc())
        .all()
    )
    all_items = [_to_response(r) for r in all_rows]
    if status_filter == "active":
        filtered = [item for item in all_items if item.status in ACTIVE_STATUSES]
    elif status_filter:
        filtered = [item for item in all_items if item.status == status_filter]
    else:
        filtered = all_items

    return ReservationHistorySummary(
        total=len(all_items),
        pending=sum(1 for item in all_items if item.status == "pending"),
        borrowed=sum(1 for item in all_items if item.status == "confirmed"),
        returned=sum(1 for item in all_items if item.status == "returned"),
        cancelled=sum(1 for item in all_items if item.status == "cancelled"),
        overdue=sum(1 for item in all_items if item.is_overdue),
        items=filtered,
    )


@router.post("/{reservation_id}/cancel", response_model=ReservationResponse)
def cancel_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reservation = _get_locked_reservation(db, reservation_id)
    is_staff = current_user.role in ("librarian", "admin")
    if reservation.user_id != current_user.id and not is_staff:
        # 404 instead of 403: don't reveal that someone else's reservation exists
        raise HTTPException(status_code=404, detail="Reservation not found")
    _require_status(reservation, "pending")

    reservation.status = "cancelled"
    reservation.book_copy.status = "available"
    db.commit()
    db.refresh(reservation)
    return _to_response(reservation)


# librarian / admin

@router.get("", response_model=list[ReservationResponse])
def list_reservations(
    status_filter: Optional[Literal["pending", "confirmed", "returned", "cancelled"]] = Query(
        None, alias="status"
    ),
    db: Session = Depends(get_db),
    _: User = Depends(staff_only),
):
    query = db.query(Reservation).options(*_WITH_DETAILS)
    if status_filter:
        query = query.filter(Reservation.status == status_filter)
    return [_to_response(r) for r in query.order_by(Reservation.reserved_at.desc()).all()]


@router.post("/{reservation_id}/confirm", response_model=ReservationResponse)
def confirm_reservation(
    reservation_id: int, db: Session = Depends(get_db), _: User = Depends(staff_only)
):
    # Giving book to a reader
    reservation = _get_locked_reservation(db, reservation_id)
    _require_status(reservation, "pending")

    reservation.status = "confirmed"
    reservation.due_date = datetime.now(timezone.utc) + timedelta(days=LOAN_DAYS)
    reservation.book_copy.status = "borrowed"
    db.commit()
    db.refresh(reservation)
    return _to_response(reservation)


@router.post("/{reservation_id}/return", response_model=ReservationResponse)
def return_book(
    reservation_id: int, db: Session = Depends(get_db), _: User = Depends(staff_only)
):
    # Book return 
    reservation = _get_locked_reservation(db, reservation_id)
    _require_status(reservation, "confirmed")

    reservation.status = "returned"
    reservation.returned_at = datetime.now(timezone.utc)
    reservation.book_copy.status = "available"
    db.commit()
    db.refresh(reservation)
    return _to_response(reservation)