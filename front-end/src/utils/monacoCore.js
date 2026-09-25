let corePromise = null
const loaded = new Set()

const languageLoaders = {
  sql: () => import('monaco-editor/languages/definitions/sql/register.js'),
  html: () => import('monaco-editor/languages/definitions/html/register.js'),
  css: () => import('monaco-editor/languages/definitions/css/register.js'),
  javascript: () => import('monaco-editor/languages/definitions/javascript/register.js'),
  json: () => import('monaco-editor/language/json/monaco.contribution.js'),
}

export async function loadMonaco(languages = []) {
  if (!corePromise) {
    corePromise = setupWorkers().then(() => import('monaco-editor/editor/editor.api'))
  }
  const mod = await corePromise
  const need = [...new Set((languages || []).map((l) => String(l).toLowerCase()))].filter((l) => !loaded.has(l))
  await Promise.all(need.map(async (l) => {
    const loader = languageLoaders[l]
    if (loader) await loader()
    loaded.add(l)
  }))
  return { editor: mod.editor, languages: mod.languages }
}

async function setupWorkers() {
  const [{ default: EditorWorker }, { default: JsonWorker }] = await Promise.all([
    import('monaco-editor/editor/editor.worker?worker'),
    import('monaco-editor/language/json/json.worker?worker'),
  ])
  const install = (scope) => {
    if (!scope || scope.MonacoEnvironment) return
    scope.MonacoEnvironment = {
      getWorker(_moduleId, label) {
        if (label === 'json') return new JsonWorker()
        return new EditorWorker()
      },
    }
  }
  if (typeof window !== 'undefined') install(window)
  if (typeof globalThis !== 'undefined') install(globalThis)
}