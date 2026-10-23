import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    { path: '/login', component: () => import('../views/Login.vue') },
    {
      path: '/middle',
      component: () => import('../layouts/AppLayout.vue'),
      children: [
        { path: '', meta: { title: '工作台' }, component: () => import('../views/Home.vue') },
        { path: 'tenants', meta: { title: '租户' }, component: () => import('../views/Tenants.vue') },
        { path: 'members', meta: { title: '成员' }, component: () => import('../views/Members.vue') },
      ],
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
  return true;
});

export default router;
