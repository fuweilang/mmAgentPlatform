<template>
  <section class="members-page">
    <div class="members-toolbar">
      <div class="members-search-wrap">
        <el-input
          v-model="keywordDraft"
          class="members-search"
          clearable
          placeholder="搜索姓名 / 手机号"
          :prefix-icon="Search"
          @clear="onSearchNow"
          @input="onSearchInput"
          @keyup.enter="onSearchNow"
        />
        <el-select
          v-model="roleFilter"
          class="role-filter"
          clearable
          placeholder="筛选角色"
        >
          <el-option label="负责人" value="OWNER" />
          <el-option label="管理员" value="ADMIN" />
          <el-option label="成员" value="MEMBER" />
        </el-select>
      </div>
      <el-button class="toolbar-button" @click="onSearchNow">搜索</el-button>
      <el-button class="toolbar-button" @click="onReset">重置</el-button>
      <div class="members-actions">
        <el-button type="primary" :disabled="!hasTenant" @click="openCreate">添加成员</el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="pagedRows"
      border
      class="members-table"
      header-cell-class-name="members-table-header"
    >
      <el-table-column label="姓名" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.user.name }}
        </template>
      </el-table-column>
      <el-table-column label="手机号" min-width="140">
        <template #default="{ row }">
          {{ row.user.phone }}
        </template>
      </el-table-column>
      <el-table-column label="角色" width="140">
        <template #default="{ row }">
          <el-tag class="identity-tag" size="small" :style="roleTagStyle(row.role)">
            <span class="visual-dot" :style="{ backgroundColor: roleColor(row.role) }" />
            {{ roleLabel(row.role) }}
          </el-tag>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty :description="emptyText">
          <el-button v-if="hasTenant && !keyword && !roleFilter" type="primary" @click="openCreate">
            添加成员
          </el-button>
        </el-empty>
      </template>
    </el-table>

    <div class="members-pagination">
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

    <el-dialog v-model="open" title="添加成员" width="420px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" maxlength="40" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input
            v-model="form.phone"
            maxlength="11"
            @input="form.phone = form.phone.replace(/[^\d]/g, '').slice(0, 11)"
          />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="负责人" value="OWNER" />
            <el-option label="管理员" value="ADMIN" />
            <el-option label="成员" value="MEMBER" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="open = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onAdd">添加</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { Search } from 'lucide-vue-next';
import { MemberRoleLabel, type MemberRole } from '@mammoth/shared';
import { tenantApi, type MemberRow } from '../api/tenants';
import { useAuthStore } from '../stores/auth';

const ROLE_COLORS: Record<MemberRole, string> = {
  OWNER: '#1d4ed8',
  ADMIN: '#c2410c',
  MEMBER: '#15803d',
};

const auth = useAuthStore();
const hasTenant = computed(() => Boolean(auth.session?.currentTenant));
const rows = ref<MemberRow[]>([]);
const loading = ref(false);
const open = ref(false);
const saving = ref(false);
const keywordDraft = ref('');
const keyword = ref('');
const roleFilter = ref('');
const currentPage = ref(1);
const pageSize = ref(10);
const formRef = ref<FormInstance>();
let searchTimer = 0;
const form = reactive({
  name: '',
  phone: '',
  password: '',
  role: 'MEMBER' as MemberRole,
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [{ required: true, min: 11, message: '请输入 11 位手机号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
};

const filteredRows = computed(() => {
  const q = keyword.value.toLowerCase();
  return rows.value.filter((row) => {
    if (roleFilter.value && row.role !== roleFilter.value) return false;
    if (!q) return true;
    return row.user.name.toLowerCase().includes(q) || (row.user.phone || '').includes(q);
  });
});

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

const emptyText = computed(() => {
  if (!hasTenant.value) return '请先选择企业';
  if (keyword.value || roleFilter.value) return '没有符合条件的成员';
  return '还没有成员';
});

function roleLabel(role: MemberRole) {
  return MemberRoleLabel[role];
}

function roleColor(role: MemberRole) {
  return ROLE_COLORS[role];
}

function roleTagStyle(role: MemberRole) {
  const color = roleColor(role);
  return {
    backgroundColor: `${color}14`,
    borderColor: color,
    color,
  };
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
  roleFilter.value = '';
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
  form.name = '';
  form.phone = '';
  form.password = '';
  form.role = 'MEMBER';
  formRef.value?.clearValidate();
}

function openCreate() {
  resetForm();
  open.value = true;
}

async function load() {
  if (!auth.session?.currentTenant) {
    rows.value = [];
    return;
  }
  loading.value = true;
  try {
    rows.value = await tenantApi.members();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

async function onAdd() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    await tenantApi.addMember({
      name: form.name.trim(),
      phone: form.phone,
      password: form.password,
      role: form.role,
    });
    ElMessage.success('已添加');
    open.value = false;
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '失败');
  } finally {
    saving.value = false;
  }
}

watch(roleFilter, resetPage);
onMounted(load);
watch(() => auth.session?.currentTenant?.id, load);
onBeforeUnmount(() => {
  window.clearTimeout(searchTimer);
});
</script>

<style scoped>
.members-page {
  background: #fff;
  min-height: calc(100vh - 120px);
  padding: 18px;
}

.members-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  overflow-x: auto;
}

.members-search-wrap {
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: 10px;
  min-width: 0;
}

.members-search {
  width: 220px;
}

.role-filter {
  width: 140px;
}

.toolbar-button {
  flex: 0 0 auto;
  margin-left: 0;
}

.toolbar-button + .toolbar-button {
  margin-left: 0;
}

.members-actions {
  display: flex;
  flex: 0 0 auto;
  margin-left: auto;
}

.members-table {
  margin-top: 20px;
  width: 100%;
}

.identity-tag {
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

.members-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

:deep(.members-table-header) {
  background: #f8fafc !important;
  color: #333946;
  font-size: 13px;
  font-weight: 600;
}

:deep(.el-table__body td),
:deep(.el-table__body .cell) {
  font-size: 13px;
}
</style>
