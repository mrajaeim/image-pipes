import { beforeEach, describe, expect, it } from 'vitest'
import { useGraphStore } from '../store/graphStore'

describe('scriptLogsByNodeId store', () => {
  beforeEach(() => {
    useGraphStore.setState({
      logs: [],
      scriptLogsByNodeId: {},
    })
  })

  it('appends per-node script logs and clears them on clearExecution', () => {
    const store = useGraphStore.getState()
    store.appendScriptLog('a', 'one')
    store.appendScriptLog('a', 'two')
    store.appendScriptLog('b', 'other')
    expect(useGraphStore.getState().scriptLogsByNodeId).toEqual({
      a: ['one', 'two'],
      b: ['other'],
    })

    useGraphStore.getState().clearExecution()
    expect(useGraphStore.getState().scriptLogsByNodeId).toEqual({})
  })
})
