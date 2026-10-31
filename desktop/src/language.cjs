const { app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const chinese = require('./zh-CN.json')
let language = 'en'

function validateLanguage(value) {
  if (value !== 'zh-CN' && value !== 'en') throw new Error('Invalid language preference')
  return value
}

function preferencePath() {
  return path.join(app.getPath('userData'), 'language.json')
}

function initializeLanguage() {
  if (fs.existsSync(preferencePath())) {
    language = validateLanguage(JSON.parse(fs.readFileSync(preferencePath(), 'utf8')).language)
  }
}

function setLanguage(value) {
  validateLanguage(value)
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(preferencePath(), JSON.stringify({ language: value }) + '\n', 'utf8')
  language = value
}

function text(source) {
  if (!Object.hasOwn(chinese, source)) throw new Error(`Missing desktop translation: ${source}`)
  return language === 'zh-CN' ? chinese[source] : source
}

module.exports = { initializeLanguage, setLanguage, getLanguage: () => language, text }
