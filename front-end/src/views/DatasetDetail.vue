<template>
  <div class="page-container">
    <div v-if="ds" class="dataset-detail">
      <div class="page-header">
        <div class="page-header__main d-header">
          <el-button circle class="back-btn" @click="$router.push('/datasets')"><el-icon><ArrowLeft /></el-icon></el-button>
          <div>
            <h2 class="page-title">{{ ds.name }}</h2>
            <div class="page-desc">来源：{{ ds.original_file || '-' }} · 创建于 {{ formatDateTime(ds.created_at, appStore.timezone) }}</div>
          </div>
        </div>
        <div class="page-header__actions">
          <el-button type="primary" @click="$router.push(`/charts/new?dataset=${ds.id}`)">
            <el-icon style="margin-right: 6px"><DataAnalysis /></el-icon>基于此数据建图
          </el-button>
        </div>
      </div>

      <div class="stat-strip">
        <div class="stat-item">
          <div class="stat-item__icon"><el-icon><DataLine /></el-icon></div>
          <div>
            <div class="stat-item__value">{{ (ds.row_count || 0).toLocaleString('zh-CN') }}</div>
            <div class="stat-item__label">数据行数</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-item__icon"><el-icon><Grid /></el-icon></div>
          <div>
            <div class="stat-item__value">{{ ds.column_count }}</div>
            <div class="stat-item__label">字段列数</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-item__icon"><el-icon><Files /></el-icon></div>
          <div>
            <div class="stat-item__value">{{ ds.fields.length }}</div>
            <div class="stat-item__label">字段定义数</div>
          </div>
        </div>
      </div>

      <el-tabs v-model="tab" class="detail-tabs">
        <el-tab-pane label="数据预览" name="data">
          <div class="page-card">
            <div class="page-card__body">
              <div v-loading="loading" style="min-height: 220px">
                <el-table :data="rows" max-height="460" empty-text="暂无数据">
                  <el-table-column
                    v-for="f in fields"
                    :key="f.name"
                    :prop="f.name"
                    :label="f.label"
                    min-width="130"
                    show-overflow-tooltip
                  />
                </el-table>
              </div>
              <div style="display: flex; justify-content: flex-end; margin-top: 14px">
                <el-pagination
                  background
                  layout="total, prev, pager, next"
                  :total="total"
                  :page-size="pageSize"
                  :current-page="page"
                  @current-change="onPageChange"
                />
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="字段定义" name="fields">
          <div class="page-card">
            <div class="page-card__header">
              <div class="page-card__header-title">字段别名与类型</div>
              <div class="page-card__header-right">
                <el-tag  type="info" effect="plain">修改展示名称后回车保存</el-tag>
              </div>
            </div>
            <el-table :data="ds.fields">
              <el-table-column prop="name" label="内部字段名" min-width="160">
                <template #default="{ row }">
                  <span class="cell-key">{{ row.name }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="label" label="展示名称" min-width="200">
                <template #default="{ row }">
                  <el-input v-model="row.label"  placeholder="输入展示名称" @change="() => updateFieldLabel(row)" />
                </template>
              </el-table-column>
              <el-table-column prop="type" label="类型" width="130">
                <template #default="{ row }">
                  <el-tag  :type="typeTag(row.type)">{{ typeLabel(row.type) }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane label="指标库" name="metrics">
          <div class="page-card">
            <div class="page-card__header">
              <div class="page-card__header-title">
                指标库
                <el-tag type="info" effect="plain" style="margin-left: 8px">命名指标可在此创建，供图表「指标库」形态复用</el-tag>
              </div>
              <div class="page-card__header-right">
                <el-button type="primary" size="small" @click="openMetricDialog()">
                  <el-icon style="margin-right: 4px"><Plus /></el-icon>新建指标
                </el-button>
              </div>
            </div>
            <el-table :data="metricsLib" v-loading="metricsLoading" empty-text="暂无指标">
              <el-table-column prop="name" label="名称" min-width="180">
                <template #default="{ row }"><span class="metric-name">{{ row.name }}</span></template>
              </el-table-column>
              <el-table-column label="类型" width="90">
                <template #default="{ row }">
                  <el-tag :type="{ base: 'success', expr: 'warning', derived: 'danger' }[row.kind]" effect="light">
                    {{ kindLabel(row.kind) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="定义" min-width="240">
                <template #default="{ row }"><span class="cell-key">{{ metricDefinitionText(row) }}</span></template>
              </el-table-column>
              <el-table-column prop="created_at" label="创建时间" width="180">
                <template #default="{ row }">{{ formatDateTime(row.created_at, appStore.timezone) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="140" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" size="small" @click="openMetricDialog(row)">编辑</el-button>
                  <el-button link type="danger" size="small" @click="removeMetric(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-dialog v-model="metricDialog.show" :title="metricDialog.editing ? '编辑指标' : '新建指标'" width="520px">
          <el-form label-width="88px">
            <el-form-item label="指标名称" required>
              <el-input v-model="metricForm.name" placeholder="如：销售额、客单价、销售额占比" maxlength="100" />
            </el-form-item>
            <el-form-item label="指标类型" required>
              <el-radio-group v-model="metricForm.kind" :disabled="!!metricDialog.editing" @change="onMetricKindChange">
                <el-radio-button value="base">原子指标</el-radio-button>
                <el-radio-button value="expr">复合指标</el-radio-button>
                <el-radio-button value="derived">衍生指标</el-radio-button>
              </el-radio-group>
              <div v-if="metricDialog.editing" class="type-lock-hint">已建指标的类型不可修改，如需变更请删除后重建</div>
            </el-form-item>

            <template v-if="metricForm.kind === 'base'">
              <el-form-item label="字段" required>
                <el-select v-model="metricForm.field" style="width: 100%" placeholder="选择字段">
                  <el-option v-for="f in ds.fields" :key="f.name" :label="f.label || f.name" :value="f.name" />
                </el-select>
              </el-form-item>
              <el-form-item label="聚合" required>
                <el-select v-model="metricForm.agg" style="width: 100%">
                  <el-option label="求和 sum" value="sum" />
                  <el-option label="平均 avg" value="avg" />
                  <el-option label="计数 count" value="count" />
                  <el-option label="去重计数 count_distinct" value="count_distinct" />
                  <el-option label="最大 max" value="max" />
                  <el-option label="最小 min" value="min" />
                </el-select>
              </el-form-item>
            </template>

            <template v-else-if="metricForm.kind === 'expr'">
              <el-form-item label="指标公式" required>
                <div class="formula-field">
                  <el-input v-model="metricForm.expr" type="textarea" :rows="3"
                    placeholder="如：$1 / $2 * 100（$数字 引用下方引用指标）" />
                  <div class="formula-bar">
                    <el-button link type="primary" size="small" @click="formulaHelp.show = true">
                      <el-icon style="margin-right: 2px"><QuestionFilled /></el-icon>公式怎么写？查看帮助
                    </el-button>
                    <span class="ref-empty">点击下方指标标签可插入引用</span>
                  </div>
                </div>
              </el-form-item>
              <el-form-item label="引用指标">
                <div class="expr-refs">
                  <el-tag v-for="b in libraryBaseMetrics" :key="b.id" size="small" effect="plain"
                    class="ref-tag" @click="insertLibRef(b)">
                    {{ b.name }}
                  </el-tag>
                  <span v-if="!libraryBaseMetrics.length" class="ref-empty">（暂无原子指标，请先创建「原子指标」类型指标）</span>
                </div>
              </el-form-item>
            </template>

            <template v-else>
              <el-form-item label="衍生类型" required>
                <el-select v-model="metricForm.derivative" style="width: 100%">
                  <el-option v-for="d in DERIVED_OPTIONS" :key="d.value" :label="d.label" :value="d.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="引用指标" required>
                <el-select v-model="metricForm.refId" style="width: 100%">
                  <el-option v-for="b in libraryBaseMetrics" :key="b.id" :label="b.name" :value="b.id" />
                </el-select>
              </el-form-item>
            </template>
          </el-form>
          <template #footer>
            <el-button @click="metricDialog.show = false">取消</el-button>
            <el-button type="primary" :loading="metricSaving" @click="saveMetric">保存</el-button>
          </template>
        </el-dialog>

        <el-dialog v-model="formulaHelp.show" title="指标公式帮助" width="580px" class="formula-help">
          <div class="help-section">
            <p class="help-lead">指标公式基于指标库中的「原子指标」做四则运算，产出一个新的命名指标（复合指标）。</p>
            <h4>一、语法</h4>
            <ul>
              <li>用 <code>$数字ID</code> 引用原子指标（ID 见公式输入框下方「引用指标」），例如 <code>$2</code>。</li>
              <li>支持运算符与括号：<code>+</code> <code>-</code> <code>*</code> <code>/</code> <code>( )</code>，以及数字与 <code>%</code>。</li>
              <li>整数相除会自动提升为小数，无需额外乘 1.0。</li>
            </ul>
          </div>
          <div class="help-section">
            <h4>二、规则</h4>
            <ul>
              <li>只能引用「原子指标」，不能引用复合指标或衍生指标。</li>
              <li>公式内不能出现字母（防止注入），仅允许数字、运算符、括号与空白。</li>
              <li>括号必须成对，左括号与右括号数量不一致会被拒绝。</li>
            </ul>
          </div>
          <div class="help-section">
            <h4>三、常用公式示例</h4>
            <el-table :data="helpExamples" size="small" border>
              <el-table-column prop="name" label="指标" width="120" />
              <el-table-column prop="formula" label="公式" width="230">
                <template #default="{ row }"><code>{{ row.formula }}</code></template>
              </el-table-column>
              <el-table-column prop="desc" label="说明" />
            </el-table>
          </div>
        </el-dialog>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, DataAnalysis, Plus, QuestionFilled } from '@element-plus/icons-vue'
import { datasetApi, metricApi } from '@/api'
import { useAppStore } from '@/stores/app'
import { formatDateTime } from '@/utils/datetime'
import { DERIVED_OPTIONS } from '@/utils/chart-utils'

const route = useRoute()
const id = Number(route.params.id)
const appStore = useAppStore()
const ds = ref(null)
const tab = ref('data')
const fields = ref([])
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 50
const loading = ref(false)
const metricsLib = ref([])
const metricsLoading = ref(false)
const metricSaving = ref(false)
const metricDialog = ref({ show: false, editing: null })
const metricForm = ref(emptyMetricForm())
const formulaHelp = ref({ show: false })
const helpExamples = [
  { name: '客单价', formula: '$1 / $2', desc: '销售额 ÷ 销量' },
  { name: '转化率（%）', formula: '$1 / $2 * 100', desc: '下单人数 ÷ 访客人数' },
  { name: '毛利率（%）', formula: '($1 / $2) * 100', desc: '毛利 ÷ 销售额' },
  { name: '折扣后金额', formula: '$1 * 0.9', desc: '销售额 × 9 折' },
  { name: '同比增幅（%）', formula: '($1 - $2) / $2 * 100', desc: '本期较上期涨跌' },
]

function emptyMetricForm() {
  return { name: '', kind: 'base', field: '', agg: 'sum', expr: '', derivative: 'share', refId: null }
}

function kindLabel(k) {
  return { base: '普通', expr: '公式', derived: '衍生' }[k] || k
}

function metricDefinitionText(m) {
  const d = m.definition || {}
  if (m.kind === 'base') return `${d.field}(${d.agg})`
  if (m.kind === 'expr') return d.expr
  const ref = metricsLib.value.find((x) => x.id === d.refId)
  return `${kindLabel(m.kind)}·${d.derivative} ← ${ref ? ref.name : '?'}`
}

const libraryBaseMetrics = computed(() =>
  metricsLib.value.filter((x) => x.kind === 'base' || (metricForm.value.kind === 'derived' && x.kind !== 'derived'))
)

async function loadMetrics() {
  metricsLoading.value = true
  try {
    metricsLib.value = await metricApi.list(id)
  } finally {
    metricsLoading.value = false
  }
}

function onMetricKindChange() {
  metricForm.value.field = ''
  metricForm.value.expr = ''
  metricForm.value.refId = null
}

function insertLibRef(b) {
  const prefix = metricForm.value.expr && metricForm.value.expr.trim() ? `${metricForm.value.expr.trim()} ` : ''
  metricForm.value.expr = `${prefix}$${b.id} `
}

function openMetricDialog(row) {
  if (row) {
    metricForm.value = {
      name: row.name,
      kind: row.kind,
      field: row.definition?.field || '',
      agg: row.definition?.agg || 'sum',
      expr: row.definition?.expr || '',
      derivative: row.definition?.derivative || 'share',
      refId: row.definition?.refId ?? null,
    }
    metricDialog.value.editing = row
  } else {
    metricForm.value = emptyMetricForm()
    metricDialog.value.editing = null
  }
  metricDialog.value.show = true
}

async function saveMetric() {
  const f = metricForm.value
  if (!f.name.trim()) return ElMessage.warning('请填写指标名称')
  const definition = { label: f.name }
  if (f.kind === 'base') {
    if (!f.field) return ElMessage.warning('请选择字段')
    definition.field = f.field
    definition.agg = f.agg
  } else if (f.kind === 'expr') {
    if (!f.expr.trim()) return ElMessage.warning('请填写公式')
    definition.expr = f.expr.trim()
  } else {
    if (!f.refId) return ElMessage.warning('请选择引用指标')
    definition.derivative = f.derivative
    definition.refId = f.refId
  }
  metricSaving.value = true
  try {
    if (metricDialog.value.editing) {
      await metricApi.update(id, metricDialog.value.editing.id, { name: f.name.trim(), definition })
      ElMessage.success('指标已更新')
    } else {
      await metricApi.create(id, { name: f.name.trim(), kind: f.kind, definition })
      ElMessage.success('指标已创建')
    }
    metricDialog.value.show = false
    await loadMetrics()
  } catch (e) {
    // 后端错误信息已由 http 拦截器提示
  } finally {
    metricSaving.value = false
  }
}

async function removeMetric(row) {
  try {
    await ElMessageBox.confirm(`确认删除指标「${row.name}」？被其他指标/图表引用时将无法删除。`, '删除指标', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch (e) {
    return
  }
  try {
    await metricApi.remove(id, row.id)
    ElMessage.success('指标已删除')
    await loadMetrics()
  } catch (e) {
    // 拦截器已提示
  }
}

function typeLabel(t) {
  return { string: '文本', integer: '整数', number: '小数', date: '日期', boolean: '布尔' }[t] || t
}

function typeTag(t) {
  return { string: 'info', integer: 'success', number: 'success', date: 'warning', boolean: 'danger' }[t] || 'info'
}

async function loadRows() {
  loading.value = true
  try {
    const data = await datasetApi.rows(id, page.value, pageSize)
    fields.value = data.fields
    rows.value = data.rows
    total.value = data.total
  } finally {
    loading.value = false
  }
}

async function onPageChange(p) {
  page.value = p
  loadRows()
}

async function updateFieldLabel(row) {
  try {
    await datasetApi.updateFieldLabel(id, row.id, row.label.trim())
    ElMessage.success('字段别名已更新')
    await loadRows()
  } catch (e) {
    await load()
  }
}

async function load() {
  ds.value = await datasetApi.get(id)
  await Promise.all([loadRows(), loadMetrics()])
}

onMounted(load)
</script>

<style scoped>
.d-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  flex-shrink: 0;
}

.cell-key {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 14px;
  color: var(--app-text-regular);
}

.detail-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}

.metric-name {
  font-weight: 600;
  color: var(--app-text-primary);
}

.expr-refs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.formula-field {
  width: 100%;
}

.formula-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.formula-help .help-section {
  margin-bottom: 14px;
}

.formula-help h4 {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--app-text-primary);
}

.formula-help .help-lead {
  margin: 0 0 10px;
  color: var(--app-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.formula-help ul {
  margin: 0;
  padding-left: 18px;
  color: var(--app-text-secondary);
  font-size: 13px;
  line-height: 1.9;
}

.formula-help code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--app-bg-muted, rgba(0, 0, 0, 0.05));
  font-size: 12px;
}

.ref-tag {
  cursor: pointer;
}

.ref-empty {
  color: var(--app-text-secondary);
  font-size: 12px;
}

.type-lock-hint {
  color: var(--app-text-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin-top: 4px;
}
</style>