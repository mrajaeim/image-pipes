import { useCallback, useRef } from 'react'
import { useGraphStore } from '../store/graphStore'
import { notifyError, notifyInfo, notifySuccess } from '../notify'
import type { ExecutionEvent } from '../types'

export type RunOptions = {
  targetNodeId?: string
}

type Runner = (options?: RunOptions) => void

let sharedRunner: Runner | null = null

/** Bind the App-level socket runner so menus can trigger targeted runs. */
export function bindExecutionRunner(run: Runner) {
  sharedRunner = run
  return () => {
    if (sharedRunner === run) sharedRunner = null
  }
}

export function runPipeline(options?: RunOptions) {
  if (!sharedRunner) {
    throw new Error('Execution runner is not ready')
  }
  sharedRunner(options)
}

export function useExecutionSocket() {
  const socketRef = useRef<WebSocket | null>(null)
  const clearExecution = useGraphStore((s) => s.clearExecution)
  const setIsExecuting = useGraphStore((s) => s.setIsExecuting)
  const setActiveNodeId = useGraphStore((s) => s.setActiveNodeId)
  const addPreview = useGraphStore((s) => s.addPreview)
  const appendLog = useGraphStore((s) => s.appendLog)
  const setNodeTiming = useGraphStore((s) => s.setNodeTiming)
  const toGraphPayload = useGraphStore((s) => s.toGraphPayload)
  const seed = useGraphStore((s) => s.seed)
  const iterationCount = useGraphStore((s) => s.iterationCount)
  const targetLabelRef = useRef<string | null>(null)

  const cancel = useCallback(() => {
    socketRef.current?.send(JSON.stringify({ action: 'cancel' }))
    socketRef.current?.close()
    socketRef.current = null
    setIsExecuting(false)
    notifyInfo('Pipeline cancelled')
  }, [setIsExecuting])

  const run = useCallback(
    (options?: RunOptions) => {
      clearExecution()
      setIsExecuting(true)
      targetLabelRef.current = options?.targetNodeId ?? null

      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const socket = new WebSocket(`${protocol}://${window.location.host}/ws/execute`)
      socketRef.current = socket

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            graph: toGraphPayload(),
            seed,
            sample_count: iterationCount,
            cache: true,
            ...(options?.targetNodeId
              ? { target_node_id: options.targetNodeId }
              : {}),
          }),
        )
      }

      socket.onmessage = (message) => {
        const event = JSON.parse(message.data) as ExecutionEvent
        if (event.type === 'progress' && event.node_id) {
          setActiveNodeId(event.node_id)
          if (event.duration_ms != null) {
            setNodeTiming(event.node_id, {
              ms: event.duration_ms,
              cacheHit: Boolean(event.cache_hit),
            })
            appendLog(
              event.message ??
                `${event.node_id} ${event.duration_ms.toFixed(1)}ms` +
                  (event.cache_hit ? ' (cache)' : ''),
            )
          } else if (event.message) {
            appendLog(event.message)
          }
        }
        if (event.type === 'preview' && event.node_id) {
          if (event.image_b64 || event.data) {
            addPreview({
              nodeId: event.node_id,
              sampleIndex: event.sample_index ?? 0,
              iteration: event.iteration ?? undefined,
              batchIndex: event.batch_index ?? undefined,
              imageB64: event.image_b64 ?? '',
              portId: event.port_id,
              cacheHit: event.cache_hit,
              data: event.data,
            })
          }
        }
        if (event.type === 'log' && event.message) appendLog(event.message)
        if (event.type === 'error') {
          const detail = event.message ?? 'Execution failed'
          appendLog(detail)
          notifyError(detail)
          setIsExecuting(false)
          setActiveNodeId(null)
        }
        if (event.type === 'download' && event.download_url) {
          const filename = event.download_filename ?? 'results.zip'
          appendLog(event.message ?? `Download ready: ${filename}`)
          const anchor = document.createElement('a')
          anchor.href = event.download_url
          anchor.download = filename
          anchor.rel = 'noopener'
          document.body.appendChild(anchor)
          anchor.click()
          anchor.remove()
          notifySuccess(event.message ?? `Downloading ${filename}`)
        }
        if (event.type === 'done') {
          appendLog(event.message ?? 'done')
          const target = targetLabelRef.current
          if (target) {
            const node = useGraphStore
              .getState()
              .nodes.find((item) => item.id === target)
            const label = node?.data.label ?? target
            notifySuccess(`Ran to ${label}`)
          } else {
            notifySuccess(event.message ?? 'Pipeline finished')
          }
          targetLabelRef.current = null
          setIsExecuting(false)
          setActiveNodeId(null)
          socket.close()
        }
        if (event.type === 'cancelled') {
          appendLog(event.message ?? 'cancelled')
          notifyInfo(event.message ?? 'Pipeline cancelled')
          setIsExecuting(false)
          setActiveNodeId(null)
          socket.close()
        }
      }

      socket.onerror = () => {
        appendLog('WebSocket error')
        notifyError('Could not connect to the execution server')
        setIsExecuting(false)
      }

      socket.onclose = () => {
        setIsExecuting(false)
        socketRef.current = null
      }
    },
    [
      addPreview,
      appendLog,
      clearExecution,
      iterationCount,
      seed,
      setActiveNodeId,
      setIsExecuting,
      setNodeTiming,
      toGraphPayload,
    ],
  )

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
