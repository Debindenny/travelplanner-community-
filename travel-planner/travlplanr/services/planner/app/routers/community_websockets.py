from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from shared.auth_dependencies import decode_websocket_customer_token

from .community_shared import ws_manager

router = APIRouter()


async def _reject_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.close(code=status.WS_1008_POLICY_VIOLATION)


@router.websocket("/ws/{customer_id}")
async def websocket_endpoint(websocket: WebSocket, customer_id: str):
    payload = await decode_websocket_customer_token(websocket, expected_customer_id=customer_id)
    if not payload:
        await _reject_websocket(websocket)
        return

    await ws_manager.connect(customer_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(customer_id, websocket)
