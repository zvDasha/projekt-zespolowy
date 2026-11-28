from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.init_db import init_database
from app import realtime
from app.routers import auth, users, books, reservations, reviews, book_import, favorites, cover_scan, chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_database()
    yield


app = FastAPI(title="Library AI API", lifespan=lifespan)
app.middleware("http")(realtime.notify_changes)
app.include_router(realtime.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(cover_scan.router)
app.include_router(books.router)
app.include_router(reservations.router)
app.include_router(reviews.router)
app.include_router(book_import.router)
app.include_router(favorites.router)
app.include_router(chat.router)


@app.get("/health")
def health():
    return {"status": "ok"}
