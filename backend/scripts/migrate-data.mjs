// 跨库数据迁移 CLI：旧库 -> 新库（元数据表 + 数据表 ds_*/sync_* 全量复制）。
// 用法：
//   node backend/scripts/migrate-data.mjs --from sqlite@data/kanban.db --to postgres@postgresql://user:pass@host:5432/db
//   [--tables sync_configs,sync_logs] [--skip-data] [--dry-run]
// 提示：目标库 DATASOURCE_SECRET / JWT_SECRET 必须与旧库一致（否则数据源配置无法解密、旧 refresh token 失效）。
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { migrate, parseConn } = require('../src/migrate');

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--from') opts.from = v;
    else if (k === '--to') opts.to = v;
    else if (k === '--tables') opts.tables = v;
    else if (k === '--skip-data') { opts.skipData = true; i -= 1; }
    else if (k === '--dry-run') { opts.dryRun = true; i -= 1; }
    else { console.error(`未知参数: ${k}`); process.exit(2); }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.from || !opts.to) {
    console.error('用法: node backend/scripts/migrate-data.mjs --from TYPE@URL --to TYPE@URL [--tables a,b,c] [--skip-data] [--dry-run]');
    process.exit(2);
  }
  const fromConn = parseConn(opts.from);
  const toConn = parseConn(opts.to);
  console.log(`[migrate] ${opts.dryRun ? '[DRY-RUN] ' : ''}${fromConn.type} (${fromConn.url}) -> ${toConn.type} (${toConn.url})${opts.tables ? `, 仅这些表: ${opts.tables}` : ''}${opts.skipData ? ', 跳过数据表' : ''}`);

  const res = await migrate(fromConn, toConn, opts);
  let total = 0;
  const width = Math.max(...res.tables.map((t) => t.table.length), 5);
  console.log(`\n${'表'.padEnd(width + 2)}${opts.dryRun ? '行数(源)' : '复制行数'}`);
  console.log('-'.repeat(width + 20));
  for (const t of res.tables) {
    total += t.rows;
    console.log(`${t.table.padEnd(width + 2)}${t.rows}`);
  }
  console.log('-'.repeat(width + 20));
  console.log(`合计: ${total} 行`);

  console.log(`
提示:
  1. 目标库 DATASOURCE_SECRET 必须与旧库一致（env DATA-SOURCE_SECRET），否则 data_sources.config 无法解密。
  2. 目标库 JWT_SECRET 若更改，旧 refresh token 全部失效（用户需重新登录）。
  3. 多实例部署若启用同步调度，先在旧实例停止调度，再一次性迁移，避免迁移期间产生新写入。`);
}

main().catch((e) => {
  console.error(`[migrate] 失败: ${e.message}`);
  process.exit(1);
});