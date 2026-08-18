"""
Admin-only WebSocket for real-time dashboard metrics.

Consumers (identity/planner/affiliate) call `broadcast_dashboard_update`
after committing a metric change so the admin dashboard can refetch instead
of waiting for its poll interval. The socket carries no payload beyond an
event name — the dashboard re-calls its existing REST endpoints, so this
never duplicates the aggregation logic that already lives there.
"""

from __future__ import annotations

import json
import logging
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import jwt

router = APIRouter(prefix="/ws", tags=["websocket"])
logger = logging.getLogger(__name__)

_admin_connections: Set[WebSocket] = set()


@router.websocket("")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """Staff-only socket. The client must pass `?token=JWT` in the query string."""
    try:
        settings = websocket.app.state.settings
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except Exception as e:
        logger.warning(f"Reporting WebSocket auth failed: {e}")
        await websocket.close(code=1008)
        return

    if claims.get("user_kind") != "staff":
        await websocket.close(code=1008)
        return

    await websocket.accept()
    _admin_connections.add(websocket)
    try:
        while True:
            # No client->server messages expected; just keep the connection alive.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _admin_connections.discard(websocket)


async def broadcast_dashboard_update(event_type: str) -> None:
    """Notify every connected admin session that dashboard metrics changed."""
    if not _admin_connections:
        return
    message = json.dumps({"type": event_type})
    dead: Set[WebSocket] = set()
    for ws in _admin_connections:
        try:
            await ws.send_text(message)
        except Exception:
            dead.add(ws)
    _admin_connections.difference_update(dead)
