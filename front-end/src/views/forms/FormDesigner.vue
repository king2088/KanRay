<template>
  <div class="form-designer">
    <div class="fd-header">
      <div class="fd-header__left">
        <el-button text @click="$router.push('/forms')">
          <el-icon><Back /></el-icon>返回
        </el-button>
        <el-input v-model="form.name" placeholder="表单名称" class="fd-name" maxlength="100" />
        <el-tag :type="statusType" effect="plain">{{ statusLabel }}</el-tag>
      </div>
      <div class="fd-header__actions">
        <el-button @click="openShare" :disabled="!canShare">
          <el-icon style="margin-right: 4px"><Share /></el-icon>分享
        </el-button>
        <el-button @click="$router.push(`/forms/${id}/fill`)">
          <el-icon style="margin-right: 4px"><View /></el-icon>填写
        </el-button>
        <el-button @click="$router.push(`/forms/${id}/submissions`)">
          <el-icon style="margin-right: 4px"><Tickets /></el-icon>提交记录
        </el-button>
        <el-button v-if="saveable" type="primary" :loading="saving" @click="save">
          <el-icon style="margin-right: 4px"><Check /></el-icon>{{ form.tableName ? '保存' : '保存草稿' }}
        </el-button>
        <el-button v-if="!form.tableName" type="success" :loading="publishing" @click="publish">
          <el-icon style="margin-right: 4px"><Promotion /></el-icon>发布
        </el-button>
        <el-button v-else-if="form.status === 'published'" type="warning" @click="close">
          <el-icon style="margin-right: 4px"><CircleClose /></el-icon>关闭
        </el-button>
        <el-button type="danger" plain @click="remove">
          <el-icon style="margin-right: 4px"><Delete /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="fd-body">
      <aside class="fd-palette">
        <div class="fd-pane-title">控件库</div>
        <div class="fd-palette__items">
          <div
            v-for="item in palette"
            :key="item.type"
            class="fd-palette__item"
            draggable="true"
            :class="{ 'fd-palette__item--locked': lockedFields }"
            @dragstart="lockedFields ? null : onPaletteDrag($event, item)"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </div>
        </div>
        <div class="fd-pane-title" style="margin-top: 16px">提示</div>
        <div class="fd-palette__tip">
          <p v-if="!form.tableName">拖拽控件到中间画布即可加入表单；发布后建表入库。</p>
          <p v-else>已发布：可继续添加新字段；但删除或修改既有字段类型将受数据保护限制。</p>
        </div>
      </aside>

      <main
        class="fd-canvas"
        @dragover.prevent
        @drop="onCanvasDrop"
      >
        <div class="fd-canvas__inner">
          <div class="fd-canvas__desc">
            <el-input v-model="form.description" type="textarea" :rows="2" placeholder="表单说明（选填）" maxlength="1000" />
          </div>
          <div v-if="!fields.length" class="fd-canvas__empty" @click="addDefault">
            <el-icon style="font-size: 40px"><FolderAdd /></el-icon>
            <p>从左侧拖拽控件到这里，或点击直接添加第一个字段</p>
          </div>
          <div
            v-for="(field, index) in fields"
            :key="field.__uid"
            class="fd-field"
            :class="{ 'fd-field--active': selected === field.__uid }"
            draggable="true"
            @click="selected = field.__uid"
            @dragstart="onFieldDrag($event, index)"
            @dragover.prevent
            @drop.stop="onFieldDrop($event, index)"
          >
            <div class="fd-field__head">
              <el-icon class="fd-field__drag"><Rank /></el-icon>
              <span class="fd-field__label">{{ field.label }}</span>
              <el-tag size="small" effect="plain" class="fd-field__type">{{ typeLabel(field.type) }}</el-tag>
              <el-tag v-if="field.required && field.type !== 'static'" size="small" type="danger" effect="plain">必填</el-tag>
              <span v-if="!field.validKey" class="fd-field__warn">key 非法</span>
              <div class="fd-field__ops">
                <el-button link size="small" :disabled="index === 0" @click.stop="move(index, -1)"><el-icon><Top /></el-icon></el-button>
                <el-button link size="small" :disabled="index === fields.length - 1" @click.stop="move(index, 1)"><el-icon><Bottom /></el-icon></el-button>
                <el-button link size="small" type="danger" @click.stop="removeField(field)"><el-icon><Delete /></el-icon></el-button>
              </div>
            </div>
            <div class="fd-field__preview">
              <template v-if="field.type === 'static'">
                <div class="fd-field__static">{{ field.content || field.label }}</div>
              </template>
              <template v-else-if="field.type === 'textarea'">
                <el-input :placeholder="`请输入${field.label}`" disabled />
              </template>
              <template v-else-if="field.type === 'number'">
                <el-input-number :model-value="0" controls-position="right" disabled style="width: 100%" />
              </template>
              <template v-else-if="field.type === 'date'">
                <el-date-picker type="date" placeholder="选择日期" disabled style="width: 100%" />
              </template>
              <template v-else-if="field.type === 'select'">
                <el-select :placeholder="`请选择${field.label}`" disabled style="width: 100%">
                  <el-option v-for="o in field.options" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </template>
              <template v-else-if="field.type === 'radio'">
                <el-radio-group :model-value="null" disabled>
                  <el-radio v-for="o in field.options" :key="o.value" :value="o.value">{{ o.label }}</el-radio>
                </el-radio-group>
              </template>
              <template v-else-if="field.type === 'checkbox'">
                <el-checkbox-group :model-value="[]" disabled>
                  <el-checkbox v-for="o in field.options" :key="o.value" :value="o.value">{{ o.label }}</el-checkbox>
                </el-checkbox-group>
              </template>
              <template v-else>
                <el-input :placeholder="`请输入${field.label}`" disabled />
              </template>
            </div>
          </div>
        </div>
      </main>

      <aside class="fd-props">
        <el-tabs v-model="propTab">
          <el-tab-pane label="字段属性" name="field">
            <div v-if="!activeField" class="fd-props__empty">选中一个字段编辑属性</div>
            <el-form v-else label-position="top" size="small">
              <el-form-item label="标签" required>
                <el-input v-model="activeField.label" maxlength="100" placeholder="显示名称" />
              </el-form-item>
              <el-form-item label="字段 key（入库列名）" required>
                <el-input v-model="activeField.key" :disabled="fieldKeyLocked(activeField)" placeholder="字母/数字/下划线" />
                <div class="fd-props__hint" :class="{ 'fd-props__hint--err': !activeField.validKey }">
                  {{ activeField.validKey ? '物理表列名，发布后不可改' : '仅允许字母/数字/下划线，且不能以数字开头' }}
                </div>
              </el-form-item>
              <el-form-item label="控件类型">
                <el-select v-model="activeField.type" :disabled="fieldKeyLocked(activeField)" @change="onTypeChange">
                  <el-option v-for="t in palette" :key="t.type" :label="t.label" :value="t.type" />
                </el-select>
              </el-form-item>
              <template v-if="activeField.type === 'static'">
                <el-form-item label="说明内容">
                  <el-input v-model="activeField.content" type="textarea" :rows="3" maxlength="5000" placeholder="正文说明文字" />
                </el-form-item>
              </template>
              <template v-else>
                <el-form-item label="必填">
                  <el-switch v-model="activeField.required" />
                </el-form-item>
                <el-form-item v-if="activeField.type === 'text' || activeField.type === 'textarea'" label="占位提示">
                  <el-input v-model="activeField.placeholder" maxlength="200" />
                </el-form-item>
                <el-form-item label="宽度">
                  <el-radio-group v-model="activeField.span">
                    <el-radio-button :value="1">半行</el-radio-button>
                    <el-radio-button :value="2">整行</el-radio-button>
                  </el-radio-group>
                </el-form-item>
                <el-form-item v-if="'select:radio:checkbox'.includes(activeField.type)" label="选项">
                  <div class="fd-options">
                    <div v-for="(opt, i) in activeField.options" :key="i" class="fd-options__row">
                      <el-input v-model="opt.label" size="small" placeholder="显示" style="width: 45%" />
                      <el-input v-model="opt.value" size="small" placeholder="值" style="width: 45%" />
                      <el-button link size="small" type="danger" @click="activeField.options.splice(i, 1)"><el-icon><Delete /></el-icon></el-button>
                    </div>
                    <el-button size="small" plain @click="activeField.options.push({ label: '', value: '' })">
                      <el-icon style="margin-right: 2px"><Plus /></el-icon>添加选项
                    </el-button>
                  </div>
                </el-form-item>
              </template>
            </el-form>
          </el-tab-pane>
          <el-tab-pane label="表单设置" name="form">
            <el-form label-position="top" size="small">
              <el-form-item label="提交成功提示">
                <el-input v-model="form.submitConfig.successText" maxlength="100" placeholder="提交成功" />
              </el-form-item>
              <el-form-item label="登录用户重复提交">
                <el-switch v-model="form.submitConfig.allowRepeat" active-text="允许" inactive-text="每人一次" />
              </el-form-item>
              <div class="fd-props__hint">匿名/免登录链接分享者不受「每人一次」限制。</div>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </aside>
    </div>

    <FormShareDialog v-if="shareDialog.open" v-model="shareDialog.open" :form-id="id" :name="form.name" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Back, Check, Delete, Bottom, Top, Fold, Promotion, CircleClose,
  Share, View, Tickets, Rank, FolderAdd, Plus, EditPen, Edit, Tickets as TicketsIcon,
} from '@element-plus/icons-vue'
import { formApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { KEY_RE } from '@/utils/form-meta'
import FormShareDialog from '@/components/form/FormShareDialog.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const id = Number(route.params.id)
const canShare = computed(() => auth.hasPermission('form', 'share'))

const palette = [
  { type: 'text', label: '单行文本', icon: EditPen },
  { type: 'textarea', label: '多行文本', icon: Edit },
  { type: 'number', label: '数字', icon: Fold },
  { type: 'date', label: '日期', icon: Fold },
  { type: 'select', label: '下拉选择', icon: Fold },
  { type: 'radio', label: '单选', icon: Fold },
  { type: 'checkbox', label: '多选', icon: Fold },
  { type: 'static', label: '说明文字', icon: TicketsIcon },
]

const form = reactive({
  id: 0, name: '', description: '', status: 'draft', tableName: null,
  schema: { version: 1, fields: [] },
  submitConfig: { successText: '提交成功', allowRepeat: true },
})
const fields = ref([])
const selected = ref(null)
const propTab = ref('field')
const saving = ref(false)
const publishing = ref(false)
const shareDialog = ref({ open: false, formId: 0, name: '' })
let uidSeq = 1

const statusLabel = computed(() => ({ draft: '草稿', published: '已发布', closed: '已关闭' })[form.status] || form.status)
const statusType = computed(() => ({ draft: 'info', published: 'success', closed: 'warning' })[form.status] || 'info')
const lockedFields = computed(() => !!form.tableName)
const saveable = computed(() => !publishing.value)
function fieldKeyLocked(field) {
  return form.tableName && field.__uid.startsWith('s')
}
function activeField() {
  return fields.value.find((f) => f.__uid === selected.value)
}
const activeFieldProxy = computed(() => fields.value.find((f) => f.__uid === selected.value))

let newFieldKeys = new Set()
function keyFor(label, field) {
  const base = (label || '字段').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'field'
  const safeBase = /^[a-zA-Z_]/.test(base) ? base : `f_${base}`
  let k = kFor(safeBase, field)
  while ((fields.value.some((f) => f !== field && f.key === k)) || newFieldKeys.has(k)) {
    k = kFor(safeBase, field)
    newFieldKeys.add(k)
  }
  return k
}
let conflict = 0
function kFor(base) {
  conflict += 1
  return `${base}_${(Date.now() + conflict).toString(36)}`.slice(0, 40)
}
function makeField(type, baseLabel) {
  const f = {
    __uid: `f${uidSeq++}`,
    key: '', label: baseLabel || '新字段', type,
    required: false, placeholder: '', span: 2, group: null,
    options: type === 'select' || type === 'radio' || type === 'checkbox' ? [{ label: '选项一', value: 'opt1' }] : [],
    content: '', validKey: true,
  }
  f.key = keyFor(f.label, f)
  f.validKey = KEY_RE.test(f.key)
  return f
}

function typeLabel(t) {
  return palette.find((p) => p.type === t)?.label || t
}

function onPaletteDrag(event, item) {
  event.dataTransfer?.setData('palette-type', item.type)
  event.dataTransfer?.setData('palette-label', item.label)
  event.dataTransfer.effectAllowed = 'copy'
}

function onCanvasDrop(event) {
  const type = event.dataTransfer?.getData('palette-type')
  if (!type) return
  const label = event.dataTransfer.getData('palette-label') || '新字段'
  const f = makeField(type, label)
  fields.value.push(f)
  selected.value = f.__uid
  propTab.value = 'field'
}

function addDefault() {
  const f = makeField('text', '单行文本')
  fields.value.push(f)
  selected.value = f.__uid
  propTab.value = 'field'
}

function onFieldDrag(event, index) {
  event.dataTransfer?.setData('field-index', String(index))
  event.dataTransfer.effectAllowed = 'move'
}

function onFieldDrop(event, index) {
  const from = Number(event.dataTransfer?.getData('field-index'))
  if (Number.isFinite(from) && from !== index && from >= 0 && from < fields.value.length) {
    const [item] = fields.value.splice(from, 1)
    fields.value.splice(index, 0, item)
  }
}

function move(index, delta) {
  const to = index + delta
  if (to < 0 || to >= fields.value.length) return
  const arr = fields.value
  const [item] = arr.splice(index, 1)
  arr.splice(to, 0, item)
}

async function removeField(field) {
  fields.value = fields.value.filter((f) => f.__uid !== field.__uid)
  if (selected.value === field.__uid) selected.value = null
}

function onTypeChange(type) {
  const f = activeFieldProxy.value
  if (!f) return
  const needsOptions = 'select:radio:checkbox'.includes(type)
  const hasOptions = Array.isArray(f.options) && f.options.length
  if (needsOptions && !hasOptions) f.options = [{ label: '选项一', value: 'opt1' }]
  if (!needsOptions) f.options = []
  if (type === 'static') f.content = f.content || f.label
}

function serialize() {
  return {
    name: form.name,
    description: form.description,
    submitConfig: form.submitConfig,
    schemaJson: {
      version: 1,
      fields: fields.value.map(({ __uid, validKey, options, ...rest }) => ({
        ...rest,
        options: rest.type === 'select' || rest.type === 'radio' || rest.type === 'checkbox' ? (options || []).filter((o) => (o.label || '').trim() && (o.value || '').trim()) : [],
      })),
    },
  }
}

function preflight() {
  if (!form.name.trim()) return ElMessage.warning('请先填写表单名称') || false
  for (const f of fields.value) {
    if (!f.validKey || !f.key.trim()) return ElMessage.warning(`字段「${f.label}」的 key 不合法`) || false
  }
  const seen = new Set()
  for (const f of fields.value) {
    if (f.type === 'static') continue
    if (seen.has(f.key)) return ElMessage.warning(`字段 key 重复：${f.key}`) || false
    seen.add(f.key)
  }
  return true
}

async function save() {
  if (!preflight()) return
  saving.value = true
  try {
    const updated = await formApi.update(id, serialize())
    applyForm(updated)
    ElMessage.success('已保存')
  } finally {
    saving.value = false
  }
}

async function publish() {
  await save()
  if (!form.tableName) {
    publishing.value = true
    try {
      const updated = await formApi.publish(id)
      applyForm(updated)
      ElMessage.success('发布成功，已建表并注册为数据集')
    } finally {
      publishing.value = false
    }
  }
}

async function close() {
  try {
    await ElMessageBox.confirm('关闭后登录用户将无法提交；可通过重新发布恢复。确定关闭？', '关闭表单', { type: 'warning' })
  } catch (e) {
    return
  }
  const updated = await formApi.close(id)
  applyForm(updated)
  ElMessage.success('已关闭')
}

async function remove() {
  try {
    await ElMessageBox.confirm(`确定删除表单「${form.name}」？其数据表与全部提交记录将一并删除，不可恢复。`, '删除确认', { type: 'error' })
  } catch (e) {
    return
  }
  await formApi.remove(id)
  ElMessage.success('已删除')
  router.push('/forms')
}

function openShare() {
  shareDialog.value = { open: true, formId: id, name: form.name }
}

function applyForm(data) {
  form.id = data.id
  form.name = data.name
  form.description = data.description
  form.status = data.status
  form.tableName = data.tableName
  form.schema = data.schema
  form.submitConfig = { successText: '提交成功', allowRepeat: true, ...data.submitConfig }
  fields.value = (data.schema?.fields || []).map((f) => ({
    __uid: `s${f.key}`,
    ...f,
    options: Array.isArray(f.options) ? f.options : [],
    content: f.content || '',
    validKey: KEY_RE.test(f.key),
  }))
}

async function load() {
  try {
    const data = await formApi.get(id)
    applyForm(data)
  } catch (e) {
    router.replace('/forms')
  }
}

onMounted(load)
</script>

<style scoped>
.form-designer {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  background: #f5f6f8;
  border-radius: 12px;
  overflow: hidden;
}
.fd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid var(--el-border-color-lighter);
  gap: 8px;
}
.fd-header__left,
.fd-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fd-name {
  width: 260px;
}
.fd-body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.fd-palette {
  width: 200px;
  background: #fff;
  border-right: 1px solid var(--el-border-color-lighter);
  padding: 14px;
  overflow-y: auto;
}
.fd-pane-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 10px;
}
.fd-palette__items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fd-palette__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  cursor: grab;
  background: var(--el-fill-color-lighter);
  transition: all 0.15s;
}
.fd-palette__item:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
.fd-palette__item--locked {
  opacity: 0.5;
  cursor: not-allowed;
}
.fd-palette__tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.7;
}
.fd-canvas {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 20px;
}
.fd-canvas__inner {
  max-width: 760px;
  margin: 0 auto;
  background: #fff;
  border: 1px dashed var(--el-border-color);
  border-radius: 12px;
  padding: 20px;
  min-height: 60%;
}
.fd-canvas__desc {
  margin-bottom: 14px;
}
.fd-canvas__empty {
  text-align: center;
  color: var(--el-text-color-placeholder);
  padding: 60px 20px;
  cursor: pointer;
}
.fd-field {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s;
}
.fd-field--active {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary);
}
.fd-field__head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fd-field__drag {
  cursor: grab;
  color: var(--el-text-color-placeholder);
}
.fd-field__label {
  font-weight: 600;
  font-size: 13px;
}
.fd-field__type {
  margin: 0 !important;
}
.fd-field__warn {
  color: var(--el-color-danger);
  font-size: 12px;
}
.fd-field__ops {
  margin-left: auto;
  display: flex;
  align-items: center;
}
.fd-field__preview {
  margin-top: 8px;
}
.fd-field__static {
  color: var(--el-text-color-secondary);
  white-space: pre-wrap;
  padding: 4px 0;
}
.fd-props {
  width: 300px;
  background: #fff;
  border-left: 1px solid var(--el-border-color-lighter);
  padding: 14px;
  overflow-y: auto;
}
.fd-props__empty {
  color: var(--el-text-color-placeholder);
  text-align: center;
  padding: 30px 0;
}
.fd-props__hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin-top: 4px;
}
.fd-props__hint--err {
  color: var(--el-color-danger);
}
.fd-options {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fd-options__row {
  display: flex;
  gap: 6px;
  align-items: center;
}
</style>