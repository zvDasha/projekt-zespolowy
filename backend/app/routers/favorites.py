from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Book, Favorite, User
from app.routers.books import _get_book_or_404, _to_detail
from app.schemas import BookDetailResponse
from app.security import get_current_user

router = APIRouter(prefix="/favorites", tags=["Favorites"])


def _get_favorite(db: Session, user_id: int, book_id: int) -> Favorite | None:
    return (
        db.query(Favorite)
        .filter(Favorite.user_id == user_id, Favorite.book_id == book_id)
        .first()
    )


@router.get("", response_model=list[BookDetailResponse])
def list_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    favorites = (
        db.query(Favorite)
        .options(joinedload(Favorite.book).joinedload(Book.copies), joinedload(Favorite.book).joinedload(Book.reviews))
        .filter(Favorite.user_id == current_user.id)
        .order_by(Favorite.book_id.desc())
        .all()
    )
    return [_to_detail(fav.book) for fav in favorites if fav.book]


@router.get("/ids", response_model=list[int])
def list_favorite_ids(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(Favorite.book_id)
        .filter(Favorite.user_id == current_user.id)
        .order_by(Favorite.book_id.desc())
        .all()
    )
    return [book_id for (book_id,) in rows]


@router.post("/{book_id}", response_model=BookDetailResponse, status_code=status.HTTP_201_CREATED)
def add_favorite(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = _get_book_or_404(db, book_id)
    if not _get_favorite(db, current_user.id, book_id):
        db.add(Favorite(user_id=current_user.id, book_id=book_id))
        db.commit()
    return _to_detail(book)


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    favorite = _get_favorite(db, current_user.id, book_id)
    if not favorite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    db.delete(favorite)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
