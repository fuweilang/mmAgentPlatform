<template>
  <section class="agents-page">
    <div class="agents-toolbar">
      <div class="agents-search-wrap">
        <el-input
          v-model="keywordDraft"
          class="agents-search"
          clearable
          placeholder="搜索名称"
          :prefix-icon="Search"
          @clear="onSearchNow"
          @input="onSearchInput"
          @keyup.enter="onSearchNow"
        />
        <el-select
          v-model="statusFilter"
          class="status-filter"
          clearable
          placeholder="全部状态"
          @change="onSearchNow"
        >
          <el-option label="已启用" value="on" />
          <el-option label="已停用" value="off" />
        </el-select>
      </div>
      <el-button class="toolbar-button" @click="onSearchNow">搜索</el-button>
      <el-button class="toolbar-button" @click="onReset">重置</el-button>
      <div class="agents-actions">
        <el-button type="primary" :disabled="!hasTenant" @click="openCreate">新建智能体</el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="pagedRows"
      border
      class="agents-table"
      header-cell-class-name="agents-table-header"
    >
      <el-table-column label="名称" prop="name" min-width="140" show-overflow-tooltip />
      <el-table-column label="人设" min-width="280">
        <template #default="{ row }">
          <span class="persona">{{ row.persona }}</span>
        </template>
      </el-table-column>
      <el-table-column label="可见范围" width="120">
        <template #default="{ row }">
          <el-tag size="small">{{ visibilityLabel(row.visibility) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="启用" width="90">
        <template #default="{ row }">
          <el-switch
            :model-value="row.enabled"
            :disabled="toggling === row.id"
            @change="onToggle(row, $event)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90" align="center">
        <template #default="{ row }">
          <el-button text type="primary" @click="openEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty :description="emptyText">
          <el-button v-if="hasTenant && !keyword && !statusFilter" type="primary" @click="openCreate">
            创建第一个智能体
          </el-button>
        </el-empty>
      </template>
    </el-table>

    <div class="agents-pagination">
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
      v-model="open"
      :title="editingId ? '编辑智能体' : '新建智能体'"
      width="520px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" maxlength="40" />
        </el-form-item>
        <el-form-item label="人设" prop="persona">
          <el-input v-model="form.persona" type="textarea" :rows="6" maxlength="8000" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="可见范围" prop="visibility">
          <el-select v-model="form.visibility" style="width: 100%">
            <el-option label="全员" value="ALL" />
            <el-option label="指定成员" value="SELECTED" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.visibility === 'SELECTED'" label="成员" prop="userIds">
          <el-select v-model="form.userIds" multiple filterable style="width: 100%" placeholder="选择可用成员">
            <el-option v-for="m in members" :key="m.user.id" :label="memberLabel(m)" :value="m.user.id" />
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
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { Search } from 'lucide-vue-next';
import { AccessScopeLabel, type AccessScope } from '@mammoth/shared';
import { agentApi, type AgentRow } from '../api/console';
import { tenantApi, type MemberRow } from '../api/tenants';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const hasTenant = computed(() => Boolean(auth.session?.currentTenant));
const rows = ref<AgentRow[]>([]);
const members = ref<MemberRow[]>([]);
const loading = ref(false);
const open = ref(false);
const saving = ref(false);
const toggling = ref('');
const editingId = ref('');
const keywordDraft = ref('');
const keyword = ref('');
const statusFilter = ref('');
const currentPage = ref(1);
const pageSize = ref(10);
const formRef = ref<FormInstance>();
let searchTimer = 0;
const form = reactive({
  name: '',
  persona: '',
  enabled: true,
  visibility: 'ALL' as AccessScope,
  userIds: [] as string[],
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  userIds: [
    {
      validator: (_rule, value: string[], callback) => {
        if (form.visibility === 'SELECTED' && value.length === 0) {
          callback(new Error('指定成员时至少选择一人'));
          return;
        }
        callback();
      },
      trigger: 'change',
    },
  ],
};

const filteredRows = computed(() => {
  const q = keyword.value.toLowerCase();
  return rows.value.filter((row) => {
    if (q && !row.name.toLowerCase().includes(q)) return false;
    if (statusFilter.value === 'on' && !row.enabled) return false;
    if (statusFilter.value === 'off' && row.enabled) return false;
    return true;
  });
});

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

const emptyText = computed(() => {
  if (!hasTenant.value) return '请先选择企业';
  if (keyword.value || statusFilter.value) return '没有符合条件的智能体';
  return '还没有智能体';
});

function memberLabel(row: MemberRow) {
  return `${row.user.name}（${row.user.phone}）`;
}

function visibilityLabel(visibility: AccessScope) {
  return AccessScopeLabel[visibility];
}

function resetPage() {
  currentPage.value = 1;
}

function onSearchInput() {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(onSearchNow, 300);
}

function onSearchNow() {
  window.clearTimeout(searchTimer);
  keyword.value = keywordDraft.value.trim();
  resetPage();
}

function onReset() {
  window.clearTimeout(searchTimer);
  keywordDraft.value = '';
  keyword.value = '';
  statusFilter.value = '';
  resetPage();
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
  form.persona = '';
  form.enabled = true;
  form.visibility = 'ALL';
  form.userIds = [];
  formRef.value?.clearValidate();
}

function openCreate() {
  resetForm();
  open.value = true;
}

function openEdit(row: AgentRow) {
  editingId.value = row.id;
  form.name = row.name;
  form.persona = row.persona;
  form.enabled = row.enabled;
  form.visibility = row.visibility;
  form.userIds = [...row.userIds];
  open.value = true;
}

async function load() {
  if (!auth.session?.currentTenant) {
    rows.value = [];
    members.value = [];
    return;
  }
  loading.value = true;
  try {
    const [agentRows, memberRows] = await Promise.all([agentApi.list(), tenantApi.members()]);
    rows.value = agentRows;
    members.value = memberRows;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

async function onToggle(row: AgentRow, enabled: string | number | boolean) {
  toggling.value = row.id;
  try {
    const next = await agentApi.patch(row.id, { enabled: Boolean(enabled) });
    rows.value = rows.value.map((item) => (item.id === row.id ? next : item));
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '更新失败');
  } finally {
    toggling.value = '';
  }
}

async function onSave() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      persona: form.persona.trim(),
      enabled: form.enabled,
      visibility: form.visibility,
      userIds: form.visibility === 'SELECTED' ? form.userIds : [],
    };
    if (editingId.value) {
      await agentApi.patch(editingId.value, payload);
      ElMessage.success('已保存');
    } else {
      await agentApi.create(payload);
      ElMessage.success('已创建');
    }
    open.value = false;
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '失败');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
watch(() => auth.session?.currentTenant?.id, load);
onBeforeUnmount(() => {
  window.clearTimeout(searchTimer);
});
</script>

<style scoped>
.agents-page {
  background: #fff;
  min-height: calc(100vh - 120px);
  padding: 18px;
}

.agents-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  overflow-x: auto;
}

.agents-search-wrap {
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: 10px;
  min-width: 0;
}

.agents-search {
  width: 220px;
}

.status-filter {
  width: 140px;
}

.toolbar-button {
  flex: 0 0 auto;
  margin-left: 0;
}

.toolbar-button + .toolbar-button {
  margin-left: 0;
}

.agents-actions {
  display: flex;
  flex: 0 0 auto;
  margin-left: auto;
}

.agents-table {
  margin-top: 20px;
  width: 100%;
}

.persona {
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--app-text-color);
  display: -webkit-box;
  font-size: 13px;
  line-height: 1.4;
  overflow: hidden;
}

.agents-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

:deep(.agents-table-header) {
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
</style>
