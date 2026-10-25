<template>
  <section class="enterprise-page">
    <div class="enterprise-toolbar">
      <div class="enterprise-search-wrap">
        <el-input
          v-model="nameDraft"
          class="enterprise-search-keyword"
          clearable
          placeholder="搜索企业名称"
          :prefix-icon="Search"
          @clear="onSearchNow"
          @input="onSearchInput"
          @keyup.enter="onSearchNow"
        />
        <el-input
          v-model="slugDraft"
          class="enterprise-search"
          clearable
          placeholder="搜索品牌"
          :prefix-icon="Search"
          @clear="onSearchNow"
          @input="onSearchInput"
          @keyup.enter="onSearchNow"
        />
        <el-select
          v-model="statusFilter"
          class="status-filter"
          clearable
          placeholder="账号状态"
          @change="onFilterChange"
          @clear="onFilterChange"
        >
          <el-option label="激活" value="active" />
          <el-option label="停用" value="inactive" />
        </el-select>
      </div>
      <el-button class="toolbar-button" :loading="loading" type="primary" @click="onSearchNow">
        搜索
      </el-button>
      <el-button class="toolbar-button" @click="onReset">
        重置
      </el-button>
      <div class="enterprise-actions">
        <el-button type="primary" @click="openCreate">新建</el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="pagedRows"
      border
      class="enterprise-table"
      header-cell-class-name="enterprise-table-header"
    >
      <el-table-column label="名称" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="subject-label">
            <span class="visual-dot" :style="{ backgroundColor: enterpriseColor(row.id) }" />
            <span>{{ row.name }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="slug" label="品牌" min-width="140" show-overflow-tooltip />
      <el-table-column label="账号状态" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="成员数" width="90">
        <template #default="{ row }">
          {{ row.memberCount }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right" align="center">
        <template #default="{ row }">
          <div class="operation-buttons">
            <el-button text type="primary" @click="openWorkbench(row)">
              进入工作台
            </el-button>
            <el-button text type="primary" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button
              text
              type="danger"
              :disabled="row.type === 'PLATFORM'"
              :loading="deletingId === row.id"
              @click="onDelete(row)"
            >
              删除
            </el-button>
          </div>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty :description="emptyText">
          <el-button v-if="!hasActiveFilters" type="primary" @click="openCreate">
            新建企业
          </el-button>
        </el-empty>
      </template>
    </el-table>

    <div class="enterprise-pagination">
      <el-pagination
        :current-page="currentPage"
        :page-size="pageSize"
        background
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[10, 20, 50]"
        :total="filteredRows.length"
        @current-change="onPageChange"
        @size-change="onPageSizeChange"
      />
    </div>

    <el-dialog
      v-model="workbenchVisible"
      title="进入业务工作台"
      width="480px"
      :close-on-click-modal="false"
    >
      <p class="workbench-tip">
        将以当前管理员身份代运营「<span class="workbench-enterprise-name">{{ workbenchEnterprise?.name }}</span>」，进入该企业的企业控制台，不会切换登录身份。
      </p>
      <template #footer>
        <el-button :disabled="entering" @click="workbenchVisible = false">取消</el-button>
        <el-button type="primary" :loading="entering" @click="confirmWorkbench">进入工作台</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="open"
      :title="editingId ? '编辑企业' : '新建企业'"
      width="480px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" maxlength="80" />
        </el-form-item>
        <el-form-item label="品牌" prop="slug">
          <el-input v-model="form.slug" maxlength="80" placeholder="请输入品牌" />
        </el-form-item>
        <el-form-item v-if="editingId" label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="激活" value="active" />
            <el-option label="停用" value="inactive" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="open = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { useRouter } from 'vue-router';
import { Search } from 'lucide-vue-next';
import { adminEnterpriseApi, type AdminEnterpriseRow } from '../../api/admin';
import { useAuthStore } from '../../stores/auth';

const ENTERPRISE_COLORS = ['#7c3aed', '#0891b2', '#c2410c', '#15803d', '#be123c', '#4f46e5', '#a16207', '#0f766e'];

const auth = useAuthStore();
const router = useRouter();
const rows = ref<AdminEnterpriseRow[]>([]);
const loading = ref(false);
const open = ref(false);
const saving = ref(false);
const editingId = ref('');
const deletingId = ref('');
const entering = ref(false);
const workbenchVisible = ref(false);
const workbenchEnterprise = ref<AdminEnterpriseRow | null>(null);
const nameDraft = ref('');
const slugDraft = ref('');
const statusFilter = ref('');
const currentPage = ref(1);
const pageSize = ref(10);
const formRef = ref<FormInstance>();
let searchTimer = 0;
let requestSequence = 0;

const form = reactive({
  name: '',
  slug: '',
  status: 'active',
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  slug: [{ required: true, message: '请输入品牌', trigger: 'blur' }],
};

const hasActiveFilters = computed(() =>
  Boolean(nameDraft.value || slugDraft.value || statusFilter.value),
);

const emptyText = computed(() => (hasActiveFilters.value ? '没有符合条件的企业' : '还没有企业'));

const filteredRows = computed(() => {
  const name = nameDraft.value.trim().toLowerCase();
  const slug = slugDraft.value.trim().toLowerCase();
  return rows.value.filter((row) => {
    if (name && !row.name.toLowerCase().includes(name)) return false;
    if (slug && !row.slug.toLowerCase().includes(slug)) return false;
    if (statusFilter.value && row.status !== statusFilter.value) return false;
    return true;
  });
});

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

function statusLabel(status: string) {
  return status === 'active' ? '激活' : '停用';
}

function enterpriseColor(id: string) {
  let hash = 0;
  for (const character of id) hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
  return ENTERPRISE_COLORS[hash % ENTERPRISE_COLORS.length];
}

function resetPage() {
  currentPage.value = 1;
}

function onSearchInput() {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(onSearchNow, 350);
}

function onSearchNow() {
  window.clearTimeout(searchTimer);
  resetPage();
  void load();
}

function onFilterChange() {
  resetPage();
}

function onReset() {
  window.clearTimeout(searchTimer);
  nameDraft.value = '';
  slugDraft.value = '';
  statusFilter.value = '';
  resetPage();
  void load();
}

function onPageChange(page: number) {
  currentPage.value = page;
}

function onPageSizeChange(size: number) {
  pageSize.value = size;
  resetPage();
}

function resetForm() {
  editingId.value = '';
  form.name = '';
  form.slug = '';
  form.status = 'active';
  formRef.value?.clearValidate();
}

function openCreate() {
  resetForm();
  open.value = true;
}

function openEdit(row: AdminEnterpriseRow) {
  editingId.value = row.id;
  form.name = row.name;
  form.slug = row.slug;
  form.status = row.status;
  open.value = true;
}

async function load() {
  const sequence = ++requestSequence;
  loading.value = true;
  try {
    const result = await adminEnterpriseApi.list();
    if (sequence !== requestSequence) return;
    rows.value = result;
  } catch (e) {
    if (sequence !== requestSequence) return;
    ElMessage.error(e instanceof Error ? e.message : '加载失败');
  } finally {
    if (sequence === requestSequence) loading.value = false;
  }
}

async function onSave() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    if (editingId.value) {
      await adminEnterpriseApi.update(editingId.value, {
        name: form.name.trim(),
        slug: form.slug.trim(),
        status: form.status,
      });
      ElMessage.success('已保存');
    } else {
      await adminEnterpriseApi.create({
        name: form.name.trim(),
        slug: form.slug.trim(),
      });
      ElMessage.success('已创建');
    }
    open.value = false;
    await load();
    await auth.load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

async function openWorkbench(row: AdminEnterpriseRow) {
  if (row.status !== 'active') {
    ElMessage.warning('停用企业不能进入业务工作台');
    return;
  }
  workbenchEnterprise.value = row;
  workbenchVisible.value = true;
}

async function confirmWorkbench() {
  const row = workbenchEnterprise.value;
  if (!row) return;
  entering.value = true;
  try {
    await auth.switchTenant(row.id);
    workbenchVisible.value = false;
    ElMessage.success(`已进入「${row.name}」业务工作台`);
    await router.push('/console/');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '进入工作台失败');
  } finally {
    entering.value = false;
  }
}

async function onDelete(row: AdminEnterpriseRow) {
  try {
    await ElMessageBox.confirm(`确定删除企业「${row.name}」？该操作不可恢复。`, '删除企业', {
      type: 'warning',
      confirmButtonText: '删除',
      confirmButtonClass: 'el-button--danger',
    });
  } catch {
    return;
  }
  deletingId.value = row.id;
  try {
    await adminEnterpriseApi.remove(row.id);
    ElMessage.success('已删除');
    await load();
    await auth.load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败');
  } finally {
    deletingId.value = '';
  }
}

onMounted(load);

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer);
  requestSequence += 1;
});
</script>

