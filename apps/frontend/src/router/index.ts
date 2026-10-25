import { createRouter, createWebHistory } from 'vue-router';
import { ElMessage } from 'element-plus';
import { canAccessConsole } from '@mammoth/shared';
import { useAuthStore } from '../stores/auth';

const AGENT_HOME = '/agent/chat';
const AppShell = () => import('../layouts/AppShell.vue');

const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    { path: '/login', component: () => import('../views/Login.vue') },
    {
      path: '/admin',
      component: AppShell,
      children: [
        { path: '', meta: { title: '总览' }, component: () => import('../views/admin/AdminHome.vue') },
        { path: 'users', meta: { title: '用户管理' }, component: () => import('../views/admin/AdminUsers.vue') },
        { path: 'roles', meta: { title: '角色管理' }, component: () => import('../views/admin/AdminRoles.vue') },
        {
          path: 'enterprises',
          meta: { title: '企业管理' },
          component: () => import('../views/admin/AdminEnterprises.vue'),
        },
      ],
    },
    {
      path: '/console',
      component: AppShell,
      children: [
        { path: '', meta: { title: '工作台' }, component: () => import('../views/Home.vue') },
        { path: 'agents', meta: { title: '智能体' }, component: () => import('../views/Agents.vue') },
        { path: 'knowledge', meta: { title: '知识库' }, component: () => import('../views/Knowledge.vue') },
        { path: 'members', meta: { title: '成员' }, component: () => import('../views/Members.vue') },
        { path: 'usage', meta: { title: '用量与审计' }, component: () => import('../views/Usage.vue') },
        { path: 'settings', meta: { title: '企业设置' }, component: () => import('../views/Settings.vue') },
      ],
    },
    {
      path: '/middle/:pathMatch(.*)*',
      redirect: (to) => {
        const raw = to.params.pathMatch;
        const rest = Array.isArray(raw) ? raw.filter(Boolean).join('/') : raw || '';
        return { path: rest ? `/console/${rest}` : '/console', query: to.query, hash: to.hash };
      },
    },
  ],
});

router.beforeEach(async (to) => {
  if (to.path === '/login') return true;

  const auth = useAuthStore();
  if (!auth.session) {
    try {
      await auth.load();
    } catch {
      return '/login';
    }
  }

  const session = auth.session;

  // 总后台只对平台管理员开放。智能体是独立应用，必须整页跳转。
  if (to.path.startsWith('/admin')) {
    if (!session?.user.isPlatformAdmin) {
      ElMessage.warning('无权访问总后台');
      window.location.href = AGENT_HOME;
      return false;
    }
    return true;
  }

  if (to.path.startsWith('/console')) {
    if (!canAccessConsole(session)) {
      ElMessage.warning('无权访问企业控制台');
      window.location.href = AGENT_HOME;
      return false;
    }
    if (session?.user.isPlatformAdmin && !session.currentTenant) {
      const wanted = typeof to.query.tenantId === 'string' ? to.query.tenantId : '';
      if (wanted) {
        try {
          await auth.switchTenant(wanted);
          return true;
        } catch {
          return '/admin';
        }
      }
      return '/admin';
    }
  }

  return true;
});

export default router;