<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">{{ t('bigscreen.list.title') }}</h2>
        <div class="page-desc">{{ t('bigscreen.list.desc') }}</div>
      </div>
      <div class="page-header__actions">
        <el-button @click="openTemplates">
          <el-icon style="margin-right: 4px"><Folder /></el-icon>{{ t('bigscreen.list.templateManage') }}
        </el-button>
        <el-button type="primary" @click="create">
          <el-icon style="margin-right: 4px"><Plus /></el-icon>{{ t('bigscreen.list.create') }}
        </el-button>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div class="page-card__header-title">{{ t('bigscreen.list.listTitle') }}</div>
        <div class="page-card__header-right">
          <el-input v-model="search" :placeholder="t('bigscreen.list.searchPlaceholder')" clearable style="width: 240px" :prefix-icon="Search" />
          <el-tag type="info" effect="plain">{{ t('bigscreen.list.total', { count: total }) }}</el-tag>
        </div>
      </div>

      <el-table :data="filtered" v-loading="loading" :empty-text="t('bigscreen.list.empty')">
        <el-table-column prop="name" :label="t('bigscreen.list.colName')" min-width="220">
          <template #default="{ row }">
            <div class="cell-name">
              <div class="cell-name__icon"><el-icon><Monitor /></el-icon></div>
              <el-link type="primary" @click="$router.push(`/big-screen/design/${row.id}`)">{{ row.name }}</el-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="t('bigscreen.list.colPublishStatus')" width="100">
          <template #default="{ row }">
            <el-tag :type="row.published ? 'success' : 'info'" effect="plain">{{ row.published ? t('bigscreen.list.published') : t('bigscreen.list.unpublished') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" :label="t('bigscreen.list.colCreatedAt')" width="180">
          <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="updatedAt" :label="t('bigscreen.list.colUpdatedAt')" width="180">
          <template #default="{ row }">{{ fmt(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column fixed="right" :label="t('bigscreen.list.colActions')" width="250" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openPreview(row)">{{ t('bigscreen.list.preview') }}</el-button>
            <el-button link type="primary" @click="openShare(row)"><el-icon style="margin-right: 4px"><Share /></el-icon>{{ t('bigscreen.list.share') }}</el-button>
            <el-popconfirm :title="t('bigscreen.list.deleteConfirm')" @confirm="remove(row)">
              <template #reference><el-button link type="danger">{{ t('bigscreen.list.delete') }}</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="total > pageSize" class="page-card__footer">
        <el-pagination background layout="prev, pager, next" :page-size="pageSize" :total="total" v-model:current-page="page" />
      </div>
    </div>

    <el-dialog v-model="showCreate" :title="t('bigscreen.list.createDialogTitle')" width="420px" @close="createForm.name = ''">
      <el-form @submit.prevent="submitCreate">
        <el-form-item :label="t('bigscreen.list.nameLabel')" required>
          <el-input v-model.trim="createForm.name" :placeholder="t('bigscreen.list.namePlaceholder')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">{{ t('bigscreen.list.cancel') }}</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">{{ t('bigscreen.list.confirm') }}</el-button>
      </template>
    </el-dialog>

    <BigScreenShareDialog v-model="share.show" :screen-id="share.screenId" :name="share.screenName" />

    <el-dialog v-model="showTemplates" :title="t('bigscreen.list.templateManage')" width="1040px" top="5vh" class="template-manager-dialog">
      <div class="tm-section">
        <div class="tm-section__title">{{ t('bigscreen.list.templateSection') }}</div>
        <div class="tm-grid">
          <div v-for="tpl in presetTemplates" :key="tpl.id" class="tm-card">
            <div class="tm-card__preview" :style="{ background: tpl.config.background }">
              <img v-if="thumbs[tpl.id]" :src="thumbs[tpl.id]" class="tm-card__thumb" />
              <div v-else class="tm-card__placeholder">{{ tpl.config.width }}×{{ tpl.config.height }}</div>
              <div class="tm-card__size">{{ tpl.config.width }}×{{ tpl.config.height }}</div>
            </div>
            <div class="tm-card__body">
              <div class="tm-card__name">{{ t(tpl.nameKey) }}</div>
              <div class="tm-card__desc">{{ t(tpl.descriptionKey) }}</div>
              <el-button size="small" type="primary" @click="startCreateFromTemplate(tpl)">{{ t('bigscreen.list.useThisTemplate') }}</el-button>
            </div>
          </div>
        </div>
      </div>

      <el-divider />

      <div class="tm-section">
        <div class="tm-section__title">{{ t('bigscreen.list.myTemplates', { count: myTemplates.length }) }}</div>
        <div v-if="myTemplates.length > 0" class="tm-grid">
          <div v-for="tpl in myTemplates" :key="tpl.id" class="tm-card">
            <div class="tm-card__preview" :style="{ background: tpl.config?.background || '#0b1a30' }">
              <img v-if="tpl.thumbnail" :src="tpl.thumbnail" class="tm-card__thumb" />
              <div v-else class="tm-card__placeholder">{{ tpl.config?.width || 1920 }}×{{ tpl.config?.height || 1080 }}</div>
              <div class="tm-card__size">{{ tpl.config?.width || 1920 }}×{{ tpl.config?.height || 1080 }}</div>
            </div>
            <div class="tm-card__body">
              <div class="tm-card__name">{{ tpl.name }}</div>
              <div class="tm-card__desc">{{ tpl.description || t('bigscreen.list.noDescription') }}</div>
              <div class="tm-card__actions">
                <el-button size="small" type="primary" @click="startCreateFromTemplate(tpl)">{{ t('bigscreen.list.use') }}</el-button>
                <el-button size="small" type="danger" @click="removeTemplate(tpl)">{{ t('bigscreen.list.delete') }}</el-button>
              </div>
            </div>
          </div>
        </div>
        <el-empty v-else :description="t('bigscreen.list.noCustomTemplate')" :image-size="80" />
      </div>
    </el-dialog>

    <el-dialog v-model="showTemplateName" :title="t('bigscreen.list.fromTemplateTitle')" width="420px" @closed="templateNameForm.name = ''">
      <el-form @submit.prevent="submitTemplateCreate">
        <el-form-item :label="t('bigscreen.list.nameLabel')" required>
          <el-input v-model.trim="templateNameForm.name" :placeholder="t('bigscreen.list.namePlaceholder')" @keyup.enter="submitTemplateCreate" />
        </el-form-item>
        <el-form-item v-if="activeTemplate.description" :label="t('bigscreen.list.templateDescLabel')">
          <div class="tm-active-desc">{{ activeTemplate.description }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showTemplateName = false">{{ t('bigscreen.list.cancel') }}</el-button>
        <el-button type="primary" :loading="creating" @click="submitTemplateCreate">{{ t('bigscreen.list.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toastApiError } from '@/api/error-toast'
import { Plus, Search, Monitor, Folder, Share } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { bigScreenApi } from '@/api'
import BigScreenShareDialog from '@/components/dashboard/BigScreenShareDialog.vue'
import { presetTemplates } from '@/screen-designer/core/templates/preset'
import { generateTemplateThumbnail } from '@/screen-designer/core/templates/thumbnail'

const router = useRouter()
const { t } = useI18n()
const loading = ref(false)
const items = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const search = ref('')
const showCreate = ref(false)
const creating = ref(false)
const createForm = ref({ name: '' })
const share = ref({ show: false, screenId: null, screenName: '' })
const showTemplates = ref(false)
const myTemplates = ref([])
const thumbs = ref({})
const showTemplateName = ref(false)
const activeTemplate = ref({})
const templateNameForm = ref({ name: '' })

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((x) => (x.name || '').toLowerCase().includes(q))
})

function fmt(t) {
  return t ? dayjs(t).format('YYYY-MM-DD HH:mm') : ''
}

async function fetchList() {
  loading.value = true
  try {
    const { list, total: t } = await bigScreenApi.listPaged(page.value, pageSize.value)
    items.value = list || []
    total.value = t || items.value.length
  } catch (e) {
    toastApiError(t, e, 'bigscreen.list.loadListFailed')
  } finally {
    loading.value = false
  }
}

onMounted(fetchList)
watch([page, pageSize], fetchList)

function create() {
  createForm.value.name = ''
  showCreate.value = true
}

async function submitCreate() {
  if (!createForm.value.name.trim()) {
    ElMessage.warning(t('bigscreen.list.nameRequired'))
    return
  }
  creating.value = true
  try {
    const d = await bigScreenApi.create({ name: createForm.value.name.trim(), config: '{}', components: '[]' })
    showCreate.value = false
    router.push(`/big-screen/design/${d.id}`)
  } catch (e) {
    toastApiError(t, e, 'bigscreen.list.createFailed')
  } finally {
    creating.value = false
  }
}

async function remove(row) {
  try {
    await bigScreenApi.remove(row.id)
    ElMessage.success(t('bigscreen.list.deleteSuccess'))
    fetchList()
  } catch (e) {
    toastApiError(t, e, 'bigscreen.list.deleteFailed')
  }
}

async function openShare(row) {
  share.value.screenId = row.id
  share.value.screenName = row.name
  share.value.show = true
}

function openPreview(row) {
  window.open(router.resolve(`/big-screen/preview/${row.id}`).href, '_blank')
}

async function loadMyTemplates() {
  try {
    const list = await bigScreenApi.listTemplates()
    myTemplates.value = list || []
  } catch (e) {
    toastApiError(t, e, 'bigscreen.list.templateLoadFailed')
  }
}

async function openTemplates() {
  showTemplates.value = true
  if (!Object.keys(thumbs.value).length) {
    const map = {}
    for (const t of presetTemplates) map[t.id] = generateTemplateThumbnail(t)
    thumbs.value = map
  }
  loadMyTemplates()
}

function startCreateFromTemplate(tpl) {
  activeTemplate.value = tpl
  templateNameForm.value.name = tpl.name || ''
  showTemplates.value = false
  showTemplateName.value = true
}

async function submitTemplateCreate() {
  const name = templateNameForm.value.name.trim()
  if (!name) {
    ElMessage.warning(t('bigscreen.list.nameRequired'))
    return
  }
  creating.value = true
  try {
    const tpl = activeTemplate.value
    const d = await bigScreenApi.create({
      name,
      description: tpl.description || '',
      config: tpl.config || {},
      components: tpl.components || []
    })
    showTemplateName.value = false
    router.push(`/big-screen/design/${d.id}`)
  } catch (e) {
    toastApiError(t, e, 'bigscreen.list.createFailed')
  } finally {
    creating.value = false
  }
}

async function removeTemplate(tpl) {
  try {
    await bigScreenApi.deleteTemplate(tpl.id)
    ElMessage.success(t('bigscreen.list.deleteSuccess'))
    loadMyTemplates()
  } catch (e) {
    toastApiError(t, e, 'bigscreen.list.deleteFailed')
  }
}
</script>

<style scoped>
.cell-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cell-name__icon {
  width: 26px;
  height: 26px;
  border-radius: var(--app-radius);
  background: var(--app-primary-light);
  color: var(--app-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tm-section__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin-bottom: 12px;
}

.tm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  max-height: 340px;
  overflow-y: auto;
  padding: 2px;
}

.tm-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border-light);
  border-radius: 10px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.tm-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
}

.tm-card__preview {
  position: relative;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tm-card__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.tm-card__placeholder {
  color: rgba(255, 255, 255, 0.45);
  font-size: 13px;
}

.tm-card__size {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(0, 0, 0, 0.45);
  padding: 2px 6px;
  border-radius: 4px;
}

.tm-card__body {
  padding: 10px 12px;
}

.tm-card__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tm-card__desc {
  font-size: 12px;
  color: var(--app-text-secondary);
  margin: 4px 0 10px;
  min-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tm-card__actions {
  display: flex;
  gap: 8px;
}

.tm-active-desc {
  font-size: 13px;
  color: var(--app-text-secondary);
  line-height: 1.5;
}
</style>