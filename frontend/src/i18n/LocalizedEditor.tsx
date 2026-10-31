import Editor, { type EditorProps, type OnMount } from '@monaco-editor/react'
import { useEffect, useId, useRef } from 'react'
import type { editor } from 'monaco-editor'
import { tr, useLocale } from './index'

/** Recreate translated widgets while retaining the existing model, undo stack and view. */
export default function LocalizedEditor(props: EditorProps) {
  const locale = useLocale()
  const id = useId()
  const model = useRef<editor.ITextModel | null>(null)
  useEffect(() => () => { model.current?.dispose() }, [])
  const onMount: OnMount = (instance, monaco) => {
    model.current = instance.getModel()
    props.onMount?.(instance, monaco)
  }
  return <Editor {...props} key={locale} path={'inmemory://image-pipes/' + encodeURIComponent(id)} keepCurrentModel onMount={onMount} loading={tr('Loading...')} options={{ ...props.options, ariaLabel: tr('Editor content') }} />
}