<style scoped>
.enterprise-page {
  background: #fff;
  min-height: calc(100vh - 120px);
  padding: 18px;
}

.enterprise-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  overflow-x: auto;
}

.enterprise-search-wrap {
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: 10px;
  min-width: 0;
}

.enterprise-search,
.enterprise-search-keyword,
.status-filter {
  flex: 0 0 auto;
  min-width: 0;
  width: 160px;
}

.enterprise-search-keyword {
  width: 210px;
}

.status-filter {
  width: 135px;
}

.toolbar-button {
  flex: 0 0 auto;
  margin-left: 0;
}

.toolbar-button + .toolbar-button {
  margin-left: 0;
}

.enterprise-actions {
  display: flex;
  flex: 0 0 auto;
  margin-left: auto;
}

.enterprise-table {
  margin-top: 20px;
  width: 100%;
}

.subject-label {
  align-items: center;
  display: inline-flex;
  gap: 7px;
}

.visual-dot {
  border-radius: 50%;
  flex: 0 0 7px;
  height: 7px;
  width: 7px;
}

.operation-buttons {
  align-items: center;
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  justify-content: center;
  white-space: nowrap;
}

.operation-buttons :deep(.el-button + .el-button) {
  margin-left: 0;
}

.operation-buttons :deep(.el-button) {
  margin: 0;
  min-height: 28px;
  padding: 4px 6px;
}

.enterprise-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.workbench-tip {
  color: var(--app-text-color);
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
}

.workbench-enterprise-name {
  color: var(--app-primary-color);
  font-weight: 600;
}

:deep(.enterprise-table-header) {
  background: #f8fafc !important;
  color: #333946;
  font-size: 13px;
  font-weight: 600;
}

:deep(.el-table__body td),
:deep(.el-table__body .cell),
:deep(.el-table__body .el-button.is-text) {
  font-size: 13px;
}

@media (max-width: 768px) {
  .enterprise-toolbar {
    align-items: stretch;
    flex-direction: column;
    overflow-x: visible;
  }

  .enterprise-search-wrap {
    flex-direction: column;
    width: 100%;
  }

  .enterprise-search,
  .enterprise-search-keyword,
  .status-filter,
  .toolbar-button {
    width: 100%;
  }

  .enterprise-actions {
    margin-left: 0;
    width: 100%;
  }

  .enterprise-actions .el-button {
    width: 100%;
  }

  .enterprise-pagination {
    justify-content: flex-start;
    overflow-x: auto;
  }
}
</style>
