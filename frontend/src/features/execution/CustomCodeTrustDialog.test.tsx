import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '../../store/graphStore'
import {
  IDENTITY_CODE,
  pipelineCustomNode,
  resetCustomCodeStore,
} from '../../test/customPythonFixtures'
import { CustomCodeTrustDialog } from './CustomCodeTrustDialog'

const runPipeline = vi.fn()

vi.mock('../../hooks/useExecutionSocket', () => ({
  runPipeline: (...args: unknown[]) => runPipeline(...args),
}))

const store = () => useGraphStore.getState()

function openDialog(runAfterTrust: boolean) {
  resetCustomCodeStore({
    nodes: [pipelineCustomNode(IDENTITY_CODE)],
    trustedCustomCodeHash: null,
    customCodeTrustDialogOpen: true,
    pendingRunOptions: {},
    pendingRunAfterTrust: runAfterTrust,
  })
  render(<CustomCodeTrustDialog />)
}

describe('CustomCodeTrustDialog', () => {
  beforeEach(() => {
    runPipeline.mockReset()
    resetCustomCodeStore()
  })

  it('lists nodes and labels the confirm action by pending-run mode', () => {
    openDialog(true)
    expect(screen.getByText(/Trust custom Python\?/i)).toBeInTheDocument()
    expect(screen.getByText(/\(custom-1\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Trust and run/i })).toBeInTheDocument()
  })

  it('trusts and optionally runs on confirm; Cancel leaves untrusted', async () => {
    const user = userEvent.setup()

    openDialog(true)
    await user.click(screen.getByRole('button', { name: /Trust and run/i }))
    await waitFor(() => expect(store().isCustomCodeTrusted()).toBe(true))
    expect(store().customCodeTrustDialogOpen).toBe(false)
    expect(runPipeline).toHaveBeenCalled()

    runPipeline.mockClear()
    openDialog(false)
    await user.click(screen.getByRole('button', { name: /^Trust$/i }))
    await waitFor(() => expect(store().isCustomCodeTrusted()).toBe(true))
    expect(runPipeline).not.toHaveBeenCalled()

    openDialog(true)
    await user.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(store().customCodeTrustDialogOpen).toBe(false)
    expect(store().isCustomCodeTrusted()).toBe(false)
    expect(runPipeline).not.toHaveBeenCalled()
  })
})
