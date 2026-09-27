<template>
  <div class="page-container">
    <div v-if="ds" class="dataset-detail">
      <div class="page-header">
        <div class="page-header__main d-header">
          <el-button circle class="back-btn" @click="$router.push('/datasets')"><el-icon><ArrowLeft /></el-icon></el-button>
          <div>
            <h2 class="page-title">{{ ds.name }}</h2>
            <div class="page-desc">{{ t('dataset.detail.sourcePrefix') }}{{ ds.original_file || '-' }} · {{ t('dataset.detail.createdAtPrefix') }} {{ formatDateTime(ds.created_at, appStore.timezone) }}</div>
          </div>
        </div>
        <div class="page-header__actions">
          <el-button type="primary" @click="$router.push(`/charts/new?dataset=${ds.id}`)">
            <el-icon style="margin-right: 6px"><DataAnalysis /></el-icon>{{ t('dataset.detail.buildChart') }}
          </el-button>
        </div>
      </div>

      <div class="stat-strip">
        <div class="stat-item">
          <div class="stat-item__icon"><el-icon><DataLine /></el-icon></div>
          <div>
            <div class="stat-item__value">{{ (ds.row_count || 0).toLocaleString(locale) }}</div>
            <div class="stat-item__label">{{ t('dataset.detail.statRows') }}</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-item__icon"><el-icon><Grid /></el-icon></div>
          <div>
            <div class="stat-item__value">{{ ds.column_count }}</div>
            <div class="stat-item__label">{{ t('dataset.detail.statCols') }}</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-item__icon"><el-icon><Files /></el-icon></div>
          <div>
            <div class="stat-item__value">{{ ds.fields.length }}</div>
            <div class="stat-item__label">{{ t('dataset.detail.statFields') }}</div>
          </div>
        </div>
      </div>

      <el-tabs v-model="tab" class="detail-tabs">
        <el-tab-pane :label="t('dataset.detail.tabData')" name="data">
          <div class="page-card">
            <div class="page-card__body">
              <div v-loading="loading" style="min-height: 220px">
                <el-table :data="rows" max-height="460" :empty-text="t('dataset.detail.emptyRows')">
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

        <el-tab-pane :label="t('dataset.detail.tabFields')" name="fields">
          <div class="page-card">
            <div class="page-card__header">
              <div class="page-card__header-title">{{ t('dataset.detail.fieldsCardTitle') }}</div>
              <div class="page-card__header-right">
                <el-tag  type="info" effect="plain">{{ t('dataset.detail.fieldsCardTip') }}</el-tag>
              </div>
            </div>
            <el-table :data="ds.fields">
              <el-table-column prop="name" :label="t('dataset.detail.colInternalName')" min-width="160">
                <template #default="{ row }">
                  <span class="cell-key">{{ row.name }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="label" :label="t('dataset.detail.colDisplayName')" min-width="200">
                <template #default="{ row }">
                  <el-input v-model="row.label"  :placeholder="t('dataset.detail.displayNamePlaceholder')" @change="() => updateFieldLabel(row)" />
                </template>
              </el-table-column>
              <el-table-column prop="type" :label="t('dataset.field.type')" width="130">
                <template #default="{ row }">
                  <el-tag  :type="typeTag(row.type)">{{ fieldTypeLabel(row.type) }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="t('dataset.detail.tabMetrics')" name="metrics">
          <div class="page-card">
            <div class="page-card__header">
              <div class="page-card__header-title">
                {{ t('dataset.detail.tabMetrics') }}
                <el-tag type="info" effect="plain" style="margin-left: 8px">{{ t('dataset.detail.metricsCardTip') }}</el-tag>
              </div>
              <div class="page-card__header-right">
                <el-button type="primary" size="small" @click="openMetricDialog()">
                  <el-icon style="margin-right: 4px"><Plus /></el-icon>{{ t('dataset.detail.createMetric') }}
                </el-button>
              </div>
            </div>
            <el-table :data="metricsLib" v-loading="metricsLoading" :empty-text="t('dataset.detail.emptyMetrics')">
              <el-table-column prop="name" :label="t('dataset.list.name')" min-width="180">
                <template #default="{ row }"><span class="metric-name">{{ row.name }}</span></template>
              </el-table-column>
              <el-table-column :label="t('dataset.field.type')" width="90">
                <template #default="{ row }">
                  <el-tag :type="{ base: 'success', expr: 'warning', derived: 'danger' }[row.kind]" effect="light">
                    {{ kindLabel(row.kind) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="t('dataset.detail.colDefinition')" min-width="240">
                <template #default="{ row }"><span class="cell-key">{{ metricDefinitionText(row) }}</span></template>
              </el-table-column>
              <el-table-column prop="created_at" :label="t('dataset.list.colCreatedAt')" width="180">
                <template #default="{ row }">{{ formatDateTime(row.created_at, appStore.timezone) }}</template>
              </el-table-column>
              <el-table-column :label="t('dataset.list.actions')" width="150" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" size="small" @click="openMetricDialog(row)">{{ t('common.actions.edit') }}</el-button>
                  <el-button link type="danger" size="small" @click="removeMetric(row)">{{ t('common.actions.delete') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-dialog v-model="metricDialog.show" :title="metricDialog.editing ? t('dataset.detail.editMetric') : t('dataset.detail.createMetric')" width="520px">
          <el-form label-width="88px">
            <el-form-item :label="t('dataset.detail.metricNameLabel')" required>
              <el-input v-model="metricForm.name" :placeholder="t('dataset.detail.metricNamePlaceholder')" maxlength="100" />
            </el-form-item>
            <el-form-item :label="t('dataset.detail.metricKindLabel')" required>
              <el-radio-group v-model="metricForm.kind" :disabled="!!metricDialog.editing" @change="onMetricKindChange">
                <el-radio-button value="base">{{ t('dataset.detail.kindBase') }}</el-radio-button>
                <el-radio-button value="expr">{{ t('dataset.detail.kindExpr') }}</el-radio-button>
                <el-radio-button value="derived">{{ t('dataset.detail.kindDerived') }}</el-radio-button>
              </el-radio-group>
              <div v-if="metricDialog.editing" class="type-lock-hint">{{ t('dataset.detail.typeLockHint') }}</div>
            </el-form-item>

            <!-- decimals 必须放在三个 kind 分支之外，否则只有 base 类型能配小数位 -->
            <el-form-item :label="t('dataset.detail.decimalsLabel')">
              <el-input-number v-model="metricForm.decimals" :min="0" :max="10" :step="1" style="width: 180px" />
              <div class="type-lock-hint">{{ t('dataset.detail.decimalsPlaceholder') }}</div>
            </el-form-item>

            <template v-if="metricForm.kind === 'base'">
              <el-form-item :label="t('dataset.detail.fieldLabel')" required>
                <el-select v-model="metricForm.field" style="width: 100%" :placeholder="t('dataset.detail.fieldPlaceholder')">
                  <el-option v-for="f in ds.fields" :key="f.name" :label="f.label || f.name" :value="f.name" />
                </el-select>
              </el-form-item>
              <el-form-item :label="t('dataset.detail.aggLabel')" required>
                <el-select v-model="metricForm.agg" style="width: 100%">
                  <el-option v-for="o in AGG_OPTIONS" :key="o.value" :label="t(o.labelKey)" :value="o.value" />
                </el-select>
              </el-form-item>
            </template>

            <template v-else-if="metricForm.kind === 'expr'">
              <el-form-item :label="t('dataset.detail.exprLabel')" required>
                <div class="formula-field">
                  <el-input v-model="metricForm.expr" type="textarea" :rows="3"
                    :placeholder="t('dataset.detail.exprPlaceholder')" />
                  <div class="formula-bar">
                    <el-button link type="primary" size="small" @click="formulaHelp.show = true">
                      <el-icon style="margin-right: 2px"><QuestionFilled /></el-icon>{{ t('dataset.detail.formulaHelpBtn') }}
                    </el-button>
                    <span class="ref-empty">{{ t('dataset.detail.refHint') }}</span>
                  </div>
                </div>
              </el-form-item>
              <el-form-item :label="t('dataset.detail.refLabel')">
                <div class="expr-refs">
                  <el-tag v-for="b in libraryBaseMetrics" :key="b.id" size="small" effect="plain"
                    class="ref-tag" @click="insertLibRef(b)">
                    {{ b.name }}
                  </el-tag>
                  <span v-if="!libraryBaseMetrics.length" class="ref-empty">{{ t('dataset.detail.refEmpty') }}</span>
                </div>
              </el-form-item>
            </template>

            <template v-else>
              <el-form-item :label="t('dataset.detail.derivativeLabel')" required>
                <el-select v-model="metricForm.derivative" style="width: 100%">
                  <el-option v-for="d in DERIVED_OPTIONS" :key="d.value" :label="t(d.labelKey)" :value="d.value" />
                </el-select>
              </el-form-item>
              <el-form-item :label="t('dataset.detail.refLabel')" required>
                <el-select v-model="metricForm.refId" style="width: 100%">
                  <el-option v-for="b in libraryBaseMetrics" :key="b.id" :label="b.name" :value="b.id" />
                </el-select>
              </el-form-item>
            </template>
          </el-form>
          <template #footer>
            <el-button @click="metricDialog.show = false">{{ t('common.actions.cancel') }}</el-button>
            <el-button type="primary" :loading="metricSaving" @click="saveMetric">{{ t('common.actions.save') }}</el-button>
          </template>
        </el-dialog>

        <el-dialog v-model="formulaHelp.show" :title="t('dataset.metric.help.title')" width="580px" class="formula-help">
          <div class="help-section">
            <p class="help-lead">{{ t('dataset.metric.help.lead') }}</p>
            <h4>{{ t('dataset.metric.help.hSyntax') }}</h4>
            <ul>
              <li>
                {{ t('dataset.metric.help.syntaxLead') }}
                <code>$&lt;{{ t('dataset.metric.help.idToken') }}&gt;</code>
                {{ t('dataset.metric.help.syntaxExample', { sample: '$0189…' }) }}
              </li>
              <li>
                {{ t('dataset.metric.help.opsIntro') }}
                <code>+</code> <code>-</code> <code>*</code> <code>/</code> <code>( )</code>
                {{ t('dataset.metric.help.opsOutro') }} <code>%</code>
              </li>
              <li>{{ t('dataset.metric.help.intDivide') }}</li>
            </ul>
          </div>
          <div class="help-section">
            <h4>{{ t('dataset.metric.help.hRules') }}</h4>
            <ul>
              <li>{{ t('dataset.metric.help.onlyBase') }}</li>
              <li>
                {{ t('dataset.metric.help.noLettersLead') }}
                <code>$&lt;{{ t('dataset.metric.help.idToken') }}&gt;</code>
                {{ t('dataset.metric.help.noLettersTail') }}
              </li>
              <li>{{ t('dataset.metric.help.parens') }}</li>
            </ul>
          </div>
          <div class="help-section">
            <h4>{{ t('dataset.metric.help.hExamples') }}</h4>
            <el-table :data="helpExamples" size="small" border>
              <el-table-column prop="name" :label="t('dataset.metric.help.colMetric')" width="120" />
              <el-table-column prop="formula" :label="t('dataset.metric.help.colFormula')" width="230">
                <template #default="{ row }"><code>{{ row.formula }}</code></template>
              </el-table-column>
              <el-table-column prop="desc" :label="t('dataset.metric.help.colDesc')" />
            </el-table>
          </div>
        </el-dialog>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, DataAnalysis, Plus, QuestionFilled } from '@element-plus/icons-vue'
import { datasetApi, metricApi } from '@/api'
import { useAppStore } from '@/stores/app'
import { formatDateTime } from '@/utils/datetime'
import { AGG_OPTIONS } from '@/utils/catalog'
import { DERIVED_OPTIONS } from '@/utils/chart-utils'
import { fieldTypeLabel } from '@/utils/field-type-label'
import { t } from '@/i18n'

const { locale } = useI18n()
const route = useRoute()
const id = String(route.params.id)
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
// 公式示例用语言中立的数字 ID 占位符（与真实公式形态一致），名称与说明走词典。
const helpExamples = computed(() => [
  { name: t('dataset.metric.help.ex1.name'), formula: '$<1> / $<2>', desc: t('dataset.metric.help.ex1.desc') },
  { name: t('dataset.metric.help.ex2.name'), formula: '$<3> / $<4> * 100', desc: t('dataset.metric.help.ex2.desc') },
  { name: t('dataset.metric.help.ex3.name'), formula: '($<5> - $<6>) / $<5> * 100', desc: t('dataset.metric.help.ex3.desc') },
  { name: t('dataset.metric.help.ex4.name'), formula: '$<1> * 0.9', desc: t('dataset.metric.help.ex4.desc') },
  { name: t('dataset.metric.help.ex5.name'), formula: '($<7> - $<8>) / $<8> * 100', desc: t('dataset.metric.help.ex5.desc') },
])

function emptyMetricForm() {
  return { name: '', kind: 'base', field: '', agg: 'sum', expr: '', derivative: 'share', refId: null, decimals: 0 }
}

function kindLabel(k) {
  const key = { base: 'base', expr: 'expr', derived: 'derived' }[k]
  return key ? t('dataset.metric.kind.' + key) : k
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
      decimals: row.decimals ?? 0,
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
  if (!f.name.trim()) return ElMessage.warning(t('dataset.metric.nameRequired'))
  const definition = { label: f.name }
  if (f.kind === 'base') {
    if (!f.field) return ElMessage.warning(t('dataset.metric.fieldRequired'))
    definition.field = f.field
    definition.agg = f.agg
  } else if (f.kind === 'expr') {
    if (!f.expr.trim()) return ElMessage.warning(t('dataset.metric.exprRequired'))
    definition.expr = f.expr.trim()
  } else {
    if (!f.refId) return ElMessage.warning(t('dataset.metric.refRequired'))
    definition.derivative = f.derivative
    definition.refId = f.refId
  }
  metricSaving.value = true
  try {
    if (metricDialog.value.editing) {
      await metricApi.update(id, metricDialog.value.editing.id, { name: f.name.trim(), definition, decimals: f.decimals ?? 0 })
      ElMessage.success(t('dataset.metric.updated'))
    } else {
      await metricApi.create(id, { name: f.name.trim(), kind: f.kind, definition, decimals: f.decimals ?? 0 })
      ElMessage.success(t('dataset.metric.created'))
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
    await ElMessageBox.confirm(
      t('dataset.metric.deleteConfirm', { name: row.name }),
      t('dataset.metric.deleteTitle'),
      {
        type: 'warning',
        confirmButtonText: t('common.actions.delete'),
        cancelButtonText: t('common.actions.cancel'),
      }
    )
  } catch (e) {
    return
  }
  try {
    await metricApi.remove(id, row.id)
    ElMessage.success(t('dataset.metric.deleted'))
    await loadMetrics()
  } catch (e) {
    // 拦截器已提示
  }
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
    ElMessage.success(t('dataset.detail.fieldAliasUpdated'))
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
  background: var(--app-surface-2);
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