import { useEffect, useRef, useState } from 'react'
import { useGraphStore } from '../store/graphStore'
import { loadWorkflowSession, saveWorkflowSession } from '../workflow/persist'

const SAVE_DEBOUNCE_MS = 400

/**
 * Restore the last workflow from localStorage once the node catalog is ready,
 * then autosave graph edits so a reload does not wipe the canvas.
 */
export function useWorkflowPersistence() {
  const nodeCatalog = useGraphStore((s) => s.nodeCatalog)
  const loadWorkflow = useGraphStore((s) => s.loadWorkflow)
  const toWorkflowDocument = useGraphStore((s) => s.toWorkflowDocument)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const seed = useGraphStore((s) => s.seed)
  const sampleCount = useGraphStore((s) => s.sampleCount)
  const [sessionReady, setSessionReady] = useState(false)
  const restoredRef = useRef(false)

  useEffect(() => {
    if (restoredRef.current || nodeCatalog.length === 0) return
    restoredRef.current = true
    const saved = loadWorkflowSession()
    if (saved && saved.graph.nodes.length > 0) {
      loadWorkflow(saved)
    }
    setSessionReady(true)
  }, [nodeCatalog, loadWorkflow])

  useEffect(() => {
    if (!sessionReady) return
    const timer = window.setTimeout(() => {
      saveWorkflowSession(toWorkflowDocument())
    }, SAVE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [sessionReady, nodes, edges, seed, sampleCount, toWorkflowDocument])

  useEffect(() => {
    if (!sessionReady) return
    const flush = () => saveWorkflowSession(toWorkflowDocument())
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [sessionReady, toWorkflowDocument])
}
