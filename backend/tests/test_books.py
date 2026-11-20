"""Minimalny zestaw: uprawnienia, zapis, ochrona historii, wyszukiwanie, sortowanie, paginacja."""

NEW_BOOK = {"title": "Solaris", "author": "Lem", "isbn": "978-83-000-0000-1",
            "genre": "Fantastyka", "publication_year": 1961, "copies": 2}


def test_reader_cannot_create_book(client, headers_for):
    assert client.post("/books", json=NEW_BOOK, headers=headers_for("reader")).status_code == 403


def test_librarian_creates_book_with_copies(client, headers_for):
    r = client.post("/books", json=NEW_BOOK, headers=headers_for("librarian"))
    assert r.status_code == 201
    assert r.json()["isbn"] == "9788300000001"
    assert r.json()["publication_year"] == 1961
    assert r.json()["available_copies"] == 2


def test_duplicate_isbn_returns_409(client, headers_for, make_book):
    make_book("Istniejąca", isbn="9788300000001")
    assert client.post("/books", json=NEW_BOOK, headers=headers_for("librarian")).status_code == 409


def test_cannot_delete_book_with_reservation_history(client, headers_for, make_book):
    book = make_book("Z historią", ratings=(5,))
    assert client.delete(f"/books/{book.id}", headers=headers_for("librarian")).status_code == 409


def test_search_and_filters(client, make_book):
    make_book("Solaris", author="Stanisław Lem", copies=1)
    make_book("Cyberiada", author="Stanisław Lem")  # brak egzemplarzy
    make_book("Lalka", author="Bolesław Prus", copies=1)
    r = client.get("/books", params={"q": "LEM", "available_only": True})
    assert [b["title"] for b in r.json()["items"]] == ["Solaris"]


def test_sort_by_rating_puts_unrated_last(client, make_book):
    make_book("Średnia", ratings=(3,))
    make_book("Bez ocen")
    make_book("Najlepsza", ratings=(5, 4))
    r = client.get("/books", params={"sort": "-rating"})
    assert [b["title"] for b in r.json()["items"]] == ["Najlepsza", "Średnia", "Bez ocen"]
    assert r.json()["items"][0]["average_rating"] == 4.5


def test_pagination(client, make_book):
    for i in range(5):
        make_book(f"Książka {i}")
    body = client.get("/books", params={"page_size": 2, "page": 3}).json()
    assert body["total"] == 5 and body["pages"] == 3 and len(body["items"]) == 1
