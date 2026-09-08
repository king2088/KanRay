/* 集成测试：完整 API 流程 */
const BASE = 'http://localhost:3001/api';
const path = require('path');
const fs = require('fs');

function req(method, url, body) {
  const opts = { method, headers: {} };
  if (body && !(body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  return fetch(BASE + url, opts).then(async (r) => ({ status: r.status, json: await r.json() }));
}

function upload(url, filePath, fields = {}) {
  const fd = new FormData();
  const buf = fs.readFileSync(filePath);
  fd.append('file', new Blob([buf]), path.basename(filePath));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fetch(BASE + url, { method: 'POST', body: fd }).then(async (r) => ({ status: r.status, json: await r.json() }));
}

(async () => {
  const filePath = path.join(__dirname, '..', 'test-data', '销售数据.xlsx');

  // 1. preview
  const prev = await upload('/datasets/preview', filePath);
  console.log('1 preview:', prev.status);
  console.log('   header:', prev.json.data.header.map((h) => `${h.key}:${h.type}`).join(', '));
  console.log('   rows:', prev.json.data.rowCount, 'previewRows:', prev.json.data.previewRows.length);

  // 2. create dataset
  const create = await upload('/datasets', filePath, { name: '销售数据' });
  console.log('2 create dataset:', create.status, 'id=', create.json.data?.id, 'rows=', create.json.data?.row_count, 'table=', create.json.data?.table_name);
  const dsId = create.json.data.id;

  // 3. list datasets
  const list = await req('GET', '/datasets');
  console.log('3 list datasets:', list.status, 'count=', list.json.data.length);

  // 4. run aggregation: 按区域求和销售额
  const q1 = await req('POST', `/datasets/${dsId}/query`, {
    dimensions: [{ field: '区域' }],
    metrics: [{ field: '销售额', agg: 'sum' }],
    sortBy: 0, sortOrder: 'desc',
  });
  console.log('4 aggregate by 区域:', q1.status);
  console.log('   rows:', JSON.stringify(q1.json.data?.rows));

  // 5. aggregation with filter 区域=华东
  const q2 = await req('POST', `/datasets/${dsId}/query`, {
    dimensions: [{ field: '月份' }],
    metrics: [{ field: '销售额', agg: 'sum' }],
    filters: [{ field: '区域', op: 'eq', value: '华东' }],
  });
  console.log('5 aggregate 华东 by 月份:', q2.status, 'rows=', JSON.stringify(q2.json.data?.rows));

  // 6. paginate rows
  const rows = await req('GET', `/datasets/${dsId}/rows?page=1&pageSize=5`);
  console.log('6 paginate rows:', rows.status, 'total=', rows.json.data.total, 'returned=', rows.json.data.rows.length);

  // 7. create chart
  const chart = await req('POST', '/charts', {
    name: '区域销售额汇总',
    chartType: 'bar',
    datasetId: dsId,
    config: {
      dimensions: [{ field: '区域' }],
      metrics: [{ field: '销售额', agg: 'sum', label: '销售额' }],
      sortBy: 0, sortOrder: 'desc', groupLimit: 10,
      options: { title: '各区域销售额' },
    },
  });
  console.log('7 create chart:', chart.status, 'id=', chart.json.data?.id);
  const chartId = chart.json.data.id;

  // 8. chart data
  const cd = await req('POST', `/charts/${chartId}/data`, {});
  console.log('8 chart data:', cd.status, 'rows=', cd.json.data?.data?.rows?.length, 'elapsed=', cd.json.data?.data?.elapsedMs, 'ms');

  // 9. chart data with external dashboard filter
  const cd2 = await req('POST', `/charts/${chartId}/data`, {
    filters: [{ field: '区域', op: 'eq', value: '华南' }],
  });
  console.log('9 chart data filtered:', cd2.status, 'rows=', JSON.stringify(cd2.json.data?.data?.rows));

  // 10. list charts
  const listc = await req('GET', '/charts');
  console.log('10 list charts:', listc.status, 'count=', listc.json.data.length);

  // 11. create dashboard
  const dash = await req('POST', '/dashboards', { name: '销售概览看板' });
  console.log('11 create dashboard:', dash.status, 'id=', dash.json.data?.id);
  const dashId = dash.json.data.id;

  // 12. update dashboard layout with chart + text
  const layout = [
    { id: 'c1', type: 'chart', chartId, x: 0, y: 0, w: 8, h: 4, title: '各区域销售额' },
    { id: 't1', type: 'text', content: '# 销售数据看板', x: 0, y: 4, w: 8, h: 1 },
  ];
  const upd = await req('PATCH', `/dashboards/${dashId}`, { name: '销售概览看板', layout });
  console.log('12 update dashboard:', upd.status, 'layout items=', upd.json.data?.layout?.length);

  // 13. get dashboard
  const getd = await req('GET', `/dashboards/${dashId}`);
  console.log('13 get dashboard:', getd.status, 'name=', getd.json.data?.name);

  // 14. delete chart
  const del = await req('DELETE', `/charts/${chartId}`);
  console.log('14 delete chart:', del.status);

  // 15. delete dashboard
  const deld = await req('DELETE', `/dashboards/${dashId}`);
  console.log('15 delete dashboard:', deld.status);

  // 16. delete dataset
  const delds = await req('DELETE', `/datasets/${dsId}`);
  console.log('16 delete dataset:', delds.status);

  console.log('\nDONE');
})().catch((e) => { console.error('TEST FAILED:', e); process.exit(1); });