import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { IDENTITY_CODE } from '../../test/customPythonFixtures'
import { CustomPythonParams } from './CustomPythonParams'

vi.mock('@monaco-editor/react', async () => {
  const { MockMonacoEditor } = await import('../../test/MockMonacoEditor')
  return { default: MockMonacoEditor }
})

function renderParams(onCodeChange = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <CustomPythonParams
        nodeId="custom-1"
        code={IDENTITY_CODE}
        onCodeChange={onCodeChange}
      />
    </QueryClientProvider>,
  )
  return { onCodeChange, client }
}

async function openEditor() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /Edit code/i }))
  return user
}

describe('CustomPythonParams', () => {
  it('shows a read-only preview until Edit code is clicked', () => {
    renderParams()
    expect(screen.getByTestId('monaco-readonly')).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: /Edit code/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Save$/i })).not.toBeInTheDocument()
  })

  it('opens an edit dialog with Save and Cancel (no close icon)', async () => {
    renderParams()
    await openEditor()
    expect(screen.getByText(/Edit Custom Python/i)).toBeInTheDocument()
    expect(screen.getByTestId('monaco-edit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Save$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Close editor/i)).not.toBeInTheDocument()
  })

  it('commits edits on Save and discards them on Cancel', async () => {
    const { onCodeChange: onSave } = renderParams()
    let user = await openEditor()
    await user.clear(screen.getByTestId('monaco-edit'))
    await user.type(screen.getByTestId('monaco-edit'), 'return image * 2')
    await user.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(String(onSave.mock.calls.at(-1)?.[0])).toContain('return image * 2')
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Save$/i })).not.toBeInTheDocument()
    })

    onSave.mockClear()
    user = await openEditor()
    await user.clear(screen.getByTestId('monaco-edit'))
    await user.type(screen.getByTestId('monaco-edit'), 'should not persist')
    await user.click(screen.getByRole('button', { name: /Cancel/i }))

    expect(onSave).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Save$/i })).not.toBeInTheDocument()
    })
  })

  it('saves as reusable node, switches this node, and invalidates catalog', async () => {
    const { pipelineCustomNode, resetCustomCodeStore } = await import(
      '../../test/customPythonFixtures'
    )
    const { useGraphStore } = await import('../../store/graphStore')
    resetCustomCodeStore({
      nodes: [pipelineCustomNode(IDENTITY_CODE, 'custom-1')],
    })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'script_001',
          name: 'Sepia',
          current_version: 1,
          created_at: '',
          updated_at: '',
          node_type: 'user_script.script_001',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const { client } = renderParams()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Save as reusable node/i }))
    await user.type(screen.getByLabelText(/Display name/i), 'Sepia')
    await user.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/user-scripts')
    await waitFor(() => {
      const node = useGraphStore.getState().nodes.find((n) => n.id === 'custom-1')
      expect(node?.data.type).toBe('user_script.script_001')
      expect(node?.data.label).toBe('Sepia')
      expect(node?.data.params.version).toBe(1)
    })
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['nodes'] }))
    fetchSpy.mockRestore()
  })
})
