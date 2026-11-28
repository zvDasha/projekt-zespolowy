from unittest.mock import patch

from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

from app.init_db import update_chat_schema
from app.models import User
from app.security import hash_password


def test_old_chat_schema_keeps_messages(engine):
    # Tabele tymczasowe udają starą bazę, bez zmieniania tabel aplikacji.
    temporary = create_engine(engine.url, poolclass=NullPool)
    with temporary.connect() as conn:
        conn.execute(text("CREATE TEMP TABLE chat_rooms (id INTEGER PRIMARY KEY, name TEXT)"))
        conn.execute(text("CREATE TEMP TABLE chat_messages (id INTEGER, room_name TEXT, content TEXT)"))
        conn.execute(text("INSERT INTO chat_rooms VALUES (1, 'Klasyka')"))
        conn.execute(text("INSERT INTO chat_messages VALUES (1, 'Klasyka', 'Stara wiadomość')"))
        conn.commit()
        update_chat_schema(conn)
        update_chat_schema(conn)
        row = conn.execute(text("SELECT room_id, content FROM chat_messages")).one()
        assert row == (1, "Stara wiadomość")
    temporary.dispose()


def test_chat_and_reservations_notify_both_clients(client, headers_for, make_book):
    reader = headers_for("reader")
    staff = headers_for("librarian")
    book = make_book("WebSocket", copies=1)
    # Fixture ma własną bazę; nie uruchamiamy inicjalizacji bazy aplikacji.
    with patch("app.main.init_database"), client:
        with client.websocket_connect("/ws") as first, client.websocket_connect("/ws") as second:
            room = client.get("/chat/rooms").json()[0]
            message = client.post(f'/chat/rooms/{room["id"]}/messages', headers=reader,
                                  json={"content": "Cześć!"})
            assert message.status_code == 201
            assert first.receive_json() == second.receive_json() == {"type": "update"}
            assert client.get(f'/chat/rooms/{room["id"]}/messages').json()[-1]["content"] == "Cześć!"
            assert client.post(f'/chat/rooms/{room["id"]}/messages', json={"content": "Test"}).status_code == 401

            reservation = client.post("/reservations", headers=reader, json={"book_id": book.id})
            assert reservation.status_code == 201
            assert first.receive_json() == second.receive_json() == {"type": "update"}
            assert client.get(f"/books/{book.id}").json()["available_copies"] == 0
            for action in ("confirm", "return"):
                assert client.post(f'/reservations/{reservation.json()["id"]}/{action}', headers=staff).status_code == 200
                assert first.receive_json() == second.receive_json() == {"type": "update"}
            assert client.get(f"/books/{book.id}").json()["available_copies"] == 1


def test_login_and_google_token_checked_once(client, db):
    db.add(User(email="login@example.com", full_name="Test", password_hash=hash_password("haslo123")))
    db.commit()
    response = client.post("/auth/login", data={"username": "login@example.com", "password": "haslo123"})
    assert response.status_code == 200
    assert client.get("/auth/me", headers={"Authorization": "Bearer " + response.json()["access_token"]}).status_code == 200
    assert client.post("/auth/login", data={"username": "login@example.com", "password": "wrong"}).status_code == 401
    with patch("app.routers.auth.google_id_token.verify_oauth2_token", return_value={
        "sub": "google-test", "email": "google@example.com", "name": "Google Test",
    }) as verify:
        assert client.post("/auth/google", json={"id_token": "test-token"}).status_code == 200
        verify.assert_called_once()
