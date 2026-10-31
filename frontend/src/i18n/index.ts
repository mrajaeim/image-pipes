import i18next from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import en from './en.json'
import zh from './zh-CN.json'
import nodeNames from './nodeNames.json'

export type Locale = 'zh-CN' | 'en'
const browserPreferenceKey = 'image-pipes.language'
const english: Record<string, string> = en
const builtinNames: Record<string, string> = nodeNames

export function validateLocale(value: unknown): Locale {
  if (value !== 'zh-CN' && value !== 'en') throw new Error('Invalid language preference')
  return value
}

export async function initializeLanguage() {
  const desktop = window.imagePipesDesktop
  const locale = desktop?.getLanguage
    ? validateLocale(await desktop.getLanguage())
    : validateLocale(localStorage.getItem(browserPreferenceKey) ?? 'en')
  await i18next.use(initReactI18next).init({
    lng: locale,
    supportedLngs: ['zh-CN', 'en'],
    load: 'currentOnly',
    fallbackLng: false,
    keySeparator: false,
    nsSeparator: false,
    resources: { en: { translation: en }, 'zh-CN': { translation: zh } },
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  })
  document.documentElement.lang = locale
  i18next.on('languageChanged', (language) => {
    document.documentElement.lang = validateLocale(language)
  })
}

export function useLocale(): Locale {
  const { i18n } = useTranslation()
  return validateLocale(i18n.language)
}

export async function setLocale(locale: Locale) {
  validateLocale(locale)
  if (window.imagePipesDesktop?.setLanguage) {
    await window.imagePipesDesktop.setLanguage(locale)
  } else {
    localStorage.setItem(browserPreferenceKey, locale)
  }
  await i18next.changeLanguage(locale)
}

export function tr(source: string, values?: Record<string, unknown>): string {
  if (!Object.hasOwn(english, source)) throw new Error(`Missing translation: ${source}`)
  return i18next.t(source, values ?? {})
}

export function nodeLabel(type: string, label: string, locale?: Locale): string {
  return Object.hasOwn(builtinNames, type) && label === builtinNames[type] ? tr(label, { lng: locale }) : label
}

export function metadataText(source: string | null | undefined, locale?: Locale): string | undefined {
  return source == null ? undefined : tr(source, { lng: locale })
}

const messagePatterns = Object.keys(english)
  .filter((key) => /\{\{v\d+\}\}/.test(key))
  .map((key) => {
    const variables: string[] = []
    const escaped = key.split(/(\{\{v\d+\}\})/).map((part) => {
      const placeholder = /^\{\{(v\d+)\}\}$/.exec(part)
      if (placeholder) {
        variables.push(placeholder[1])
        return '([\\s\\S]*?)'
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }).join('')
    return { key, variables, pattern: new RegExp(`^${escaped}$`) }
  })

/** Application messages keep their original payload; technical exception details remain verbatim. */
export function messageText(source: string): string {
  if (i18next.language === 'en') return source
  if (source.endsWith(' (cache)')) return messageText(source.slice(0, -8)) + tr(' (cache)')
  if (source.startsWith("'") && source.endsWith("'")) {
    const inner = source.slice(1, -1)
    const translated = messageText(inner)
    if (translated !== inner) return "'" + translated + "'"
  }
  const envelope = /^\{"detail":("(?:\\.|[^"\\])*")\}$/.exec(source)
  if (envelope) return JSON.stringify({ detail: messageText(JSON.parse(envelope[1]) as string) })
  if (Object.hasOwn(english, source)) return tr(source)
  for (const { key, variables, pattern } of messagePatterns) {
    const match = pattern.exec(source)
    if (match) {
      const values = Object.fromEntries(variables.map((v, i) => [v, match[i + 1]]))
      if (key === 'Ran to {{v0}}' && Object.values(builtinNames).includes(values.v0)) values.v0 = tr(values.v0)
      return tr(key, values)
    }
  }
  return source
}
