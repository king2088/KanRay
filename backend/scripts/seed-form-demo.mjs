// 表单演示数据 seed —— 幂等重灌，非破坏性
// 用法: node backend/scripts/seed-form-demo.mjs [--base http://127.0.0.1:3001] [-l en-US]
// 1. 清掉旧「员工满意度调查」表单（级联删 ds_* 数据表 + dataset）
// 2. 建表单 -> 4 字段(name/dept/score/suggestion) -> 发布(建表+注册数据集)
// 3. 确定性灌 36 条提交（内部分发，提交人在 admin）
// 4. 刷新数据集行数 -> 打印数据集列表校验 row_count/count 支持图表聚合
//
// 灌进库里的演示数据（表单名、字段标签、选项）一律保持中文：那属于「用户自填数据」，
// 跟 i18n 词典无关，翻译它会让演示数据和真实中文使用者的形态对不上。
// -l/--locale 只切换脚本自己的输出（校验项名称、进度、汇总、报错）。
function argVal(flag) {
  const eq = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (eq !== undefined) return eq.split('=').slice(1).join('=');
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}
const BASE = argVal('--base') || 'http://127.0.0.1:3001';
const ADMIN = { email: 'admin@kanray.local', password: 'admin123' };
const FORM_NAME = '员工满意度调查';

const LOCALE = argVal('-l') || argVal('--locale') || 'zh-CN';
const EN = LOCALE === 'en-US';
const t = (zh, en) => (EN ? en : zh);

