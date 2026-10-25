<template>
  <section class="role-page">
    <div class="role-toolbar">
      <div class="role-search-wrap">
        <el-input
          v-model="keywordDraft"
          class="role-search"
          clearable
          placeholder="搜索角色名"
          :prefix-icon="Search"
          @clear="onSearchNow"
          @input="onSearchInput"
          @keyup.enter="onSearchNow"
        />
      </div>
      <el-button class="toolbar-button" type="primary" @click="onSearchNow">
        搜索
      </el-button>
      <el-button class="toolbar-button" @click="onReset">
        重置
      </el-button>
    </div>

    <el-table
      :data="pagedRows"
      border
      class="role-table"
      header-cell-class-name="role-table-header"
    >
      <el-table-column label="角色名称" width="180">
        <template #default="{ row }">
          <el-tag class="identity-tag" size="small" :style="roleTagStyle(row.key)">
            <span class="visual-dot" :style="{ backgroundColor: roleColor(row.key) }" />
            {{ row.name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="field" label="判定字段" min-width="200" show-overflow-tooltip />
      <el-table-column label="可进入系统" min-width="260">
        <template #default="{ row }">
          <span
            v-for="item in row.systems"
            :key="item"
            class="subject-label"
          >
            <span class="visual-dot" :style="{ backgroundColor: roleColor(row.key) }" />
            <span>{{ item }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="note" label="说明" min-width="220" show-overflow-tooltip />
      <template #empty>
        <el-empty :description="emptyText" />
      </template>
    </el-table>

    <div class="role-pagination">
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
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { Search } from 'lucide-vue-next';

type RoleKey = 'admin' | 'user';

type RoleRow = {
  key: RoleKey;
  name: string;
  field: string;
  systems: string[];
  note: string;
};

const ROLE_COLORS: Record<RoleKey, string> = {
  admin: '#1d4ed8',
  user: '#15803d',
};

const rows: RoleRow[] = [
  {
    key: 'admin',
    name: '平台管理员',
    field: 'isPlatformAdmin = true',
    systems: ['猛犸总后台 /admin', '智能体 /agent'],
    note: '可跨企业管理全部用户与企业',
  },
  {
    key: 'user',
    name: '普通用户',
    field: 'isPlatformAdmin = false',
    systems: ['企业控制台 /console', '智能体 /agent'],
    note: '仅能在所属企业内操作；须为企业负责人或管理员方可进控制台',
  },
];

const keywordDraft = ref('');
const keyword = ref('');
const currentPage = ref(1);
const pageSize = ref(10);
let searchTimer = 0;

const hasActiveFilters = computed(() => Boolean(keyword.value));
const emptyText = computed(() => (hasActiveFilters.value ? '没有符合条件的角色' : '暂无角色数据'));

const filteredRows = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    row.name.toLowerCase().includes(q)
    || row.field.toLowerCase().includes(q)
    || row.note.toLowerCase().includes(q)
    || row.systems.some((item) => item.toLowerCase().includes(q)),
  );
});

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

function roleColor(key: RoleKey) {
  return ROLE_COLORS[key];
}

function roleTagStyle(key: RoleKey) {
  const color = roleColor(key);
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
  searchTimer = window.setTimeout(onSearchNow, 350);
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
  resetPage();
}

function onPageChange(page: number) {
  currentPage.value = page;
}

function onPageSizeChange(size: number) {
  pageSize.value = size;
  resetPage();
}

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer);
});
</script>

<style scoped>
.role-page {
  background: #fff;
  min-height: calc(100vh - 120px);
  padding: 18px;
}

.role-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  overflow-x: auto;
}

.role-search-wrap {
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: 10px;
  min-width: 0;
}

.role-search {
  flex: 0 0 auto;
  min-width: 0;
  width: 210px;
}

.toolbar-button {
  flex: 0 0 auto;
  margin-left: 0;
}

.toolbar-button + .toolbar-button {
  margin-left: 0;
}

.role-table {
  margin-top: 20px;
  width: 100%;
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

.role-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

:deep(.role-table-header) {
  background: #f8fafc !important;
  color: #333946;
  font-size: 13px;
  font-weight: 600;
}

:deep(.el-table__body td),
:deep(.el-table__body .cell) {
  font-size: 13px;
}

@media (max-width: 768px) {
  .role-toolbar {
    align-items: stretch;
    flex-direction: column;
    overflow-x: visible;
  }

  .role-search-wrap {
    flex-direction: column;
    width: 100%;
  }

  .role-search,
  .toolbar-button {
    width: 100%;
  }

  .role-pagination {
    justify-content: flex-start;
    overflow-x: auto;
  }
}
</style>
