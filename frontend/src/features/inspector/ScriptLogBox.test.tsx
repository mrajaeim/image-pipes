import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useGraphStore } from '../../store/graphStore'
import { ScriptLogBox } from './ScriptLogBox'
import { SCRIPT_HELPERS } from './scriptHelpersHint'

describe('ScriptLogBox', () => {
  beforeEach(() => {
    useGraphStore.setState({ scriptLogsByNodeId: {} })
  })

  it('shows empty state when there are no lines', () => {
    render(<ScriptLogBox nodeId="custom-1" />)
    expect(screen.getByText(/No script logs yet/i)).toBeInTheDocument()
    expect(screen.getByText(/log\(\.\.\.\)/i)).toBeInTheDocument()
  })

  it('renders lines for the given node id only', () => {
    useGraphStore.setState({
      scriptLogsByNodeId: {
        'custom-1': ['hello', 'ndarray(shape=(2, 2, 3), dtype=uint8)'],
        other: ['ignore me'],
      },
    })
    render(<ScriptLogBox nodeId="custom-1" />)
    expect(screen.getByText('hello')).toBeInTheDocument()
    expect(screen.getByText(/ndarray\(shape=\(2, 2, 3\)/)).toBeInTheDocument()
    expect(screen.queryByText('ignore me')).not.toBeInTheDocument()
  })
})

describe('scriptHelpers catalog', () => {
  it('documents log for the helpers modal', () => {
    expect(SCRIPT_HELPERS.some((item) => item.signature.startsWith('log('))).toBe(true)
  })
})
