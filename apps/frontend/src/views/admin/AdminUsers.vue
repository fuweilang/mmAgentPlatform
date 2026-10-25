<template>
  <section class="user-page">
    <div class="user-toolbar">
      <div class="user-search-wrap">
        <el-input
          v-model="nameDraft"
          class="user-search-keyword"
          clearable
          placeholder="搜索姓名"
          :prefix-icon="Search"
          @clear="onSearchNow"
          @input="onSearchInput"
          @keyup.enter="onSearchNow"
        />
        <el-input
          v-model="phoneDraft"
          class="user-search"
          clearable
          placeholder="搜索手机号"
          :prefix-icon="Search"
          @clear="onSearchNow"
          @input="onPhoneInput"
          @keyup.enter="onSearchNow"
        />
        <el-select
          v-model="roleFilter"
          class="role-filter"
          clearable
          placeholder="筛选身份"
          @change="onSearchNow"
          @clear="onSearchNow"
        >
          <el-option label="平台管理员" value="admin" />
          <el-option label="普通用户" value="user" />
        </el-select>
        <el-select
          v-model="statusFilter"
          class="status-filter"
          clearable
          placeholder="账号状态"
          @change="onSearchNow"
          @clear="onSearchNow"
        >
          <el-option label="激活" value="active" />
          <el-option label="停用" value="inactive" />
        </el-select>
        <el-select
          v-model="enterpriseFilter"
          class="enterprise-filter"
          clearable
          filterable
          placeholder="筛选所属企业"
          @change="onEnterpriseChange"
          @clear="onEnterpriseChange"
        >
          <el-option
            v-for="item in enterprises"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
      </div>
      <el-button class="toolbar-button" :loading="loading" type="primary" @click="onSearchNow">
        搜索
      </el-button>
      <el-button class="toolbar-button" @click="onReset">
        重置
      </el-button>
      <div class="user-actions">
        <el-button type="primary" @click="openCreate">新建</el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="pagedRows"
      border
      class="user-table"
      header-cell-class-name="user-table-header"
    >
      <el-table-column label="用户名/姓名" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.name }}
        </template>
      </el-table-column>
      <el-table-column prop="phone" label="手机号" width="120" />
      <el-table-column label="身份" min-width="148">
        <template #default="{ row }">
          <el-tag class="identity-tag" size="small" :style="identityTagStyle(row.isPlatformAdmin)">
            <span class="visual-dot" :style="{ backgroundColor: identityColor(row.isPlatformAdmin) }" />
            {{ roleLabel(row.isPlatformAdmin) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="所属企业" min-width="220">
        <template #default="{ row }">
          <span v-if="row.tenants.length === 0" class="muted">-</span>
          <span
            v-for="tenant in row.tenants"
            :key="tenant.id"
            class="subject-label"
          >
            <span class="visual-dot" :style="{ backgroundColor: tenantColor(tenant.id) }" />
            <span>{{ tenant.name }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="账号状态" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="210" fixed="right" align="center">
        <template #default="{ row }">
          <div class="operation-buttons">
            <el-button text type="primary" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button
              text
              type="warning"
              :disabled="row.status !== 'active' || row.id === currentUserId"
              :loading="deactivatingId === row.id"
              @click="onDeactivate(row)"
            >
              停用
            </el-button>
            <el-button
              v-if="canDeleteUser(row)"
              text
              type="danger"
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
            新建用户
          </el-button>
        </el-empty>
      </template>
    </el-table>

    <div class="user-pagination">
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
      :title="editingId ? '编辑用户' : '新建用户'"
      width="480px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" maxlength="40" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input
            v-model="form.phone"
            maxlength="11"
            :disabled="Boolean(editingId)"
            @input="form.phone = form.phone.replace(/[^\d]/g, '').slice(0, 11)"
          />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            :placeholder="editingId ? '留空则不修改' : '请输入密码'"
          />
        </el-form-item>
        <el-form-item label="角色" prop="isPlatformAdmin">
          <el-select v-model="form.isPlatformAdmin" style="width: 100%">
            <el-option label="普通用户" :value="false" />
            <el-option label="平台管理员" :value="true" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!editingId && !form.isPlatformAdmin" label="所属企业" prop="tenantId">
          <el-select v-model="form.tenantId" filterable placeholder="选择一家企业" style="width: 100%">
            <el-option v-for="t in enterprises" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
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
import { computed, h, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { Search } from 'lucide-vue-next';
import { adminEnterpriseApi, adminUserApi, type AdminEnterpriseRow, type AdminUserRow } from '../../api/admin';
import { useAuthStore } from '../../stores/auth';

const TENANT_COLORS = ['#7c3aed', '#0891b2', '#c2410c', '#15803d', '#be123c', '#4f46e5', '#a16207', '#0f766e'];

const auth = useAuthStore();
const rows = ref<AdminUserRow[]>([]);
const enterprises = ref<AdminEnterpriseRow[]>([]);
const loading = ref(false);
const open = ref(false);
const saving = ref(false);
const editingId = ref('');
const deactivatingId = ref('');
const deletingId = ref('');
const nameDraft = ref('');
const phoneDraft = ref('');
const roleFilter = ref<'' | 'admin' | 'user'>('');
const statusFilter = ref('');
const enterpriseFilter = ref('');
const currentPage = ref(1);
const pageSize = ref(10);
const formRef = ref<FormInstance>();
let searchTimer = 0;
let requestSequence = 0;

const form = reactive({
  name: '',
  phone: '',
  password: '',
  isPlatformAdmin: false,
  tenantId: '',
  status: 'active',
});

const currentUserId = computed(() => auth.session?.user.id || '');

const rules: FormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [{ required: true, pattern: /^1\d{10}$/, message: '请输入 11 位手机号', trigger: 'blur' }],
  password: [
    {
      validator: (_rule, value: string, callback) => {
        if (!editingId.value && !value) {
          callback(new Error('请输入密码'));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
  tenantId: [
    {
      validator: (_rule, value: string, callback) => {
        if (!editingId.value && !form.isPlatformAdmin && !value) {
          callback(new Error('普通用户必须绑定一家企业'));
          return;
        }
        callback();
      },
      trigger: 'change',
    },
  ],
};

const hasActiveFilters = computed(() =>
  Boolean(nameDraft.value || phoneDraft.value || roleFilter.value || statusFilter.value || enterpriseFilter.value),
);

const emptyText = computed(() => (hasActiveFilters.value ? '没有符合条件的用户' : '还没有用户'));

const filteredRows = computed(() => {
  const name = nameDraft.value.trim();
  const phone = phoneDraft.value.trim();
  const enterpriseId = enterpriseFilter.value;
  return rows.value.filter((row) => {
    if (name && !row.name.includes(name)) return false;
    if (phone && !row.phone.includes(phone)) return false;
    if (enterpriseId && !row.tenants.some((tenant) => tenant.id === enterpriseId)) return false;
    return true;
  });
});

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

function roleLabel(isPlatformAdmin: boolean) {
  return isPlatformAdmin ? '平台管理员' : '普通用户';
}

function statusLabel(status: string) {
  return status === 'active' ? '激活' : '停用';
}

function canDeleteUser(row: AdminUserRow) {
  return !row.isPlatformAdmin;
}

function identityColor(isPlatformAdmin: boolean) {
  return isPlatformAdmin ? '#1d4ed8' : '#15803d';
}

function identityTagStyle(isPlatformAdmin: boolean) {
  const color = identityColor(isPlatformAdmin);
  return {
    backgroundColor: `${color}14`,
    borderColor: color,
    color,
  };
}

function tenantColor(id: string) {
  let hash = 0;
  for (const character of id) hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
  return TENANT_COLORS[hash % TENANT_COLORS.length];
}

function resetPage() {
  currentPage.value = 1;
}

function onSearchInput() {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(onSearchNow, 350);
}

function onPhoneInput(value: string) {
  phoneDraft.value = value.replace(/\D/g, '').slice(0, 11);
  onSearchInput();
}

function onSearchNow() {
  window.clearTimeout(searchTimer);
  resetPage();
  void load();
}

function onEnterpriseChange() {
  resetPage();
}

function onReset() {
  window.clearTimeout(searchTimer);
  nameDraft.value = '';
  phoneDraft.value = '';
  roleFilter.value = '';
  statusFilter.value = '';
  enterpriseFilter.value = '';
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
  form.phone = '';
  form.password = '';
  form.isPlatformAdmin = false;
  form.tenantId = '';
  form.status = 'active';
  formRef.value?.clearValidate();
}

function openCreate() {
  resetForm();
  open.value = true;
}

function openEdit(row: AdminUserRow) {
  editingId.value = row.id;
  form.name = row.name;
  form.phone = row.phone;
  form.password = '';
  form.isPlatformAdmin = row.isPlatformAdmin;
  form.tenantId = row.tenants[0]?.id ?? '';
  form.status = row.status;
  open.value = true;
}

async function load() {
  const sequence = ++requestSequence;
  loading.value = true;
  try {
    const result = await adminUserApi.list({
      keyword: nameDraft.value.trim() || phoneDraft.value.trim(),
      role: roleFilter.value,
      status: statusFilter.value,
    });
    if (sequence !== requestSequence) return;
    rows.value = result;
  } catch (e) {
    if (sequence !== requestSequence) return;
    ElMessage.error(e instanceof Error ? e.message : '加载失败');
  } finally {
    if (sequence === requestSequence) loading.value = false;
  }
}

async function loadEnterprises() {
  try {
    enterprises.value = await adminEnterpriseApi.list();
  } catch {
    enterprises.value = [];
  }
}

async function onSave() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    if (editingId.value) {
      await adminUserApi.update(editingId.value, {
        name: form.name.trim(),
        isPlatformAdmin: form.isPlatformAdmin,
        status: form.status,
        ...(form.password ? { password: form.password } : {}),
      });
      ElMessage.success('已保存');
    } else {
      await adminUserApi.create({
        name: form.name.trim(),
        phone: form.phone,
        password: form.password,
        isPlatformAdmin: form.isPlatformAdmin,
        ...(!form.isPlatformAdmin && form.tenantId ? { tenantId: form.tenantId } : {}),
      });
      ElMessage.success('已创建');
    }
    open.value = false;
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onDeactivate(row: AdminUserRow) {
  try {
    await ElMessageBox.confirm(`停用后「${row.name}」将无法登录。确定停用？`, '停用用户', {
      type: 'warning',
      confirmButtonText: '停用',
      confirmButtonClass: 'el-button--danger',
    });
  } catch {
    return;
  }
  deactivatingId.value = row.id;
  try {
    await adminUserApi.deactivate(row.id);
    ElMessage.success('已停用');
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '停用失败');
  } finally {
    deactivatingId.value = '';
  }
}

async function onDelete(row: AdminUserRow) {
  if (!canDeleteUser(row)) return;
  try {
    await ElMessageBox.confirm(
      h('span', null, [
        '删除“',
        h('span', { style: { color: '#2563eb', fontWeight: 600 } }, row.name),
        '”后账号不可恢复，确认删除？',
      ]),
      '删除用户',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        confirmButtonClass: 'el-button--danger',
      },
    );
  } catch {
    return;
  }
  deletingId.value = row.id;
  try {
    await adminUserApi.remove(row.id);
    ElMessage.success('用户已删除');
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败');
  } finally {
    deletingId.value = '';
  }
}

onMounted(() => {
  void loadEnterprises();
  void load();
});

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer);
  requestSequence += 1;
});
</script>

<style scoped>
.user-page {
  background: #fff;
  min-height: calc(100vh - 120px);
  padding: 18px;
}

.user-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  overflow-x: auto;
}

.user-search-wrap {
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: 10px;
  min-width: 0;
}

.user-search,
.user-search-keyword,
.role-filter,
.status-filter,
.enterprise-filter {
  flex: 0 0 auto;
  min-width: 0;
  width: 160px;
}

.user-search-keyword {
  width: 210px;
}

.role-filter,
.status-filter {
  width: 135px;
}

.enterprise-filter {
  width: 190px;
}

.toolbar-button {
  flex: 0 0 auto;
  margin-left: 0;
}

.toolbar-button + .toolbar-button {
  margin-left: 0;
}

.user-actions {
  display: flex;
  flex: 0 0 auto;
  margin-left: auto;
}

.user-table {
  margin-top: 20px;
  width: 100%;
}

.muted {
  color: #98a2b3;
}

.subject-label,
.identity-tag {
  align-items: center;
  display: inline-flex;
  gap: 7px;
}

.subject-label + .subject-label {
  margin-left: 10px;
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

.user-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

:deep(.user-table-header) {
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
  .user-toolbar {
    align-items: stretch;
    flex-direction: column;
    overflow-x: visible;
  }

  .user-search-wrap {
    flex-direction: column;
    width: 100%;
  }

  .user-search,
  .user-search-keyword,
  .role-filter,
  .status-filter,
  .enterprise-filter,
  .toolbar-button {
    width: 100%;
  }

  .user-actions {
    margin-left: 0;
    width: 100%;
  }

  .user-actions .el-button {
    width: 100%;
  }

  .user-pagination {
    justify-content: flex-start;
    overflow-x: auto;
  }
}
</style>
