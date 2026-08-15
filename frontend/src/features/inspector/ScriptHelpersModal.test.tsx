import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ScriptHelpersModal } from './ScriptHelpersModal'
import { SCRIPT_HELPERS, SCRIPT_HELPERS_TAGLINE } from './scriptHelpersHint'

describe('ScriptHelpersModal', () => {
  it('lists helpers with signatures and future-helpers note', () => {
    render(<ScriptHelpersModal open onClose={() => {}} />)
    expect(screen.getByText('Script helpers')).toBeInTheDocument()
    expect(screen.getByText(SCRIPT_HELPERS_TAGLINE)).toBeInTheDocument()
    expect(screen.getByText(SCRIPT_HELPERS[0]!.signature)).toBeInTheDocument()
    expect(screen.getByText(SCRIPT_HELPERS[0]!.summary)).toBeInTheDocument()
    expect(screen.getByText(/More helpers will appear/i)).toBeInTheDocument()
  })

  it('closes from the Close button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ScriptHelpersModal open onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /^Close$/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
