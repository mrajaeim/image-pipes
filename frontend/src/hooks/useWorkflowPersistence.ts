import { useEffect, useRef, useState } from 'react'
import { useGraphStore } from '../store/graphStore'
import { materializeSampleImages } from '../workflow/materializeSampleImages'
import { loadWorkflowSession, saveWorkflowSession } from '../workflow/persist'
import { getProject } from '../workflow/projectLibrary'

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
  const projectId = useGraphStore((s) => s.projectId)
  const projectName = useGraphStore((s) => s.projectName)
  const projectDescription = useGraphStore((s) => s.projectDescription)
  const [sessionReady, setSessionReady] = useState(false)
  const restoredRef = useRef(false)

  useEffect(() => {
    if (restoredRef.current || nodeCatalog.length === 0) return
    restoredRef.current = true
    const saved = loadWorkflowSession()
    if (saved && saved.document.graph.nodes.length > 0) {
      const libraryProject =
        saved.activeProjectId != null ? getProject(saved.activeProjectId) : null
      const doc = libraryProject
        ? {
            ...saved.document,
            id: libraryProject.id,
            name: libraryProject.name,
            description: libraryProject.description,
            createdAt: libraryProject.createdAt,
            updatedAt: libraryProject.updatedAt,
          }
        : {
            ...saved.document,
            // File/session drafts are not library entries until Save As.
            id: undefined,
          }
      loadWorkflow(doc)
      void materializeSampleImages().catch(() => {
        // Session may already have real upload paths; ignore sample staging failures.
      })
    }
    setSessionReady(true)
  }, [nodeCatalog, loadWorkflow])

  useEffect(() => {
    if (!sessionReady) return
    const timer = window.setTimeout(() => {
      const doc = toWorkflowDocument()
      saveWorkflowSession(doc, doc.id ?? null)
    }, SAVE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [
    sessionReady,
    nodes,
    edges,
    seed,
    sampleCount,
    projectId,
    projectName,
    projectDescription,
    toWorkflowDocument,
  ])

  useEffect(() => {
    if (!sessionReady) return
    const flush = () => {
      const doc = toWorkflowDocument()
      saveWorkflowSession(doc, doc.id ?? null)
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [sessionReady, toWorkflowDocument])
}
