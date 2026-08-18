from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
import json
import asyncio
from typing import Dict, Set
from shared.auth_dependencies import decode_websocket_customer_token

router = APIRouter(prefix="/ws", tags=["websocket"])
logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        logger.info(f"User {user_id} connected. Total active sessions: {len(self.active_connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
            logger.info(f"User {user_id} disconnected.")

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            text_data = json.dumps(message)
            dead_sockets = set()
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(text_data)
                except Exception as e:
                    logger.error(f"Error sending message to {user_id}: {e}")
                    dead_sockets.add(connection)
            
            for ds in dead_sockets:
                self.disconnect(ds, user_id)

manager = ConnectionManager()

# --- Live "who's viewing this trip" presence -------------------------------
# In-memory only (no DB), since presence is inherently ephemeral — it's
# rebuilt from scratch as clients (re)join. trip_id -> {user_id: name}.
_trip_presence: Dict[str, Dict[str, str]] = {}
# Bookkeeping so disconnect can clean up every trip a socket had joined.
_socket_trips: Dict[WebSocket, Set[str]] = {}


async def _broadcast_presence(trip_id: str) -> None:
    viewers = [
        {"user_id": uid, "name": name} for uid, name in _trip_presence.get(trip_id, {}).items()
    ]
    for uid in list(_trip_presence.get(trip_id, {}).keys()):
        await manager.send_personal_message(
            {"type": "trip_presence", "payload": {"trip_id": trip_id, "viewers": viewers}}, uid
        )


def _presence_leave(websocket: WebSocket, user_id: str, trip_id: str) -> None:
    _trip_presence.get(trip_id, {}).pop(user_id, None)
    _socket_trips.get(websocket, set()).discard(trip_id)


@router.websocket("")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time notifications, DMs, and trip presence.
    The client must pass `?token=JWT` in the query string.
    """
    user = await decode_websocket_customer_token(websocket)
    if not user:
        await websocket.close(code=1008)
        return

    user_id = str(user.get("sub", ""))
    if not user_id:
        await websocket.close(code=1008)
        return
    await manager.connect(websocket, user_id)
    _socket_trips[websocket] = set()

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except Exception:
                continue

            msg_type = msg.get("type")
            payload = msg.get("payload") or {}
            trip_id = payload.get("trip_id")
            if not trip_id:
                continue

            if msg_type == "presence_join":
                name = str(payload.get("name") or "Someone")[:255]
                _trip_presence.setdefault(trip_id, {})[user_id] = name
                _socket_trips[websocket].add(trip_id)
                await _broadcast_presence(trip_id)
            elif msg_type == "presence_leave":
                _presence_leave(websocket, user_id, trip_id)
                await _broadcast_presence(trip_id)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, user_id)
        for trip_id in list(_socket_trips.pop(websocket, set())):
            _trip_presence.get(trip_id, {}).pop(user_id, None)
            await _broadcast_presence(trip_id)

# Helper function to broadcast events to a specific user (can be called by other routes)
async def broadcast_to_user(user_id: str, event_type: str, payload: dict):
    message = {
        "type": event_type,
        "payload": payload
    }
    await manager.send_personal_message(message, user_id)
