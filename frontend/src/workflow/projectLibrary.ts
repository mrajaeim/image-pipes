/** Local multi-project library backed by localStorage. */

import {
  coerceWorkflowDocument,
  DEFAULT_PROJECT_NAME,
  type WorkflowDocument,
} from './io'

export const PROJECTS_LIBRARY_KEY = 'image-pipes.projects.v1'

export type ProjectRecord = WorkflowDocument & {
  id: string
  createdAt: string
  updatedAt: string
}

interface ProjectLibraryStore {
  version: 1
  projects: ProjectRecord[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function createProjectId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function emptyLibrary(): ProjectLibraryStore {
  return { version: 1, projects: [] }
}

function readLibrary(): ProjectLibraryStore {
  try {
    const raw = localStorage.getItem(PROJECTS_LIBRARY_KEY)
    if (!raw) return emptyLibrary()
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.projects)) {
      return emptyLibrary()
    }
    const projects: ProjectRecord[] = []
    for (const entry of parsed.projects) {
      try {
        const doc = coerceWorkflowDocument(entry)
        if (!doc.id) continue
        const now = new Date().toISOString()
        projects.push({
          ...doc,
          id: doc.id,
          name: doc.name || DEFAULT_PROJECT_NAME,
          createdAt: doc.createdAt ?? now,
          updatedAt: doc.updatedAt ?? now,
        })
      } catch {
        // Skip corrupt entries.
      }
    }
    return { version: 1, projects }
  } catch {
    return emptyLibrary()
  }
}

function writeLibrary(store: ProjectLibraryStore): void {
  try {
    localStorage.setItem(PROJECTS_LIBRARY_KEY, JSON.stringify(store))
  } catch {
    // Quota or private mode — ignore; export still works.
  }
}

export function listProjects(): ProjectRecord[] {
  return [...readLibrary().projects].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )
}

export function getProject(id: string): ProjectRecord | null {
  return readLibrary().projects.find((project) => project.id === id) ?? null
}

export function upsertProject(doc: WorkflowDocument): ProjectRecord {
  const now = new Date().toISOString()
  const id = doc.id?.trim() || createProjectId()
  const store = readLibrary()
  const existing = store.projects.find((project) => project.id === id)
  const record: ProjectRecord = {
    ...doc,
    id,
    name: doc.name.trim() || DEFAULT_PROJECT_NAME,
    createdAt: existing?.createdAt ?? doc.createdAt ?? now,
    updatedAt: now,
  }
  const next = store.projects.filter((project) => project.id !== id)
  next.push(record)
  writeLibrary({ version: 1, projects: next })
  return record
}

export function deleteProject(id: string): boolean {
  const store = readLibrary()
  const next = store.projects.filter((project) => project.id !== id)
  if (next.length === store.projects.length) return false
  writeLibrary({ version: 1, projects: next })
  return true
}

export function renameProject(
  id: string,
  meta: { name: string; description?: string },
): ProjectRecord | null {
  const existing = getProject(id)
  if (!existing) return null
  return upsertProject({
    ...existing,
    name: meta.name.trim() || DEFAULT_PROJECT_NAME,
    description: meta.description?.trim() || undefined,
  })
}
