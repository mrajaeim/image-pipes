import i18next from 'i18next'
import tables from 'virtual:monaco-locales'

const englishIndex = new Map(tables[0].map((message, index) => [message, index]))
const chineseIndex = new Map(tables[1].map((message, index) => [message, index]))

export function localizedMonacoText(source: string): string {
  const index = englishIndex.get(source) ?? chineseIndex.get(source)
  return index === undefined ? source : tables[i18next.language === 'zh-CN' ? 1 : 0][index]
}

export function synchronizeMonacoLanguage() {
  const target = globalThis as typeof globalThis & { _VSCODE_NLS_MESSAGES: string[]; _VSCODE_NLS_LANGUAGE: string }
  const synchronize = () => {
    target._VSCODE_NLS_MESSAGES = tables[i18next.language === 'zh-CN' ? 1 : 0]
    target._VSCODE_NLS_LANGUAGE = i18next.language === 'zh-CN' ? 'zh-cn' : 'en'
  }
  synchronize()
  i18next.on('languageChanged', synchronize)
}
