/** Lightweight Monaco stand-in for Custom Python tests. */

type MockEditorProps = {
  value?: string
  defaultValue?: string
  onChange?: (value: string | undefined) => void
  options?: { readOnly?: boolean }
  onMount?: (
    editor: {
      getContainerDomNode: () => HTMLElement
      addCommand: () => void
      focus: () => void
    },
    monaco: { KeyMod: { CtrlCmd: number }; KeyCode: { Space: number } },
  ) => void
}

export function MockMonacoEditor({
  value,
  defaultValue,
  onChange,
  options,
  onMount,
}: MockEditorProps) {
  const readOnly = Boolean(options?.readOnly)
  const container = document.createElement('div')

  if (onMount && !readOnly) {
    queueMicrotask(() => {
      onMount(
        {
          getContainerDomNode: () => container,
          addCommand: () => {},
          focus: () => {},
        },
        { KeyMod: { CtrlCmd: 1 }, KeyCode: { Space: 2 } },
      )
    })
  }

  return (
    <textarea
      data-testid={readOnly ? 'monaco-readonly' : 'monaco-edit'}
      readOnly={readOnly}
      defaultValue={readOnly ? undefined : defaultValue}
      value={readOnly ? value : undefined}
      onChange={(event) => onChange?.(event.target.value)}
    />
  )
}
