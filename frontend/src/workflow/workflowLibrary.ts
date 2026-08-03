/** Local multi-workflow library backed by localStorage. */

import {
  coerceWorkflowDocument,
  DEFAULT_WORKFLOW_NAME,
  type WorkflowDocument,
} from './io'

export const WORKFLOWS_LIBRARY_KEY = 'image-pipes.workflows.v1'
/** @deprecated Previous key; still read for migration. */
const LEGACY_PROJECTS_LIBRARY_KEY = 'image-pipes.projects.v1'

export type WorkflowRecord = WorkflowDocument & {
  id: string
  createdAt: string
  updatedAt: string
}

interface WorkflowLibraryStore {
  version: 1
  workflows: WorkflowRecord[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function createWorkflowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function emptyLibrary(): WorkflowLibraryStore {
  return { version: 1, workflows: [] }
}

function parseLibraryEntries(entries: unknown[]): WorkflowRecord[] {
  const workflows: WorkflowRecord[] = []
  for (const entry of entries) {
    try {
      const doc = coerceWorkflowDocument(entry)
      if (!doc.id) continue
      const now = new Date().toISOString()
      workflows.push({
        ...doc,
        id: doc.id,
        name: doc.name || DEFAULT_WORKFLOW_NAME,
        createdAt: doc.createdAt ?? now,
        updatedAt: doc.updatedAt ?? now,
      })
    } catch {
      // Skip corrupt entries.
    }
  }
  return workflows
}

function readLibrary(): WorkflowLibraryStore {
  try {
    const raw =
      localStorage.getItem(WORKFLOWS_LIBRARY_KEY) ??
      localStorage.getItem(LEGACY_PROJECTS_LIBRARY_KEY)
    if (!raw) return emptyLibrary()
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || parsed.version !== 1) {
      return emptyLibrary()
    }
    const entries = Array.isArray(parsed.workflows)
      ? parsed.workflows
      : Array.isArray(parsed.projects)
        ? parsed.projects
        : null
    if (!entries) return emptyLibrary()
    return { version: 1, workflows: parseLibraryEntries(entries) }
  } catch {
    return emptyLibrary()
  }
}

function writeLibrary(store: WorkflowLibraryStore): void {
  try {
    localStorage.setItem(WORKFLOWS_LIBRARY_KEY, JSON.stringify(store))
    localStorage.removeItem(LEGACY_PROJECTS_LIBRARY_KEY)
  } catch {
    // Quota or private mode — ignore; export still works.
  }
}

export function listWorkflows(): WorkflowRecord[] {
  return [...readLibrary().workflows].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )
}

export function getWorkflow(id: string): WorkflowRecord | null {
  return readLibrary().workflows.find((workflow) => workflow.id === id) ?? null
}

export function upsertWorkflow(doc: WorkflowDocument): WorkflowRecord {
  const now = new Date().toISOString()
  const id = doc.id?.trim() || createWorkflowId()
  const store = readLibrary()
  const existing = store.workflows.find((workflow) => workflow.id === id)
  const record: WorkflowRecord = {
    ...doc,
    id,
    name: doc.name.trim() || DEFAULT_WORKFLOW_NAME,
    createdAt: existing?.createdAt ?? doc.createdAt ?? now,
    updatedAt: now,
  }
  const next = store.workflows.filter((workflow) => workflow.id !== id)
  next.push(record)
  writeLibrary({ version: 1, workflows: next })
  return record
}

export function deleteWorkflow(id: string): boolean {
  const store = readLibrary()
  const next = store.workflows.filter((workflow) => workflow.id !== id)
  if (next.length === store.workflows.length) return false
  writeLibrary({ version: 1, workflows: next })
  return true
}

export function renameWorkflow(
  id: string,
  meta: { name: string; description?: string },
): WorkflowRecord | null {
  const existing = getWorkflow(id)
  if (!existing) return null
  return upsertWorkflow({
    ...existing,
    name: meta.name.trim() || DEFAULT_WORKFLOW_NAME,
    description: meta.description?.trim() || undefined,
  })
}
