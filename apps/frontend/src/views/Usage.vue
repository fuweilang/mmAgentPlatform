<template>
  <section class="usage-page">
    <el-alert
      v-if="error"
      class="page-alert"
      :title="error"
      type="error"
      show-icon
      :closable="false"
    >
      <el-button text type="primary" @click="load">重试</el-button>
    </el-alert>

    <el-empty v-if="!hasTenant" description="请先选择企业" />

    <template v-else>
      <el-alert
        v-if="quota?.exceeded"
        class="page-alert"
        type="warning"
        show-icon
        :closable="false"
        title="本月对话次数已用完"
      />

      <div v-loading="loadingQuota" class="usage-quota">
        <div class="metric-grid quota-grid">
          <MetricCard label="本月对话" :value="usedText" :hint="quotaHint" />
        </div>
        <el-form class="quota-form" label-width="96px" @submit.prevent>
          <el-form-item label="月对话上限">
            <el-input-number v-model="turnsDraft" :min="0" :max="10000000" />
            <span class="quota-help">0 表示不限制</span>
          </el-form-item>
          <el-form-item>
            <div class="usage-actions">
              <el-button type="primary" :loading="savingQuota" @click="onSaveQuota">保存上限</el-button>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <div class="usage-toolbar">
        <el-select
          v-model="actionFilter"
          class="action-filter"
          clearable
          placeholder="全部操作"
          @change="onFilter"
        >
          <el-option v-for="item in actionOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </div>
      <el-table
        :data="rows"
        v-loading="loadingAudit"
        border
        class="usage-table"
        header-cell-class-name="usage-table-header"
        empty-text="还没有审计记录"
      >
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="140">
          <template #default="{ row }">{{ actionLabel(row.action) }}</template>
        </el-table-column>
        <el-table-column label="操作者" min-width="140">
          <template #default="{ row }">{{ operatorName(row.userId) }}</template>
        </el-table-column>
        <el-table-column label="IP" width="140">
          <template #default="{ row }">{{ row.ip || '-' }}</template>
        </el-table-column>
      </el-table>
      <div class="usage-pagination">
        <el-pagination
          background
          layout="total, prev, pager, next, jumper"
          :total="total"
          :page-size="20"
          :current-page="page"
          @current-change="onPage"
        />
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { AuditActionLabel } from '@mammoth/shared';
import { auditApi, usageApi, type AuditRow, type QuotaSnapshot } from '../api/console';
import { tenantApi, type MemberRow } from '../api/tenants';
import MetricCard from '../components/MetricCard.vue';
import { useAuthStore } from '../stores/auth';
import { formatDateTime } from '../utils/format';

const auth = useAuthStore();
const hasTenant = computed(() => Boolean(auth.session?.currentTenant));
const error = ref('');
const loadingQuota = ref(false);
const loadingAudit = ref(false);
const savingQuota = ref(false);
const quota = ref<QuotaSnapshot | null>(null);
const turnsDraft = ref(1000);
const rows = ref<AuditRow[]>([]);
const members = ref<MemberRow[]>([]);
const total = ref(0);
const page = ref(1);
const actionFilter = ref('');
const actionOptions = Object.entries(AuditActionLabel).map(([value, label]) => ({ value, label }));
const usedText = computed(() => (quota.value ? String(quota.value.usedTurns) : '-'));
const quotaHint = computed(() => {
  if (!quota.value) return '本企业本月问答次数';
  if (quota.value.monthlyTurns === 0) return '未设置上限';
  return `上限 ${quota.value.monthlyTurns}，剩余 ${quota.value.remainingTurns ?? 0}`;
});

function actionLabel(action: string) {
  return AuditActionLabel[action] || action;
}

function operatorName(userId: string | null) {
  if (!userId) return '-';
  const member = members.value.find((item) => item.user.id === userId);
  return member?.user.name || userId.slice(0, 8);
}

async function loadQuota() {
  if (!auth.session?.currentTenant) {
    quota.value = null;
    return;
  }
  loadingQuota.value = true;
  error.value = '';
  try {
    quota.value = await usageApi.summary();
    turnsDraft.value = quota.value.monthlyTurns;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载用量失败';
    quota.value = null;
  } finally {
    loadingQuota.value = false;
  }
}

async function loadAudit() {
  if (!auth.session?.currentTenant) {
    rows.value = [];
    total.value = 0;
    return;
  }
  loadingAudit.value = true;
  try {
    const data = await auditApi.list(page.value, actionFilter.value);
    rows.value = data.rows;
    total.value = data.total;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载审计失败');
  } finally {
    loadingAudit.value = false;
  }
}

async function loadMembers() {
  if (!auth.session?.currentTenant) {
    members.value = [];
    return;
  }
  try {
    members.value = await tenantApi.members();
  } catch {
    members.value = [];
  }
}

async function load() {
  page.value = 1;
  await Promise.all([loadQuota(), loadAudit(), loadMembers()]);
}

async function onSaveQuota() {
  savingQuota.value = true;
  try {
    quota.value = await usageApi.patchQuota({ monthlyTurns: turnsDraft.value });
    ElMessage.success('配额已保存');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败');
  } finally {
    savingQuota.value = false;
  }
}

function onFilter() {
  page.value = 1;
  void loadAudit();
}

function onPage(next: number) {
  page.value = next;
  void loadAudit();
}

onMounted(load);
watch(() => auth.session?.currentTenant?.id, load);
</script>

<style scoped>
.usage-page {
  background: #fff;
  min-height: calc(100vh - 120px);
  padding: 18px;
}

.quota-grid {
  grid-template-columns: minmax(0, 320px);
  margin-bottom: 8px;
}

.quota-form {
  margin-top: 8px;
}

.quota-help {
  color: var(--app-text-color);
  font-size: 12px;
  margin-left: 8px;
}

.usage-actions {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}

.usage-toolbar {
  align-items: center;
  display: flex;
  gap: 10px;
  margin: 20px 0 12px;
}

.action-filter {
  width: 200px;
}

.usage-table {
  width: 100%;
}

.usage-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

:deep(.usage-table-header) {
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
