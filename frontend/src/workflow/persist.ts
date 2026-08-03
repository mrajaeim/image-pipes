/** Browser session persistence for the current workflow. */

import {
  coerceWorkflowDocument,
  type WorkflowDocument,
} from './io'

export const WORKFLOW_SESSION_KEY = 'image-pipes.workflow.v1'

export interface WorkflowSession {
  activeWorkflowId: string | null
  document: WorkflowDocument
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Accept the session envelope or a legacy bare WorkflowDocument. */
export function coerceWorkflowSession(value: unknown): WorkflowSession | null {
  if (!isRecord(value)) return null

  if (isRecord(value.document)) {
    try {
      return {
        activeWorkflowId:
          readOptionalString(value.activeWorkflowId) ??
          readOptionalString(value.activeProjectId),
        document: coerceWorkflowDocument(value.document),
      }
    } catch {
      return null
    }
  }

  try {
    return {
      activeWorkflowId: null,
      document: coerceWorkflowDocument(value),
    }
  } catch {
    return null
  }
}

export function saveWorkflowSession(
  doc: WorkflowDocument,
  activeWorkflowId: string | null = doc.id ?? null,
): void {
  try {
    const session: WorkflowSession = {
      activeWorkflowId,
      document: doc,
    }
    localStorage.setItem(WORKFLOW_SESSION_KEY, JSON.stringify(session))
  } catch {
    // Quota or private mode — ignore; export still works.
  }
}

export function loadWorkflowSession(): WorkflowSession | null {
  try {
    const raw = localStorage.getItem(WORKFLOW_SESSION_KEY)
    if (!raw) return null
    return coerceWorkflowSession(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function clearWorkflowSession(): void {
  try {
    localStorage.removeItem(WORKFLOW_SESSION_KEY)
  } catch {
    // ignore
  }
}
