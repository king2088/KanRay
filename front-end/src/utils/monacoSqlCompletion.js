// 模块级共享：同一页面多个 SQL 编辑器只注册一个 completion provider，
// 补全项来自所有已挂载编辑器的 catalog 合并（表名 + 字段，字段范围跟随所在表）

const catalogRegistry = new Map()
let sqlCompletionDisposable = null

export function buildCatalogIndex(catalog) {
  const tables = []
  const byName = new Map()
  for (const s of catalog || []) {
    for (const t of s.tables || []) {
      const columns = (t.columns || []).map((c) => ({ name: c.name, type: c.type, schema: s.schema, table: t.table }))
      const entry = { schema: s.schema, name: t.table, columns }
      tables.push(entry)
      const key = String(t.table).toLowerCase()
      if (!byName.has(key)) byName.set(key, [])
      byName.get(key).push(entry)
    }
  }
  return { tables, byName }
}

export function registerSqlCatalog(monaco, token, index) {
  catalogRegistry.set(token, index)
  ensureSqlCompletion(monaco)
}

export function setSqlCatalog(token, index) {
  catalogRegistry.set(token, index)
}

export function unregisterSqlCatalog(token) {
  catalogRegistry.delete(token)
}

function ensureSqlCompletion(monaco) {
  if (sqlCompletionDisposable) return
  const kindClass = monaco.languages.CompletionItemKind.Class
  const kindField = monaco.languages.CompletionItemKind.Field
  sqlCompletionDisposable = monaco.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.'],
    provideCompletionItems(model, position) {
      const lineBefore = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
      const wordUntil = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: wordUntil.startColumn,
        endColumn: wordUntil.endColumn,
      }

      const suggestions = []
      const seen = new Set()
      const push = (key, item) => {
        if (seen.has(key)) return
        seen.add(key)
        suggestions.push(item)
      }

      const refMatch = /(?:([A-Za-z_][\w]*)\.)?([A-Za-z_][\w]*)\.$/.exec(lineBefore)
      if (refMatch) {
        const schemaPart = refMatch[1]
        const tablePart = refMatch[2]
        for (const index of catalogRegistry.values()) {
          let entries = []
          if (schemaPart) {
            entries = index.tables.filter((t) => t.schema === schemaPart && t.name === tablePart)
          } else {
            entries = index.byName.get(String(tablePart).toLowerCase()) || []
          }
          for (const entry of entries) {
            for (const col of entry.columns) {
              push(`c:${col.name}`, {
                label: col.name,
                kind: kindField,
                detail: `字段：${col.name}（${col.type || '?'}）`,
                insertText: col.name,
                range,
              })
            }
          }
        }
        return { suggestions }
      }

      for (const index of catalogRegistry.values()) {
        for (const entry of index.tables) {
          push(`t:${entry.schema}.${entry.name}`, {
            label: `${entry.schema}.${entry.name}`,
            kind: kindClass,
            detail: `表：${entry.name}`,
            insertText: `${entry.schema}.${entry.name}`,
            range,
          })
          push(`tb:${entry.name}`, {
            label: entry.name,
            kind: kindClass,
            detail: `表：${entry.schema}.${entry.name}`,
            insertText: entry.name,
            range,
          })
        }
      }
      return { suggestions }
    },
  })
}