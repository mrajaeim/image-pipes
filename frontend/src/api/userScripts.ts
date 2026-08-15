/** Client for versioned reusable user scripts. */

export type UserScriptMeta = {
  id: string
  name: string
  current_version: number
  created_at: string
  updated_at: string
  node_type: string
}

export type UserScriptCode = {
  id: string
  version: number
  code: string
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    if (typeof body.detail === 'string') return body.detail
    return JSON.stringify(body.detail ?? body)
  } catch {
    return response.statusText || 'Request failed'
  }
}

export async function listUserScripts(): Promise<UserScriptMeta[]> {
  const response = await fetch('/api/user-scripts')
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

export async function createUserScript(name: string, code: string): Promise<UserScriptMeta> {
  const response = await fetch('/api/user-scripts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, code }),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

export async function createUserScriptVersion(
  scriptId: string,
  code: string,
): Promise<UserScriptMeta> {
  const response = await fetch(`/api/user-scripts/${encodeURIComponent(scriptId)}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

export async function getUserScriptCode(
  scriptId: string,
  version: number,
): Promise<UserScriptCode> {
  const response = await fetch(
    `/api/user-scripts/${encodeURIComponent(scriptId)}/versions/${version}`,
  )
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}
