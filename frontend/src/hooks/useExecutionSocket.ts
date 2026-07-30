import { useCallback, useRef } from 'react'
import { useGraphStore } from '../store/graphStore'
import type { ExecutionEvent } from '../types'

export function useExecutionSocket() {
  const socketRef = useRef<WebSocket | null>(null)
  const clearExecution = useGraphStore((s) => s.clearExecution)
  const setIsExecuting = useGraphStore((s) => s.setIsExecuting)
  const setActiveNodeId = useGraphStore((s) => s.setActiveNodeId)
  const addPreview = useGraphStore((s) => s.addPreview)
  const appendLog = useGraphStore((s) => s.appendLog)
  const toGraphPayload = useGraphStore((s) => s.toGraphPayload)
  const seed = useGraphStore((s) => s.seed)
  const sampleCount = useGraphStore((s) => s.sampleCount)

  const cancel = useCallback(() => {
    socketRef.current?.send(JSON.stringify({ action: 'cancel' }))
    socketRef.current?.close()
    socketRef.current = null
    setIsExecuting(false)
  }, [setIsExecuting])

  const run = useCallback(() => {
    clearExecution()
    setIsExecuting(true)

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws/execute`)
    socketRef.current = socket

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          graph: toGraphPayload(),
          seed,
          sample_count: sampleCount,
          cache: true,
        }),
      )
    }

    socket.onmessage = (message) => {
      const event = JSON.parse(message.data) as ExecutionEvent
      if (event.type === 'progress' && event.node_id) {
        setActiveNodeId(event.node_id)
        if (event.message) appendLog(event.message)
      }
      if (event.type === 'preview' && event.node_id && event.image_b64) {
        addPreview({
          nodeId: event.node_id,
          sampleIndex: event.sample_index ?? 0,
          imageB64: event.image_b64,
          portId: event.port_id,
          cacheHit: event.cache_hit,
        })
      }
      if (event.type === 'log' && event.message) appendLog(event.message)
      if (event.type === 'error') {
        appendLog(event.message ?? 'Execution failed')
        setIsExecuting(false)
        setActiveNodeId(null)
      }
      if (event.type === 'done' || event.type === 'cancelled') {
        appendLog(event.message ?? event.type)
        setIsExecuting(false)
        setActiveNodeId(null)
        socket.close()
      }
    }

    socket.onerror = () => {
      appendLog('WebSocket error')
      setIsExecuting(false)
    }

    socket.onclose = () => {
      setIsExecuting(false)
      socketRef.current = null
    }
  }, [
    addPreview,
    appendLog,
    clearExecution,
    sampleCount,
    seed,
    setActiveNodeId,
    setIsExecuting,
    toGraphPayload,
  ])

  return { run, cancel }
}

export async function requestCodegen(): Promise<string> {
  const state = useGraphStore.getState()
  const response = await fetch('/api/codegen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ graph: state.toGraphPayload(), seed: state.seed }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Codegen failed')
  }
  const payload = (await response.json()) as { code: string }
  return payload.code
}
