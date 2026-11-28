from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
connections = set()

@router.websocket("/ws")
async def updates(websocket: WebSocket):
    await websocket.accept()
    connections.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        connections.discard(websocket)

async def notify_changes(request, call_next):
    response = await call_next(request)
    # Powiadomienie dopiero po udanym zapisie. Dane nadal pobieramy przez API.
    section = request.url.path.strip("/").split("/")[0]
    if (request.method in ("POST", "PATCH", "PUT", "DELETE")
            and response.status_code < 300
            and section in ("books", "reservations", "chat")):
        for websocket in list(connections):
            try:
                await websocket.send_json({"type": "update"})
            except (WebSocketDisconnect, RuntimeError, OSError):
                connections.discard(websocket)
    return response
