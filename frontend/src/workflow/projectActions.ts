/** Project library orchestration used by the Projects UI. */

import { useGraphStore } from '../store/graphStore'
import { DEFAULT_PROJECT_NAME, type WorkflowDocument } from './io'
import { saveWorkflowSession } from './persist'
import {
  createProjectId,
  deleteProject as deleteLibraryProject,
  getProject,
  listProjects,
  type ProjectRecord,
  renameProject as renameLibraryProject,
  upsertProject,
} from './projectLibrary'

export function confirmDiscardIfDirty(message?: string): boolean {
  const dirty = useGraphStore.getState().projectDirty
  if (!dirty) return true
  return window.confirm(
    message ?? 'You have unsaved changes. Discard them and continue?',
  )
}

export function flushSession(): void {
  const doc = useGraphStore.getState().toWorkflowDocument()
  saveWorkflowSession(doc, doc.id ?? null)
}

export function openProject(id: string): { skippedTypes: string[] } {
  const record = getProject(id)
  if (!record) {
    throw new Error('Project not found')
  }
  const result = useGraphStore.getState().loadWorkflow(record)
  flushSession()
  return result
}

export function newProject(): void {
  useGraphStore.getState().newProject()
  flushSession()
}

export function saveProject(): ProjectRecord {
  const state = useGraphStore.getState()
  if (!state.projectId) {
    throw new Error('No saved project — use Save As')
  }
  const record = upsertProject(state.toWorkflowDocument())
  state.markProjectClean(record)
  flushSession()
  return record
}

export function saveProjectAs(meta: {
  name: string
  description?: string
}): ProjectRecord {
  const state = useGraphStore.getState()
  const name = meta.name.trim() || DEFAULT_PROJECT_NAME
  const description = meta.description?.trim() || undefined
  const record = upsertProject({
    ...state.toWorkflowDocument(),
    id: createProjectId(),
    name,
    ...(description ? { description } : { description: undefined }),
    createdAt: undefined,
    updatedAt: undefined,
  })
  state.markProjectClean(record)
  flushSession()
  return record
}

export function renameActiveProject(meta: {
  name: string
  description?: string
}): ProjectRecord | null {
  const state = useGraphStore.getState()
  const name = meta.name.trim() || DEFAULT_PROJECT_NAME
  const description = meta.description?.trim() || undefined
  if (!state.projectId) {
    state.setProjectMeta({ name, description: description ?? '' })
    return null
  }
  const record = renameLibraryProject(state.projectId, { name, description })
  if (record) {
    state.markProjectClean(record)
    flushSession()
  } else {
    state.setProjectMeta({ name, description: description ?? '' })
  }
  return record
}

export function deleteProjectById(id: string): void {
  deleteLibraryProject(id)
  const state = useGraphStore.getState()
  if (state.projectId === id) {
    // Detach from library without clearing the canvas.
    useGraphStore.setState({
      projectId: null,
      projectCreatedAt: null,
      projectUpdatedAt: null,
      projectDirty: true,
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
    name: overrides?.name?.trim() || doc.name || DEFAULT_PROJECT_NAME,
  })
  flushSession()
  return result
}

export { listProjects, getProject }
export type { ProjectRecord }
