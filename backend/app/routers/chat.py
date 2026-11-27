from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import ChatMessage, ChatRoom, User
from app.schemas import (
    ChatMessageCreate,
    ChatMessageResponse,
    ChatRoomCreate,
    ChatRoomResponse,
)
from app.security import get_current_user

router = APIRouter(prefix="/chat", tags=["Chat Rooms"])


def _seed_default_rooms_if_needed(db: Session) -> None:
  """Tworzy podstawowe pokoje na bazie istniejących wiadomości lub domyślnych tematów."""
  if db.query(ChatRoom).first():
    return

  existing_names = [
      name
      for (name,) in db.query(ChatMessage.room_name).distinct().all()
      if name
  ]
  defaults = existing_names or ["Klasyka", "Informatyka & AI", "Psychologia"]
  topics_map = {
      "Klasyka": "Literatura klasyczna",
      "Informatyka & AI": "Programowanie i sztuczna inteligencja",
      "Psychologia": "Psychologia i rozwój",
  }

  rooms = []
  for name in defaults:
    rooms.append(
        ChatRoom(
            name=name,
            topic=topics_map.get(name, "Dyskusje czytelnicze"),
            description=f"Pokój tematyczny dla osób zainteresowanych tematem: {name}.",
        )
    )
  db.add_all(rooms)
  db.commit()

  for room in db.query(ChatRoom).all():
    db.query(ChatMessage).filter(
        ChatMessage.room_name == room.name, ChatMessage.room_id.is_(None)
    ).update({"room_id": room.id})
  db.commit()


def _room_to_response(room: ChatRoom, messages_count: int) -> ChatRoomResponse:
  return ChatRoomResponse(
      id=room.id,
      name=room.name,
      topic=room.topic,
      description=room.description,
      created_by_name=room.created_by.full_name if room.created_by else None,
      messages_count=messages_count,
      created_at=room.created_at,
  )


def _message_to_response(msg: ChatMessage) -> ChatMessageResponse:
  return ChatMessageResponse(
      id=msg.id,
      room_id=msg.room_id,
      room_name=msg.room_name,
      user_id=msg.user_id,
      user_name=msg.user.full_name if msg.user else "Użytkownik",
      user_role=msg.user.role if msg.user else "reader",
      content=msg.content,
      created_at=msg.created_at,
  )


@router.get("/rooms", response_model=list[ChatRoomResponse])
def list_rooms(
    q: str | None = Query(None, max_length=100),
    db: Session = Depends(get_db),
):
  _seed_default_rooms_if_needed(db)
  query = db.query(ChatRoom).options(joinedload(ChatRoom.created_by))
  if q and q.strip():
    pattern = f"%{q.strip()}%"
    query = query.filter(
        ChatRoom.name.ilike(pattern)
        | ChatRoom.topic.ilike(pattern)
        | ChatRoom.description.ilike(pattern)
    )
  rooms = query.order_by(ChatRoom.id.asc()).all()

  counts = dict(
      db.query(ChatMessage.room_name, func.count(ChatMessage.id))
      .group_by(ChatMessage.room_name)
      .all()
  )
  return [_room_to_response(r, counts.get(r.name, 0)) for r in rooms]


@router.post(
    "/rooms", response_model=ChatRoomResponse, status_code=status.HTTP_201_CREATED
)
def create_room(
    data: ChatRoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
  _seed_default_rooms_if_needed(db)
  clean_name = data.name.strip()
  clean_topic = data.topic.strip()
  clean_desc = data.description.strip() if data.description else None

  duplicate = (
      db.query(ChatRoom).filter(func.lower(ChatRoom.name) == clean_name.lower()).first()
  )
  if duplicate:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Pokój o tej nazwie już istnieje.",
    )

  room = ChatRoom(
      name=clean_name,
      topic=clean_topic,
      description=clean_desc,
      created_by_id=current_user.id,
  )
  db.add(room)
  db.commit()
  db.refresh(room)
  return _room_to_response(room, 0)


@router.get("/rooms/{room_id}/messages", response_model=list[ChatMessageResponse])
def get_room_messages(room_id: int, db: Session = Depends(get_db)):
  _seed_default_rooms_if_needed(db)
  room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
  if not room:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Pokój nie istnieje."
    )

  messages = (
      db.query(ChatMessage)
      .options(joinedload(ChatMessage.user))
      .filter(
          (ChatMessage.room_id == room.id) | (ChatMessage.room_name == room.name)
      )
      .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
      .all()
  )
  return [_message_to_response(m) for m in messages]


@router.post(
    "/rooms/{room_id}/messages",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_room_message(
    room_id: int,
    data: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
  _seed_default_rooms_if_needed(db)
  room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
  if not room:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Pokój nie istnieje."
    )

  content = data.content.strip()
  if not content:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Wiadomość nie może być pusta.",
    )

  message = ChatMessage(
      room_id=room.id,
      room_name=room.name,
      user_id=current_user.id,
      content=content,
  )
  db.add(message)
  db.commit()
  db.refresh(message)
  return _message_to_response(message)