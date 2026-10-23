<template>
  <main class="app-shell" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
    <aside class="sidebar">
      <RouterLink class="brand" to="/middle/" title="猛犸智能体">
        <span class="brand-logo">
          <img class="brand-logo-mark" src="/logo-icon.png" alt="猛犸智能体" />
          <span class="brand-logo-rest">猛犸智能体</span>
        </span>
      </RouterLink>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :class="{ active: isActive(item.path) }"
          :to="item.path"
          :title="item.label"
        >
          <component :is="item.icon" class="nav-icon" />
          <span class="nav-label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <button
        class="sidebar-collapse"
        type="button"
        :title="isSidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'"
        @click="isSidebarCollapsed = !isSidebarCollapsed"
      >
        <ChevronLeft class="collapse-icon" />
      </button>
    </aside>

    <section class="main-area">
      <header class="navbar">
        <div class="navbar-leading">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ pageTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="navbar-actions">
          <el-select
            :model-value="session?.currentTenant?.id"
            placeholder="选择租户"
            style="width: 240px"
            @change="onSwitch"
          >
            <el-option
              v-for="t in session?.tenants ?? []"
              :key="t.id"
              :label="`${t.name}（${typeLabel[t.type]}）`"
              :value="t.id"
            />
          </el-select>
          <a class="nav-jump" href="/agent/chat" target="_blank" rel="noopener noreferrer">智能体</a>
          <el-dropdown trigger="click">
            <span class="user-menu">
              <span class="user-avatar">{{ avatar }}</span>
              <span class="username">{{ session?.user.name }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="onLogout">
                  <LogOut class="dropdown-icon" />
                  退出系统
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <section class="workspace">
        <router-view />
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { Building2, ChevronLeft, LayoutDashboard, LogOut, Users } from 'lucide-vue-next';
import { TenantTypeLabel } from '@mammoth/shared';
import { useAuthStore } from '../stores/auth';
import { useResponsiveSidebar } from './useResponsiveSidebar';

const route = useRoute();
const auth = useAuthStore();
const { isSidebarCollapsed } = useResponsiveSidebar();
const session = computed(() => auth.session);
const typeLabel = TenantTypeLabel;
const pageTitle = computed(() => (typeof route.meta.title === 'string' ? route.meta.title : '工作台'));
const avatar = computed(() => (session.value?.user.name || '猛').slice(0, 1));
const navItems = [
  { path: '/middle/', label: '工作台', icon: LayoutDashboard },
  { path: '/middle/tenants', label: '租户', icon: Building2 },
  { path: '/middle/members', label: '成员', icon: Users },
];

function isActive(path: string) {
  if (path === '/middle/' || path === '/middle') return route.path === '/middle' || route.path === '/middle/';
  return route.path === path || route.path.startsWith(`${path}/`);
}

async function onSwitch(id: string) {
  await auth.switchTenant(id);
}

async function onLogout() {
  await auth.logout();
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
  localStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_token');
  window.location.href = '/login';
}
</script>

<style scoped>
.nav-jump {
  color: var(--app-primary-color, #2563eb);
  font-size: 13px;
  margin-right: 8px;
  text-decoration: none;
}
</style>
