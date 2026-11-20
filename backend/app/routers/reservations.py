from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Book, BookCopy, Reservation, User
from app.schemas import ReservationCreate, ReservationResponse
from app.security import get_current_user, require_roles

router = APIRouter(prefix="/reservations", tags=["Reservations"])

staff_only = require_roles("librarian", "admin")

LOAN_DAYS = 14
ACTIVE_STATUSES = ("pending", "confirmed")



def _to_response(r: Reservation) -> ReservationResponse:
    return ReservationResponse(
        id=r.id,
        status=r.status,
        book_id=r.book_copy.book_id,
        book_title=r.book_copy.book.title,
        inventory_number=r.book_copy.inventory_number,
        user_id=r.user_id,
        user_email=r.user.email,
        reserved_at=r.reserved_at,
        due_date=r.due_date,
        returned_at=r.returned_at,
    )


# pulls copy, book and user in one query
_WITH_DETAILS = (
    joinedload(Reservation.book_copy).joinedload(BookCopy.book),
    joinedload(Reservation.user),
)


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
def my_reservations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    #Current user's reservation history
    reservations = (
        db.query(Reservation)
        .options(*_WITH_DETAILS)
        .filter(Reservation.user_id == current_user.id)
        .order_by(Reservation.reserved_at.desc(), Reservation.id.desc())
        .all()
    )
    return [_to_response(r) for r in reservations]


@router.post("/{reservation_id}/cancel", response_model=ReservationResponse)
def cancel_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reservation = _get_locked_reservation(db, reservation_id)
    is_staff = current_user.role in ("librarian", "admin")
    if reservation.user_id != current_user.id and not is_staff:
        # 404 instead of 403: don't reveal that someone else's reservation exists        raise HTTPException(status_code=404, detail="Reservation not found")
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