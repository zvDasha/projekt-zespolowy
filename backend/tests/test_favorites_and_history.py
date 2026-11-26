"""Tests for /favorites and /reservations/me/history endpoints."""


def test_favorites_lifecycle(client, headers_for, make_book):
    reader1 = headers_for("reader")
    reader2 = headers_for("reader")
    book1 = make_book("Solaris", author="Stanisław Lem", copies=1)
    book2 = make_book("Lalka", author="Bolesław Prus", copies=2)

    assert client.get("/favorites", headers=reader1).json() == []
    assert client.get("/favorites/ids", headers=reader1).json() == []

    r_add = client.post(f"/favorites/{book1.id}", headers=reader1)
    assert r_add.status_code == 201
    assert r_add.json()["title"] == "Solaris"

    # Idempotent add
    assert client.post(f"/favorites/{book1.id}", headers=reader1).status_code == 201
    client.post(f"/favorites/{book2.id}", headers=reader1)

    assert set(client.get("/favorites/ids", headers=reader1).json()) == {book1.id, book2.id}
    assert len(client.get("/favorites", headers=reader1).json()) == 2

    # Separate per user
    assert client.get("/favorites", headers=reader2).json() == []

    # Remove favorite
    assert client.delete(f"/favorites/{book1.id}", headers=reader1).status_code == 204
    assert client.get("/favorites/ids", headers=reader1).json() == [book2.id]
    assert client.delete(f"/favorites/{book1.id}", headers=reader1).status_code == 404


def test_reservation_history_and_filters(client, headers_for, make_book):
    reader = headers_for("reader")
    librarian = headers_for("librarian")
    book1 = make_book("Książka 1", author="Autor 1", copies=1)
    book2 = make_book("Książka 2", author="Autor 2", copies=1)
    book3 = make_book("Książka 3", author="Autor 3", copies=1)

    # 1. Returned book with review
    res1 = client.post("/reservations", json={"book_id": book1.id}, headers=reader).json()
    client.post(f"/reservations/{res1['id']}/confirm", headers=librarian)
    client.post(f"/books/{book1.id}/reviews", json={"rating": 5, "comment": "Super"}, headers=reader)
    client.post(f"/reservations/{res1['id']}/return", headers=librarian)

    # 2. Currently borrowed book
    res2 = client.post("/reservations", json={"book_id": book2.id}, headers=reader).json()
    client.post(f"/reservations/{res2['id']}/confirm", headers=librarian)

    # 3. Cancelled reservation
    res3 = client.post("/reservations", json={"book_id": book3.id}, headers=reader).json()
    client.post(f"/reservations/{res3['id']}/cancel", headers=reader)

    history = client.get("/reservations/me/history", headers=reader)
    assert history.status_code == 200
    data = history.json()
    assert data["total"] == 3
    assert data["pending"] == 0
    assert data["borrowed"] == 1
    assert data["returned"] == 1
    assert data["cancelled"] == 1
    assert data["overdue"] == 0

    returned_only = client.get("/reservations/me", params={"status": "returned"}, headers=reader).json()
    assert len(returned_only) == 1
    assert returned_only[0]["book_title"] == "Książka 1"
    assert returned_only[0]["book_author"] == "Autor 1"
    assert returned_only[0]["has_review"] is True
    assert returned_only[0]["user_rating"] == 5

    active_only = client.get("/reservations/me", params={"status": "active"}, headers=reader).json()
    assert len(active_only) == 1
    assert active_only[0]["book_title"] == "Książka 2"
