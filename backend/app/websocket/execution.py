"""WebSocket handlers for live pipeline execution."""

from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.engine.executor import CancellationToken, DagExecutor
from app.models.graph import ExecuteRequest, ExecutionEvent, ExecutionEventType
from app.nodes import register_builtin_nodes

router = APIRouter()

CACHE_DIR = Path(__file__).resolve().parents[2] / "cache"


@router.websocket("/ws/execute")
async def execute_pipeline(websocket: WebSocket) -> None:
    await websocket.accept()
    register_builtin_nodes()
    cancel = CancellationToken()
    loop = asyncio.get_running_loop()

    try:
        payload = await websocket.receive_json()
        request = ExecuteRequest.model_validate(payload)
        queue: asyncio.Queue[ExecutionEvent | None] = asyncio.Queue()

        def on_event(event: ExecutionEvent) -> None:
            loop.call_soon_threadsafe(queue.put_nowait, event)

        def run_executor() -> None:
            executor = DagExecutor(CACHE_DIR)
            try:
                executor.execute(request, on_event=on_event, cancel=cancel)
            except InterruptedError:
                on_event(ExecutionEvent(type=ExecutionEventType.CANCELLED, message="Cancelled"))
            except Exception as exc:  # noqa: BLE001
                on_event(ExecutionEvent(type=ExecutionEventType.ERROR, message=str(exc)))
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        worker = asyncio.create_task(asyncio.to_thread(run_executor))
        listener = asyncio.create_task(_listen_for_cancel(websocket, cancel))

        while True:
            event = await queue.get()
            if event is None:
                break
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_json(event.model_dump())

        cancel.cancel()
        listener.cancel()
        await worker
    except WebSocketDisconnect:
        cancel.cancel()
    except Exception as exc:  # noqa: BLE001
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_json(
                ExecutionEvent(type=ExecutionEventType.ERROR, message=str(exc)).model_dump()
            )


async def _listen_for_cancel(websocket: WebSocket, cancel: CancellationToken) -> None:
    try:
        while True:
            message = await websocket.receive_json()
            if message.get("action") == "cancel":
                cancel.cancel()
                return
    except WebSocketDisconnect:
        cancel.cancel()
