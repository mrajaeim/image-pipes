import { loader } from '@monaco-editor/react'
import EditorWorker from 'monaco-runtime/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-runtime/esm/vs/language/json/json.worker?worker'
import CssWorker from 'monaco-runtime/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-runtime/esm/vs/language/html/html.worker?worker'
import TypeScriptWorker from 'monaco-runtime/esm/vs/language/typescript/ts.worker?worker'
import { synchronizeMonacoLanguage } from './monacoMessages'

export async function initializeMonacoLanguage() {
  synchronizeMonacoLanguage()
  self.MonacoEnvironment = {
    getWorker(_workerId, label) {
      if (label === 'json') return new JsonWorker()
      if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker()
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker()
      if (label === 'typescript' || label === 'javascript') return new TypeScriptWorker()
      return new EditorWorker()
    },
  }
  const monaco = await import('monaco-runtime')
  loader.config({ monaco })
}
