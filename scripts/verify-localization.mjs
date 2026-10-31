import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import ts from '../frontend/node_modules/typescript/lib/typescript.js'

const root = path.resolve(import.meta.dirname, '..')
const baseline = 'v0.3.0'
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const git = (...args) => execFileSync('git', ['-c', 'core.safecrlf=false', ...args], { cwd: root, encoding: 'utf8' })
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const en = JSON.parse(read('frontend/src/i18n/en.json'))
const zh = JSON.parse(read('frontend/src/i18n/zh-CN.json'))
assert(JSON.stringify(Object.keys(en).sort()) === JSON.stringify(Object.keys(zh).sort()), 'Language key mismatch')
const variables = (s) => [...s.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]).sort()
for (const key of Object.keys(en)) {
  assert(typeof zh[key] === 'string' && zh[key].length > 0, 'Empty Chinese string: ' + key)
  assert(en[key] === key, 'English source changed: ' + key)
  assert(JSON.stringify(variables(en[key])) === JSON.stringify(variables(zh[key])), 'Interpolation mismatch: ' + key)
}
const response = await fetch((process.env.IMAGE_PIPES_VERIFY_URL || 'http://127.0.0.1:8000') + '/api/nodes')
assert(response.ok, 'Registry unavailable')
const nodes = await response.json()
let metadataCount = 0
for (const node of nodes) {
  const strings = [node.label, node.description, ...node.ports.map((p) => p.name), ...node.params.flatMap((p) => [p.label, p.description, ...(p.options ?? [])])]
  for (const source of strings) if (source != null) {
    assert(Object.hasOwn(zh, source), 'Missing metadata: ' + node.type + ' ' + source)
    metadataCount++
  }
}
const files = git('diff', '--name-only', baseline).trim().split(/\r?\n/).filter(Boolean)
assert(!files.some((f) => f.startsWith('backend/')), 'Backend sources changed')
const originalFiles = new Set(git('ls-tree', '-r', '--name-only', baseline).trim().split(/\r?\n/))
const printer = ts.createPrinter({ removeComments: true })
function styleProps(source, file) {
  const tree = ts.createSourceFile(file, source.replaceAll('\r\n', '\n'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const props = []
  function visit(node) {
    if (ts.isJsxAttribute(node) && ['sx', 'style'].includes(node.name.getText(tree))) props.push(printer.printNode(ts.EmitHint.Unspecified, node, tree))
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return props
}
let styleCount = 0
for (const file of files.filter((f) => f.endsWith('.tsx'))) {
  const before = originalFiles.has(file) ? styleProps(git('show', baseline + ':' + file), file) : []
  const after = styleProps(read(file), file)
  for (const prop of before) {
    const index = after.indexOf(prop)
    assert(index >= 0, 'Existing style changed: ' + file + ' ' + prop)
    after.splice(index, 1)
    styleCount++
  }
  assert(after.length === 0 || file === 'frontend/src/app/AppHeader.tsx', 'Unexpected new UI style: ' + file)
}
for (const folder of ['frontend', 'desktop']) {
  const before = JSON.parse(git('show', baseline + ':' + folder + '/package-lock.json'))
  const after = JSON.parse(read(folder + '/package-lock.json'))
  for (const [location, dependency] of Object.entries(before.packages)) if (location !== '') {
    assert(after.packages[location]?.version === dependency.version, 'Dependency version changed: ' + location)
    assert(after.packages[location]?.integrity === dependency.integrity, 'Dependency integrity changed: ' + location)
  }
}
const desktopBefore = JSON.parse(git('show', baseline + ':desktop/package.json'))
const desktopAfter = JSON.parse(read('desktop/package.json'))
desktopAfter.version = desktopBefore.version
assert(JSON.stringify(desktopBefore) === JSON.stringify(desktopAfter), 'Desktop packaging settings changed')
const names = JSON.parse(read('frontend/src/i18n/nodeNames.json'))
assert(nodes.length === Object.keys(names).length, 'Node map mismatch')
for (const node of nodes) assert(names[node.type] === node.label, 'Node identifier changed: ' + node.type)
function sourceTree(file) {
  return ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}
let templateCount = 0
const templateTree = sourceTree('frontend/src/workflow/templates.ts')
function visitTemplate(node) {
  if (ts.isPropertyAssignment(node) && ['name', 'description', 'label', 'steps'].includes(node.name.getText(templateTree))) {
    const items = ts.isArrayLiteralExpression(node.initializer) ? node.initializer.elements : [node.initializer]
    for (const item of items) if (ts.isStringLiteral(item)) {
      assert(Object.hasOwn(zh, item.text), 'Missing template: ' + item.text)
      templateCount++
    }
  }
  ts.forEachChild(node, visitTemplate)
}
visitTemplate(templateTree)
let literalCalls = 0
function scanDirectory(directory) {
  for (const item of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const file = directory + '/' + item.name
    if (item.isDirectory()) scanDirectory(file)
    else if (/\.tsx?$/.test(file)) {
      const tree = sourceTree(file)
      function visit(node) {
        if (ts.isJsxAttribute(node) && node.name.getText(tree) === 'value') {
          function checkValue(value) {
            if (ts.isCallExpression(value)) {
              assert(!['tr', 'metadataText', 'nodeLabel', 'messageText'].includes(value.expression.getText(tree)),
                'Translated data attribute: ' + file + ' ' + node.name.getText(tree))
            }
            ts.forEachChild(value, checkValue)
          }
          checkValue(node)
        }
        if (ts.isCallExpression(node) && node.expression.getText(tree) === 'tr' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
          assert(Object.hasOwn(zh, node.arguments[0].text), 'Missing literal translation: ' + file + ' ' + node.arguments[0].text)
          literalCalls++
        }
        ts.forEachChild(node, visit)
      }
      visit(tree)
    }
  }
}
scanDirectory('frontend/src')
const helpers = read('frontend/src/features/inspector/scriptHelpersHint.ts')
const compiled = ts.transpileModule(helpers, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const helperModule = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
const helperStrings = [helperModule.SCRIPT_HELPERS_TAGLINE, helperModule.SCRIPT_HELPERS_FOOTNOTE, ...helperModule.SCRIPT_HELPERS.flatMap((h) => [h.summary, h.detail])]
for (const source of helperStrings) assert(Object.hasOwn(zh, source), 'Missing script helper: ' + source)
console.log(JSON.stringify({ application_strings: Object.keys(zh).length, builtin_nodes: nodes.length, metadata_occurrences: metadataCount, template_occurrences: templateCount, script_helper_strings: helperStrings.length, literal_translation_calls: literalCalls, original_style_props_preserved: styleCount, backend_sources: 'unchanged', existing_dependency_versions: 'unchanged', desktop_packaging_settings: 'unchanged' }, null, 2))
