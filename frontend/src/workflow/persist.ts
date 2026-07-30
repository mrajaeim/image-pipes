/** Browser session persistence for the current workflow. */

import {
  coerceWorkflowDocument,
  type WorkflowDocument,
} from './io'

export const WORKFLOW_SESSION_KEY = 'image-pipes.workflow.v1'

export function saveWorkflowSession(doc: WorkflowDocument): void {
  try {
    localStorage.setItem(WORKFLOW_SESSION_KEY, JSON.stringify(doc))
  } catch {
    // Quota or private mode — ignore; export still works.
  }
}

export function loadWorkflowSession(): WorkflowDocument | null {
  try {
    const raw = localStorage.getItem(WORKFLOW_SESSION_KEY)
    if (!raw) return null
    return coerceWorkflowDocument(JSON.parse(raw) as unknown)
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
