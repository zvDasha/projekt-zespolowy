"""Tests for /books/scan-cover OCR and fuzzy title matching."""

import io
from PIL import Image, ImageDraw


def _make_cover_image(text: str) -> bytes:
    img = Image.new("RGB", (500, 200), color="white")
    draw = ImageDraw.Draw(img)
    draw.text((30, 80), text, fill="black")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_scan_cover_matches_noisy_text_and_diacritics(client, make_book):
    make_book("Pułapki myślenia. O myśleniu szybkim i wolnym", author="Daniel Kahneman", copies=1)
    make_book("Solaris", author="Stanisław Lem", copies=2)
    make_book("Lalka", author="Bolesław Prus", copies=1)

    r = client.post(
        "/books/scan-cover",
        data={"query": "WYDAWNICTWO LITERACKIE STANISLAW LEM SOLARIS BESTSELLER"},
    )
    assert r.status_code == 200
    matches = r.json()["matches"]
    assert len(matches) >= 1
    assert matches[0]["book"]["title"] == "Solaris"
    assert matches[0]["score"] >= 0.7


def test_scan_cover_with_image_upload(client, make_book):
    make_book("Clean Code. Czysty kod", author="Robert C. Martin", copies=1)
    make_book("Solaris", author="Stanisław Lem", copies=1)

    image_bytes = _make_cover_image("CLEAN CODE ROBERT MARTIN")
    r = client.post(
        "/books/scan-cover",
        files={"file": ("cover.png", image_bytes, "image/png")},
    )
    assert r.status_code == 200
    body = r.json()
    assert "CLEAN" in body["extracted_text"].upper()
    assert body["matches"][0]["book"]["title"] == "Clean Code. Czysty kod"


def test_scan_cover_rejects_empty_request_or_invalid_format(client):
    assert client.post("/books/scan-cover").status_code == 400
    r = client.post(
        "/books/scan-cover",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 400
