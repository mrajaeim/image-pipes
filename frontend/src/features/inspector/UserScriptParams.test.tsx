import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCustomCodeStore } from '../../test/customPythonFixtures'
import { useGraphStore } from '../../store/graphStore'
import { userScriptCodeKey } from '../../workflow/customCodeTrust'
import { UserScriptParams } from './UserScriptParams'

vi.mock('@monaco-editor/react', async () => {
  const { MockMonacoEditor } = await import('../../test/MockMonacoEditor')
  return { default: MockMonacoEditor }
})

const V1 = 'def process(image, seed=0):\n    return image\n'
const V2 = 'def process(image, seed=0):\n    return image + 1\n'

function renderUserScript(onVersionChange = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <UserScriptParams
        nodeId="user-1"
        nodeType="user_script.script_001"
        label="Sepia Tone"
        version={1}
        onVersionChange={onVersionChange}
      />
    </QueryClientProvider>,
  )
  return { onVersionChange, client }
}

describe('UserScriptParams', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    resetCustomCodeStore({
      userScriptCodes: {
        [userScriptCodeKey('user_script.script_001', 1)]: V1,
      },
    })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/api/user-scripts') && !url.includes('/versions')) {
        return new Response(
          JSON.stringify([
            {
              id: 'script_001',
              name: 'Sepia Tone',
              current_version: 2,
              created_at: '',
              updated_at: '',
              node_type: 'user_script.script_001',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('not found', { status: 404 })
    })
  })

  it('shows pinned version select and cached code', async () => {
    renderUserScript()
    const select = await screen.findByLabelText(/Pinned version/i)
    expect(select).toHaveTextContent(/v1/)
    expect(screen.getByTestId('monaco-readonly')).toHaveValue(V1)
  })

  it('saves a new version, updates param, and invalidates nodes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith('/api/user-scripts') && (!init || init.method === undefined || init.method === 'GET')) {
        return new Response(
          JSON.stringify([
            {
              id: 'script_001',
              name: 'Sepia Tone',
              current_version: 1,
              created_at: '',
              updated_at: '',
              node_type: 'user_script.script_001',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/versions') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            id: 'script_001',
            name: 'Sepia Tone',
            current_version: 2,
            created_at: '',
            updated_at: '',
            node_type: 'user_script.script_001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('not found', { status: 404 })
    })

    const { onVersionChange, client } = renderUserScript()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Edit code/i }))
    await user.clear(screen.getByTestId('monaco-edit'))
    await user.type(screen.getByTestId('monaco-edit'), V2)
    await user.click(screen.getByRole('button', { name: /Save as new version/i }))

    await waitFor(() => expect(onVersionChange).toHaveBeenCalledWith(2))
    expect(
      fetchSpy.mock.calls.some(
        ([req, init]) =>
          String(req).includes('/api/user-scripts/script_001/versions') &&
          (init as RequestInit | undefined)?.method === 'POST',
      ),
    ).toBe(true)
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['nodes'] }))
    expect(useGraphStore.getState().userScriptCodes[userScriptCodeKey('user_script.script_001', 2)]).toBe(
      V2,
    )
    fetchSpy.mockRestore()
  })
})
