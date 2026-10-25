<template>
  <section class="workbench-home">
    <div v-if="hasTenant" class="home-head">
      <div>
        <h1>工作台</h1>
        <p>{{ welcomeText }}</p>
      </div>
      <div class="home-actions">
        <el-button @click="go('/console/members')">邀请成员</el-button>
        <el-button type="primary" @click="goChat">开始对话</el-button>
      </div>
    </div>

    <el-alert
      v-if="hasTenant && error"
      class="page-alert"
      :title="error"
      type="error"
      show-icon
      :closable="false"
    >
      <el-button text type="primary" @click="load">重试</el-button>
    </el-alert>

    <TenantPicker v-if="!loading && !hasTenant" />

    <template v-else>
      <el-alert
        v-if="pendingCount > 0"
        class="page-alert"
        type="warning"
        show-icon
        :closable="false"
        :title="`有 ${pendingCount} 份材料待生效`"
      >
        <el-button text type="primary" @click="go('/console/knowledge')">去生效</el-button>
      </el-alert>
      <el-alert
        v-if="quotaTight"
        class="page-alert"
        type="warning"
        show-icon
        :closable="false"
        title="本月对话次数接近上限"
      >
        <el-button text type="primary" @click="go('/console/usage')">看用量</el-button>
      </el-alert>

      <div v-loading="loading" class="metric-grid">
        <MetricCard
          v-for="card in cards"
          :key="card.label"
          :label="card.label"
          :value="card.value"
          :hint="card.hint"
          clickable
          @click="go(card.path)"
        />
      </div>

      <div class="shortcut-grid">
        <button
          v-for="item in shortcuts"
          :key="item.path"
          class="shortcut-card"
          type="button"
          @click="go(item.path)"
        >
          <component :is="item.icon" class="shortcut-icon" />
          <span class="shortcut-copy">
            <strong>{{ item.title }}</strong>
            <small>{{ item.desc }}</small>
          </span>
        </button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { BarChart3, BookOpen, Bot, Users } from 'lucide-vue-next';
import { workbenchApi, type WorkbenchSummary } from '../api/console';
import MetricCard from '../components/MetricCard.vue';
import TenantPicker from '../components/TenantPicker.vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const loading = ref(false);
const error = ref('');
const summary = ref<WorkbenchSummary | null>(null);
const hasTenant = computed(() => Boolean(auth.session?.currentTenant));
const welcomeText = computed(
  () => summary.value?.welcomeMessage || '处理待办后开始对话。',
);
const pendingCount = computed(() => summary.value?.kbPendingCount ?? 0);
const quotaTight = computed(() => {
  const data = summary.value;
  if (!data || !data.monthlyTurns) return false;
  return data.usedTurns / data.monthlyTurns >= 0.9;
});

const cards = computed(() => {
  const data = summary.value;
  return [
    {
      label: '成员',
      value: data ? String(data.memberCount) : '-',
      hint: '本企业通讯录',
      path: '/console/members',
    },
    {
      label: '智能体',
      value: data ? String(data.agentEnabledCount) : '-',
      hint: data ? `共 ${data.agentCount} 个` : '已启用',
      path: '/console/agents',
    },
    {
      label: '知识库',
      value: data ? String(data.kbPendingCount) : '-',
      hint: data ? `待生效 / 已生效 ${data.kbReadyCount}` : '待生效材料',
      path: '/console/knowledge',
    },
    {
      label: '本月对话',
      value: data ? String(data.usedTurns) : '-',
      hint: data ? (data.monthlyTurns ? `上限 ${data.monthlyTurns}` : '未限制') : '用量',
      path: '/console/usage',
    },
  ];
});

const shortcuts = [
  {
    path: '/console/members',
    title: '成员',
    desc: '查看通讯录，添加企业成员',
    icon: Users,
  },
  {
    path: '/console/knowledge',
    title: '知识库',
    desc: '上传材料并点生效',
    icon: BookOpen,
  },
  {
    path: '/console/agents',
    title: '智能体',
    desc: '配置企业助手与可见范围',
    icon: Bot,
  },
  {
    path: '/console/usage',
    title: '用量与审计',
    desc: '查看对话次数和操作记录',
    icon: BarChart3,
  },
];

async function load() {
  if (!auth.session?.currentTenant) {
    summary.value = null;
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    summary.value = await workbenchApi.summary();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
    summary.value = null;
  } finally {
    loading.value = false;
  }
}

function go(path: string) {
  void router.push(path);
}

function goChat() {
  window.location.assign('/agent/chat');
}

onMounted(load);
watch(() => auth.session?.currentTenant?.id, load);
</script>

<style scoped>
.workbench-home {
  background: #fff;
  min-height: calc(100vh - 120px);
  padding: 18px;
}

.home-head {
  align-items: flex-start;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  margin-bottom: 16px;
}

.home-head h1 {
  color: var(--app-heading-color);
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
  margin: 0;
}

.home-head p {
  color: var(--app-text-color);
  font-size: 13px;
  line-height: 1.5;
  margin: 4px 0 0;
}

.home-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

.shortcut-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.shortcut-card {
  align-items: center;
  background: #fff;
  border: 1px solid var(--app-border-color);
  color: inherit;
  cursor: pointer;
  display: flex;
  gap: 12px;
  min-height: 88px;
  padding: 16px 20px;
  text-align: left;
}

.shortcut-card:hover {
  background: #f8fafc;
}

.shortcut-icon {
  color: var(--app-primary-color);
  flex: 0 0 18px;
  height: 18px;
  stroke-width: 1.9;
  width: 18px;
}

.shortcut-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.shortcut-copy strong {
  color: var(--app-heading-color);
  font-size: 14px;
  font-weight: 600;
}

.shortcut-copy small {
  color: var(--app-text-color);
  font-size: 13px;
  line-height: 1.5;
}

@media (max-width: 960px) {
  .home-head {
    flex-direction: column;
  }

  .shortcut-grid {
    grid-template-columns: 1fr;
  }
}
</style>
