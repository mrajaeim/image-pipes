/** Workflow library orchestration used by the Workflows UI. */

import { useGraphStore } from '../store/graphStore'
import { DEFAULT_WORKFLOW_NAME, type WorkflowDocument } from './io'
import { saveWorkflowSession } from './persist'
import {
  createWorkflowId,
  deleteWorkflow as deleteLibraryWorkflow,
  getWorkflow,
  listWorkflows,
  type WorkflowRecord,
  renameWorkflow as renameLibraryWorkflow,
  upsertWorkflow,
} from './workflowLibrary'

export function confirmDiscardIfDirty(message?: string): boolean {
  const dirty = useGraphStore.getState().workflowDirty
  if (!dirty) return true
  return window.confirm(
    message ?? 'You have unsaved changes. Discard them and continue?',
  )
}

export function flushSession(): void {
  const doc = useGraphStore.getState().toWorkflowDocument()
  saveWorkflowSession(doc, doc.id ?? null)
}

export function openWorkflow(id: string): { skippedTypes: string[] } {
  const record = getWorkflow(id)
  if (!record) {
    throw new Error('Workflow not found')
  }
  const result = useGraphStore.getState().loadWorkflow(record)
  flushSession()
  return result
}

export function newWorkflow(): void {
  useGraphStore.getState().newWorkflow()
  flushSession()
}

export function saveWorkflow(): WorkflowRecord {
  const state = useGraphStore.getState()
  if (!state.workflowId) {
    throw new Error('No saved workflow — use Save As')
  }
  const record = upsertWorkflow(state.toWorkflowDocument())
  state.markWorkflowClean(record)
  flushSession()
  return record
}

export function saveWorkflowAs(meta: {
  name: string
  description?: string
}): WorkflowRecord {
  const state = useGraphStore.getState()
  const name = meta.name.trim() || DEFAULT_WORKFLOW_NAME
  const description = meta.description?.trim() || undefined
  const record = upsertWorkflow({
    ...state.toWorkflowDocument(),
    id: createWorkflowId(),
    name,
    ...(description ? { description } : { description: undefined }),
    createdAt: undefined,
    updatedAt: undefined,
  })
  state.markWorkflowClean(record)
  flushSession()
  return record
}

export function renameActiveWorkflow(meta: {
  name: string
  description?: string
}): WorkflowRecord | null {
  const state = useGraphStore.getState()
  const name = meta.name.trim() || DEFAULT_WORKFLOW_NAME
  const description = meta.description?.trim() || undefined
  if (!state.workflowId) {
    state.setWorkflowMeta({ name, description: description ?? '' })
    return null
  }
  const record = renameLibraryWorkflow(state.workflowId, { name, description })
  if (record) {
    state.markWorkflowClean(record)
    flushSession()
  } else {
    state.setWorkflowMeta({ name, description: description ?? '' })
  }
  return record
}

export function deleteWorkflowById(id: string): void {
  deleteLibraryWorkflow(id)
  const state = useGraphStore.getState()
  if (state.workflowId === id) {
    // Detach from library without clearing the canvas.
    useGraphStore.setState({
      workflowId: null,
      workflowCreatedAt: null,
      workflowUpdatedAt: null,
      workflowDirty: true,
    })
    flushSession()
  }
}

/** Load a document that is not yet a library entry (file / template). */
export function loadExternalDocument(
  doc: WorkflowDocument,
  overrides?: { name?: string },
): { skippedTypes: string[] } {
  const { id: _id, ...withoutId } = doc
  void _id
  const result = useGraphStore.getState().loadWorkflow({
    ...withoutId,
    name: overrides?.name?.trim() || doc.name || DEFAULT_WORKFLOW_NAME,
  })
  flushSession()
  return result
}

export { listWorkflows, getWorkflow }
export type { WorkflowRecord }