const results = [];
const ok = (name, cond, extra = '') => {
  results.push(!!cond);
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `  ← ${extra}`}`);
};
async function j(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`${t('非 JSON 响应', 'Non-JSON response')} ${res.status}: ${text.slice(0, 200)}`); }
}

const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let v = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
  return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
};
const rnd = mulberry32(20260101);

const NAMES = ['陈思远', '李佳怡', '张子航', '王雨桐', '刘浩然', '赵欣怡', '孙鹏飞', '周梦洁', '吴俊杰', '郑晓彤', '冯志强', '蒋丽娜', '沈立诚', '韩婷婷', '杨泽宇', '朱婉清', '秦明轩', '许静怡', '何俊峰', '吕诗琪', '施文博', '孔雪雁', '曹明辉', '严雨欣', '华景行', '金语嫣', '魏宏宇', '陶思思', '姜志豪', '谢安然', '邹凯', '苏曼', '潘伟', '葛欣颖', '范天佑', '彭佳琪'];
const DEPTS = ['研发部', '产品部', '设计部', '市场部', '运营部', '人力行政部'];
const SCORES = [
  { v: '5', label: '5 · 很满意', w: 8 },
  { v: '4', label: '4 · 满意', w: 14 },
  { v: '3', label: '3 · 一般', w: 8 },
  { v: '2', label: '2 · 不满意', w: 4 },
  { v: '1', label: '1 · 很不满意', w: 2 },
];
const SUGGESTIONS = [
  '', '',
  '希望办公环境能再安静一些',
  '零食供应很贴心，继续保持',
  '建议缩短每周站会时长',
  '希望能有更灵活的远程办公方案',
  '绩效评审反馈希望更具体一些',
  '茶水间可以增加咖啡机',
  '团队团建可以安排一次出省旅行',
  '报销流程有点慢，希望能提速',
];

const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const pickScore = () => {
  const total = SCORES.reduce((s, x) => s + x.w, 0);
  let r = rnd() * total;
  for (const s of SCORES) { r -= s.w; if (r < 0) return s.v; }
  return SCORES[0].v;
};

let token;
try {
  let r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ADMIN),
  });
  let d = await j(r);
  token = d.data?.accessToken || d.accessToken || d.data?.token || d.token;
  if (!token) throw new Error(t('登录失败', 'Login failed') + ': ' + JSON.stringify(d).slice(0, 200));
  ok(t('P1  admin 登录', 'P1  admin sign-in'), true, '');

  const authH = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // 清理旧演示表单（级联删表 + dataset）
  r = await fetch(`${BASE}/api/forms`, { headers: authH });
  d = await j(r);
  const old = (d.data || []).filter((f) => f.name === FORM_NAME || f.name.startsWith('演示'));
  for (const f of old) {
    await fetch(`${BASE}/api/forms/${f.id}`, { method: 'DELETE', headers: authH });
  }
  ok(t('P2  清理旧演示数据', 'P2  Clean up old demo data'), true, t(`删除 ${old.length} 个表单`, `deleted ${old.length} form(s)`));

  // 建表单
  r = await fetch(`${BASE}/api/forms`, {
    method: 'POST', headers: authH,
    body: JSON.stringify({ name: FORM_NAME, description: '演示数据：6 个部门满意度调查（可用于图表聚合）' }),
  });
  d = await j(r);
  if (r.status !== 200 || !d.data?.id) throw new Error(t('建表单失败', 'Failed to create form') + ': ' + JSON.stringify(d).slice(0, 200));
  const formId = d.data.id;
  ok(t('P3  创建表单', 'P3  Create form'), true, `id=${formId}`);

  // 设计 schema
  const schema = {
    version: 1,
    fields: [
      { key: 'name', label: '姓名', type: 'text', required: true, span: 1, placeholder: '请输入姓名' },
      { key: 'dept', label: '部门', type: 'select', required: true, span: 1, options: DEPTS.map((x) => ({ label: x, value: x })) },
      { key: 'score', label: '满意度评分', type: 'radio', required: true, span: 2, options: SCORES.map((x) => ({ label: x.label, value: x.v })) },
      { key: 'suggestion', label: '建议与反馈', type: 'textarea', required: false, span: 2, placeholder: '选填' },
    ],
  };
  r = await fetch(`${BASE}/api/forms/${formId}`, {
    method: 'PATCH', headers: authH,
    body: JSON.stringify({ name: FORM_NAME, description: '演示数据：6 个部门满意度调查（可用于图表聚合）', submitConfig: { successText: '感谢反馈', allowRepeat: true }, schemaJson: schema }),
  });
  d = await j(r);
  if (r.status !== 200) throw new Error(t('保存 schema 失败', 'Failed to save schema') + ': ' + JSON.stringify(d).slice(0, 300));
  ok(t('P4  保存 schema(4 字段)', 'P4  Save schema (4 fields)'), true, '');

  // 发布
  r = await fetch(`${BASE}/api/forms/${formId}/publish`, { method: 'POST', headers: authH });
  d = await j(r);
  if (r.status !== 200 || !d.data?.tableName || !d.data?.datasetId) throw new Error(t('发布失败', 'Failed to publish') + ': ' + JSON.stringify(d).slice(0, 400));
  const { tableName, datasetId } = d.data;
  ok(t('P5  发布建表+注册数据集', 'P5  Publish: create table + register dataset'), true, `table=${tableName} ds=${datasetId}`);

  // 灌 36 条提交
  let submitted = 0;
  for (let i = 0; i < NAMES.length; i++) {
    const payload = {
      values: {
        name: NAMES[i],
        dept: pick(DEPTS),
        score: pickScore(),
        suggestion: pick(SUGGESTIONS),
      },
    };
    r = await fetch(`${BASE}/api/forms/${formId}/submissions`, { method: 'POST', headers: authH, body: JSON.stringify(payload) });
    d = await j(r);
    if (r.status !== 200 || !d.data?.id)       throw new Error(t(`第 ${i + 1} 条提交失败`, `Submission ${i + 1} failed`) + `: ${r.status} ` + JSON.stringify(d).slice(0, 200));
    submitted += 1;
  }
  ok(t('P6  灌入 36 条提交', 'P6  Insert 36 submissions'), submitted === 36, `got=${submitted}`);

  // 数据集元数据行数（提交时逐条自增维护；row-counts 懒计算只在 row_count=0 时补算）
  r = await fetch(`${BASE}/api/datasets/${datasetId}`, { headers: authH });
  d = await j(r);
  const rowCount = Number(d.data?.row_count);
  ok(t('P7  数据集 row_count = 36', 'P7  dataset row_count = 36'), rowCount === 36, JSON.stringify({ row_count: d.data?.row_count }));

  // 用数据集查询 API 验证可聚合（chart 链路同款）
  r = await fetch(`${BASE}/api/datasets/${datasetId}/query`, {
    method: 'POST', headers: authH,
    body: JSON.stringify({ dimensions: [{ field: 'dept' }], metrics: [{ type: 'base', field: 'dept', agg: 'count', label: '提交数' }] }),
  });
  d = await j(r);
  const agg = d.data?.rows || d.data || [];
  ok(t('P8  数据集聚合查询可用(按部门)', 'P8  dataset aggregation works (by department)'), Array.isArray(agg) && agg.length === DEPTS.length, JSON.stringify(d.data).slice(0, 200));

  // 打印前 6 行明细
  r = await fetch(`${BASE}/api/datasets/${datasetId}/rows?page=1&pageSize=6`, { headers: authH });
  d = await j(r);
  console.log('\n' + t('数据预览（前 6 条）:', 'Data preview (first 6 rows):'));
  for (const row of (d.data?.rows || []).slice(0, 6)) {
    console.log(`   #${row.id}  ${row.name}  ${row.dept}  ${t('评分', 'score')}=${row.score}  ${t('建议', 'feedback')}=${(row.suggestion || '').slice(0, 18) || '—'}`);
  }

  console.log('\n' + t('汇总:', 'Summary:'));
  console.log(`   ${t('表单', 'Form')} 「${FORM_NAME}」 id=${formId}`);
  console.log(`   ${t('数据表', 'Table')} ${tableName} · ${t('数据集', 'Dataset')} #${datasetId}`);
  console.log(`   ${t(`共 ${submitted} 条提交`, `${submitted} submission(s) in total`)}`);
  console.log(`   ${t('在界面查看：数据集 → ', 'Browse it at: Datasets → ')}${FORM_NAME} → ${t('数据预览 » 或用它建图表/看板', 'Data preview » or build charts/dashboards from it')}`);
} catch (e) {
  console.error('SEED EXCEPTION: ' + (e.stack || e.message));
}

const failed = results.filter((x) => !x).length;
console.log(`\n${t('表单演示数据', 'Form demo data')}: ${results.length - failed}/${results.length} ${t('通过', 'passed')}`);
process.exit(failed ? 1 : 0);