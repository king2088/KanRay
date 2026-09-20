import assert from 'node:assert/strict'
import { DB_ICONS, getDbIcon, getDbLetter } from '../src/utils/dbIcons.js'

let passed = 0
function t(name, fn) {
  fn()
  passed++
  console.log('  ok -', name)
}

// 驱动元数据中的 type 全集（与 backend/src/datasources/drivers.js 对应）
const DRIVER_TYPES = [
  'mysql', 'mariadb', 'tidb', 'clickhouse', 'postgres', 'sqlserver',
  'oracle', 'redshift', 'doris', 'hive', 'presto', 'impala',
  'maxcompute', 'elasticsearch', 'dameng', 'db2', 'kingbase', 'gbase',
  'greenplum', 'starrocks', 'gaussdb', 'api', 'excel',
]

t('每个数据源 type 都有图标或可回退首字母', () => {
  for (const type of DRIVER_TYPES) {
    const icon = getDbIcon(type)
    assert.ok(icon === null || icon.path || icon.svg, `${type} 图标应为 path/svg 或 null`)
  }
})

t('品牌图标：hive/maxcompute/elasticsearch/excel 有专属图形', () => {
  for (const type of ['hive', 'maxcompute', 'elasticsearch', 'excel']) {
    assert.ok(getDbIcon(type), `${type} 应有图标`)
  }
})

t('excel 为自绘 svg 徽标', () => {
  const icon = getDbIcon('excel')
  assert.ok(icon.svg && icon.svg.includes('rect'), 'excel 应为 svg 网格徽标')
})

t('无品牌的 db2/dameng/impala/api 回退 null → 首字母', () => {
  for (const type of ['db2', 'dameng', 'impala', 'api', 'gbase', 'greenplum', 'starrocks', 'kingbase', 'gaussdb']) {
    assert.equal(getDbIcon(type), null, `${type} 无官方品牌图标`)
    assert.equal(getDbLetter(type), type[0].toUpperCase(), `${type} 回退首字母`)
  }
})

t('getDbLetter 空值兜底为 ?', () => {
  assert.equal(getDbLetter(''), '?')
  assert.equal(getDbLetter(null), '?')
})

console.log(`dbIcons 测试：${passed} 项通过`)