import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import type { Plugin } from 'vite'

/** Read the official NLS tables from the pinned, original editor version. */
export function monacoLocalization(): Plugin {
  const locales = ['en', 'zh-CN'].map((language) => {
    const context = vm.createContext({})
    const file = language === 'en' ? 'nls.messages.js' : 'nls.messages.zh-cn.js'
    vm.runInContext(fs.readFileSync(path.resolve('node_modules/monaco-runtime/esm', file), 'utf8'), context)
    const messages: unknown = context._VSCODE_NLS_MESSAGES
    if (language === 'zh-CN' && Array.isArray(messages)) {
      if (messages[1219] !== null || messages[1335] !== null) throw new Error('Unexpected Monaco NLS slots')
      messages[1219] = '内联编辑'
      messages[1335] = '请先打开文本编辑器，再跳转到指定行。'
    }
    if (!Array.isArray(messages) || messages.some((message) => typeof message !== 'string')) throw new Error('Invalid Monaco NLS table')
    return messages as string[]
  })
  if (locales[0].length !== locales[1].length) throw new Error('Monaco NLS table length mismatch')
  const helper = path.resolve('src/i18n/monacoMessages.ts').replaceAll('\\', '/')
  function replace(source: string, original: string, localized: string) {
    if (!source.includes(original)) throw new Error('Unsupported Monaco localization source: ' + original)
    return source.replace(original, localized)
  }
  return {
    name: 'monaco-localization',
    enforce: 'pre',
    resolveId(id) { if (id === 'virtual:monaco-locales') return '\0' + id },
    load(id) { if (id === '\0virtual:monaco-locales') return 'export default ' + JSON.stringify(locales) },
    transform(source, id) {
      const file = id.replaceAll('\\', '/').split('?')[0]
      if (!file.includes('/monaco-runtime/esm/vs/')) return
      if (file.endsWith('/vs/nls.js')) {
        return replace(source, '        value,\n        original:', '        get value() { return localize(data, originalMessage, ...args); },\n        original:')
      }
      if (file.endsWith('/vs/base/common/actions.js')) {
        let code = replace(source, 'return this._label;', 'return localizedMonacoText(this._label);')
        code = replace(code, "return this._tooltip || '';", "return localizedMonacoText(this._tooltip || '');")
        code = replace(code, 'this.label = label;', "Object.defineProperty(this, 'label', { enumerable: true, get: () => localizedMonacoText(label) });")
        return 'import { localizedMonacoText } from ' + JSON.stringify(helper) + ';\n' + code
      }
      if (file.endsWith('/vs/editor/common/editorAction.js')) {
        const code = replace(source, 'this.label = label;', "Object.defineProperty(this, 'label', { enumerable: true, get: () => localizedMonacoText(label) });")
        return 'import { localizedMonacoText } from ' + JSON.stringify(helper) + ';\n' + code
      }
      if (file.endsWith('/vs/platform/actions/common/actions.js')) {
        let code = replace(source, 'return options?.renderShortTitle && action.shortTitle', 'return localizedMonacoText(options?.renderShortTitle && action.shortTitle')
        code = replace(code, ': (typeof action.title === \'string\' ? action.title : action.title.value);', ': (typeof action.title === \'string\' ? action.title : action.title.value));')
        code = replace(code, "this.label = typeof toggled.title === 'string' ? toggled.title : toggled.title.value;", "this.label = localizedMonacoText(typeof toggled.title === 'string' ? toggled.title : toggled.title.value);")
        return 'import { localizedMonacoText } from ' + JSON.stringify(helper) + ';\n' + code
      }
    },
  }
}
