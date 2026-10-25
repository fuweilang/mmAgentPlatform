import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SessionMe } from '@mammoth/shared';
import { authApi } from '../api/auth';
import { clearSessionCache, getCachedSession, getIsLogin, setSessionCache } from '../utils/session';

export const useAuthStore = defineStore('auth', () => {
  const session = ref<SessionMe | null>(getCachedSession());

  function apply(next: SessionMe) {
    session.value = next;
    setSessionCache(next);
  }

  function clear() {
    session.value = null;
    clearSessionCache();
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
  }

  async function load() {
    if (!getIsLogin() && !session.value) {
      session.value = await authApi.me();
      if (session.value) setSessionCache(session.value);
      return;
    }
    session.value = await authApi.me();
    if (session.value) setSessionCache(session.value);
  }

  async function login(phone: string, password: string) {
    apply(await authApi.login(phone, password));
  }

  async function register(body: {
    name: string;
    phone: string;
    password: string;
    enterpriseName: string;
  }) {
    apply(await authApi.register(body));
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      clear();
    }
  }

  async function switchTenant(tenantId: string) {
    apply(await authApi.switchTenant(tenantId));
  }

  async function exitWorkbench() {
    apply(await authApi.exitWorkbench());
  }

  async function consumeBrowserSso(ticket: string) {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
    apply(await authApi.consumeBrowserSso(ticket));
  }

  return { session, load, login, register, logout, switchTenant, exitWorkbench, consumeBrowserSso };
});
