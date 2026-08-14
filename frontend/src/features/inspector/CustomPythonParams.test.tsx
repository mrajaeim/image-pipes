import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IDENTITY_CODE } from '../../test/customPythonFixtures'
import { CustomPythonParams } from './CustomPythonParams'

vi.mock('@monaco-editor/react', async () => {
  const { MockMonacoEditor } = await import('../../test/MockMonacoEditor')
  return { default: MockMonacoEditor }
})

function renderParams(onCodeChange = vi.fn()) {
  render(<CustomPythonParams code={IDENTITY_CODE} onCodeChange={onCodeChange} />)
  return onCodeChange
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
    const onSave = renderParams()
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
})
