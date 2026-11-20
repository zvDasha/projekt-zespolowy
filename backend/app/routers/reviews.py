from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Book, BookCopy, Reservation, Review, User
from app.schemas import ReviewCreate, ReviewResponse
from app.security import get_current_user

router = APIRouter(prefix="/books", tags=["Reviews"])

# reservation statuses that allow reviewing (book was handed to the reader)
REVIEWABLE_STATUSES = ("confirmed", "returned")


def _to_response(review: Review) -> ReviewResponse:
    return ReviewResponse(
        id=review.id,
        book_id=review.book_id,
        user_id=review.user_id,
        user_name=review.user.full_name,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
    )


@router.get("/{book_id}/reviews", response_model=list[ReviewResponse])
def list_reviews(book_id: int, db: Session = Depends(get_db)):
    if not db.get(Book, book_id):
        raise HTTPException(status_code=404, detail="Book not found")
    reviews = (
        db.query(Review)
        .options(joinedload(Review.user))
        .filter(Review.book_id == book_id)
        .order_by(Review.created_at.desc())
        .all()
    )
    return [_to_response(r) for r in reviews]


@router.post(
    "/{book_id}/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED
)
def create_review(
    book_id: int,
    data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.get(Book, book_id):
        raise HTTPException(status_code=404, detail="Book not found")

    # Layer 1 (backend): clear error message for the user.
    reservation = (
        db.query(Reservation)
        .join(BookCopy, Reservation.book_copy_id == BookCopy.id)
        .filter(
            Reservation.user_id == current_user.id,
            BookCopy.book_id == book_id,
            Reservation.status.in_(REVIEWABLE_STATUSES),
        )
        .order_by(Reservation.reserved_at.desc())
        .first()
    )
    if not reservation:
        raise HTTPException(
            status_code=403, detail="You can review a book only after your reservation is confirmed"
        )

    existing = (
        db.query(Review)
        .filter(Review.user_id == current_user.id, Review.book_id == book_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You have already reviewed this book")

    review = Review(
        user_id=current_user.id,
        book_id=book_id,
        reservation_id=reservation.id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)
    # Layer 2 (database): trigger + unique constraints.
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Review could not be saved")
    db.refresh(review)
    return _to_response(review)