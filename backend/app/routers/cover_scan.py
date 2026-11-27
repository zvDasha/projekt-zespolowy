import io
import re
from difflib import SequenceMatcher
from typing import Optional

import pytesseract
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image, ImageOps
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Book
from app.routers.books import _to_detail
from app.schemas import CoverMatchItem, CoverScanResponse

router = APIRouter(prefix="/books", tags=["Cover Scanner"])

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
POLISH_MAP = str.maketrans("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ", "acelnoszzacelnoszz")


def _normalize(text: str) -> str:
    cleaned = text.translate(POLISH_MAP).lower()
    return re.sub(r"[^a-z0-9\s]", " ", cleaned).strip()


def _tokens(text: str) -> list[str]:
    return [word for word in _normalize(text).split() if len(word) >= 3]


def _extract_text_from_image(raw: bytes) -> str:
    try:
        image = Image.open(io.BytesIO(raw))
        gray = ImageOps.grayscale(image)
        enhanced = ImageOps.autocontrast(gray)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    try:
        text = pytesseract.image_to_string(enhanced, lang="pol+eng")
    except Exception:
        text = pytesseract.image_to_string(enhanced)
    return text.strip()


def _suggest_query(text: str, matches: list[CoverMatchItem]) -> str:
    if matches:
        return matches[0].book.title
    for line in text.splitlines():
        cleaned = line.strip()
        if len(_normalize(cleaned)) >= 3:
            return cleaned[:100]
    return text[:100].strip()


def _token_match_ratio(target_tokens: list[str], ocr_tokens: list[str]) -> float:
    if not target_tokens or not ocr_tokens:
        return 0.0
    matched = 0.0
    for target in target_tokens:
        best = max((SequenceMatcher(None, target, word).ratio() for word in ocr_tokens), default=0.0)
        if best >= 0.8:
            matched += best
    return matched / len(target_tokens)


def _score_book(ocr_text: str, ocr_tokens: list[str], book: Book) -> float:
    norm_ocr = _normalize(ocr_text)
    if not norm_ocr:
        return 0.0

    # 1. Exact ISBN match inside scanned text
    digits_only = re.sub(r"[^0-9xX]", "", ocr_text).upper()
    if book.isbn and book.isbn in digits_only:
        return 1.0

    norm_title = _normalize(book.title)
    norm_author = _normalize(book.author)

    # 2. Direct substring match of title or author
    title_in_ocr = 0.85 if (len(norm_title) >= 4 and norm_title in norm_ocr) else 0.0

    # 3. Word-level fuzzy match for title and author
    title_score = _token_match_ratio(_tokens(book.title), ocr_tokens)
    author_score = _token_match_ratio(_tokens(book.author), ocr_tokens)
    seq_score = SequenceMatcher(None, norm_title, norm_ocr[: len(norm_title) + 40]).ratio()

    combined = max(title_in_ocr, title_score * 0.75 + author_score * 0.25, title_score * 0.85)
    if author_score >= 0.5 and title_score >= 0.4:
        combined = min(1.0, combined + 0.15)
    if combined < 0.35 and author_score >= 0.75:
        combined = author_score * 0.65
    return round(max(combined, seq_score * 0.6), 2)


def _find_matching_books(db: Session, text: str, limit: int = 6) -> list[CoverMatchItem]:
    ocr_tokens = _tokens(text)
    if not _normalize(text):
        return []

    books = db.query(Book).options(joinedload(Book.copies), joinedload(Book.reviews)).all()
    scored: list[CoverMatchItem] = []

    for book in books:
        score = _score_book(text, ocr_tokens, book)
        if score >= 0.35:
            scored.append(CoverMatchItem(book=_to_detail(book), score=score))

    scored.sort(key=lambda item: (item.score, item.book.available_copies), reverse=True)
    return scored[:limit]


@router.post("/scan-cover", response_model=CoverScanResponse)
async def scan_book_cover(
    file: Optional[UploadFile] = File(None),
    query: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    if file is None and not (query and query.strip()):
        raise HTTPException(status_code=400, detail="Provide an image file or search text")

    extracted = ""
    if file is not None:
        if file.content_type and file.content_type not in ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail="Only JPG, PNG and WebP images are supported")
        raw = await file.read()
        if not raw or len(raw) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")
        extracted = _extract_text_from_image(raw)

    search_text = (query.strip() if query and query.strip() else extracted)
    matches = _find_matching_books(db, search_text)

    return CoverScanResponse(
        extracted_text=extracted or search_text,
        suggested_query=_suggest_query(search_text, matches),
        matches=matches,
    )
