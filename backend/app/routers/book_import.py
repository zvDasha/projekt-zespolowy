import csv
import io
from typing import Any, Iterator

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from openpyxl import load_workbook
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Book, User
from app.routers.books import _new_copies
from app.schemas import BookCreate, ImportResult, ImportRowError
from app.security import require_roles

router = APIRouter(prefix="/books/import", tags=["Import"])

staff_only = require_roles("librarian", "admin")

MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_ROWS = 5000
COLUMNS = ["title", "author", "isbn", "genre", "publication_year", "description", "cover_url", "copies"]
REQUIRED = {"title", "author", "isbn", "genre"}
DEFAULT_COPIES = 1 



def _decode_csv(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1250"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise HTTPException(status_code=400, detail="Unsupported file encoding (use UTF-8)")


def _read_csv(raw: bytes) -> Iterator[list[Any]]:
    text = _decode_csv(raw)
    try:
        # Polish Excel saves CSV with semicolons, the rest of the world with commas
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;")
    except csv.Error:
        dialect = csv.excel
    yield from csv.reader(io.StringIO(text), dialect)


def _read_xlsx(raw: bytes) -> Iterator[list[Any]]:
    try:
        workbook = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    except Exception:
        raise HTTPException(status_code=400, detail="File is not a valid .xlsx workbook")
    for row in workbook.active.iter_rows(values_only=True):
        yield list(row)


def _clean(value: Any) -> Any:
    """Excel returns ISBN as a number (9788373271890.0) and empty cells as None or ''."""
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    value = str(value).strip()
    return value or None


def _format_validation_error(e: ValidationError) -> str:
    return "; ".join(f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in e.errors())


# endpoints 
@router.get("/template")
def download_template(_: User = Depends(staff_only)):
    """CSV with the correct headers and one example row."""
    example = "Cyberiada,Stanisław Lem,9788308049068,Fantastyka,1965,Zbiór opowiadań o robotach-konstruktorach,,2"
    content = ",".join(COLUMNS) + "\n" + example + "\n"
    return Response(
        content=content.encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="books_template.csv"'},
    )


@router.post("", response_model=ImportResult)
async def import_books(
    file: UploadFile = File(..., description=".csv or .xlsx file with books"),
    dry_run: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(staff_only),
):
    raw = await file.read()
    if len(raw) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 5 MB)")

    filename = (file.filename or "").lower()
    if filename.endswith(".csv"):
        rows = _read_csv(raw)
    elif filename.endswith(".xlsx"):
        rows = _read_xlsx(raw)
    else:
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported")

    header = [str(h).strip().lower() if h is not None else "" for h in next(rows, [])]
    missing = REQUIRED - set(header)
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(sorted(missing))}")

    errors: list[ImportRowError] = []
    valid: list[tuple[int, BookCreate]] = []
    seen_isbns: set[str] = set()

    for row_number, row in enumerate(rows, start=2):
        if row_number - 1 > MAX_ROWS:
            raise HTTPException(status_code=413, detail=f"Too many rows (max {MAX_ROWS})")
        values = {col: _clean(v) for col, v in zip(header, row) if col in COLUMNS}
        if not any(values.values()):
            continue  # empty line
        if values.get("copies") is None:
            values["copies"] = DEFAULT_COPIES

        try:
            book = BookCreate(**values)  
        except ValidationError as e:
            errors.append(ImportRowError(row=row_number, isbn=values.get("isbn"),
                                         message=_format_validation_error(e)))
            continue

        if book.isbn in seen_isbns:
            errors.append(ImportRowError(row=row_number, isbn=book.isbn,
                                         message="Duplicate ISBN within the file"))
            continue
        seen_isbns.add(book.isbn)
        valid.append((row_number, book))

    existing = {
        isbn for (isbn,) in db.query(Book.isbn).filter(Book.isbn.in_(seen_isbns)).all()
    } if seen_isbns else set()

    created = 0
    for row_number, data in valid:
        if data.isbn in existing:
            errors.append(ImportRowError(row=row_number, isbn=data.isbn,
                                         message="Book with this ISBN already exists"))
            continue
        book = Book(**data.model_dump(exclude={"copies"}))
        db.add(book)
        db.flush()
        db.add_all(_new_copies(book.id, data.copies))
        created += 1

    if dry_run:
        db.rollback()
    else:
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Import conflicted with concurrent changes, try again")

    errors.sort(key=lambda e: e.row)
    return ImportResult(dry_run=dry_run, created=created, skipped=len(errors), errors=errors)