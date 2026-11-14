from fastapi import FastAPI

app = FastAPI(title="API")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/books/{book_id}")
def get_book(book_id: int):
    return {"id": book_id, "title": "Lalka"}