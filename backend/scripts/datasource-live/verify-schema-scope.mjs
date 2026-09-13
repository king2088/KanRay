import { getProvider } from '../../src/datasources/providers/index.js'

const CASES = [
  { label: 'mysql',      family: 'mysql',      cfg: { host: '127.0.0.1', port: 13306, database: 'testdb', user: 'root',      password: 'Kanban@123' }, expect: 'testdb' },
  { label: 'mariadb',    family: 'mysql',      cfg: { host: '127.0.0.1', port: 13307, database: 'testdb', user: 'root',      password: 'Kanban@123' }, expect: 'testdb' },
  { label: 'tidb',       family: 'mysql',      cfg: { host: '127.0.0.1', port: 14000, database: 'testdb', user: 'root',      password: '' },            expect: 'testdb' },
  { label: 'clickhouse', family: 'clickhouse', cfg: { host: '127.0.0.1', port: 18123, database: 'testdb', user: 'default',   password: 'Kanban@123' }, expect: 'testdb' },
  { label: 'postgres',   family: 'pg',         cfg: { host: '127.0.0.1', port: 15432, database: 'testdb', user: 'postgres',  password: 'Kanban@123' }, expect: 'public' },
  { label: 'mssql',      family: 'mssql',      cfg: { host: '127.0.0.1', port: 11433, database: 'testdb', user: 'sa',        password: 'Kanban@123' }, expect: 'dbo' },
]

let failed = 0
for (const c of CASES) {
  try {
    const prov = getProvider(c.family)
    if (!prov) { console.log(`[FAIL] ${c.label}: provider not found`); failed++; continue }
    const schemas = await prov.listSchemas(c.cfg)
    const ok = schemas.length === 1 && schemas[0].name === c.expect
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${c.label} expect=[${c.expect}] got=${JSON.stringify(schemas.map((s) => s.name))}`)
    if (!ok) failed++
  } catch (e) {
    console.log(`[FAIL] ${c.label}: ${e.message}`)
    failed++
  }
}
console.log(failed ? `FAILED: ${failed}` : 'ALL SCHEMA-SCOPE CHECKS PASSED')
process.exit(failed ? 1 : 0)