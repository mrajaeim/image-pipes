import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useGraphStore } from '../../store/graphStore'
import { computeCustomCodeHash } from '../../workflow/customCodeTrust'
import {
  pipelineCustomNode,
  resetCustomCodeStore,
} from '../../test/customPythonFixtures'
import { CustomCodeTrustBanner } from './CustomCodeTrustBanner'

describe('CustomCodeTrustBanner', () => {
  beforeEach(() => resetCustomCodeStore())

  it('is hidden without custom code or when already trusted', () => {
    const empty = render(<CustomCodeTrustBanner />)
    expect(empty.container).toBeEmptyDOMElement()
    empty.unmount()

    const nodes = [pipelineCustomNode('return image')]
    resetCustomCodeStore({
      nodes,
      trustedCustomCodeHash: computeCustomCodeHash(nodes),
    })
    const trusted = render(<CustomCodeTrustBanner />)
    expect(trusted.container).toBeEmptyDOMElement()
  })

  it('warns when untrusted and opens review dialog without auto-run', async () => {
    const user = userEvent.setup()
    resetCustomCodeStore({
      nodes: [pipelineCustomNode('return image')],
      trustedCustomCodeHash: null,
    })
    render(<CustomCodeTrustBanner />)

    expect(screen.getByText(/includes custom Python/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Review & trust/i }))
    expect(useGraphStore.getState()).toMatchObject({
      customCodeTrustDialogOpen: true,
      pendingRunAfterTrust: false,
    })
  })
})
