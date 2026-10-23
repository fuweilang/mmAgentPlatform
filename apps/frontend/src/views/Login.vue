<template>
  <section class="login-page">
    <div class="login-shell">
      <form class="login-card" :class="{ 'login-card--register': mode === 'register' }" @submit.prevent="onSubmit">
        <div class="login-card-head">
          <img class="login-logo" src="/mengma-logo.png" alt="" width="72" height="72" />
          <h2>猛犸智能体</h2>
          <p>{{ mode === 'register' ? '注册后立即开通企业空间' : '企业用户使用手机号和密码进入系统' }}</p>
        </div>

        <el-segmented v-model="mode" class="mode-switch" :options="modeOptions" />

        <label v-if="mode === 'register'" class="field">
          <span>姓名</span>
          <el-input v-model="form.name" placeholder="请输入姓名" maxlength="40" />
        </label>

        <label class="field">
          <span>手机号</span>
          <el-input
            v-model="form.phone"
            placeholder="请输入手机号"
            maxlength="11"
            autocomplete="username"
            @input="form.phone = form.phone.replace(/[^\d]/g, '').slice(0, 11)"
          />
        </label>

        <label v-if="mode === 'register'" class="field">
          <span>企业/主体名称</span>
          <el-input v-model="form.enterpriseName" placeholder="请输入企业或经营主体名称" maxlength="160" />
        </label>

        <label class="field">
          <span>{{ mode === 'register' ? '设置密码' : '密码' }}</span>
          <el-input
            v-model="form.password"
            type="password"
            :placeholder="mode === 'register' ? '请设置密码' : '请输入密码'"
            show-password
            :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
          />
        </label>

        <div class="agreement">
          <div class="agreement-consent">
            <el-checkbox v-model="form.agree" />
            <span>
              我已阅读并同意
              <span class="agreement-document">用户协议</span>
              和
              <span class="agreement-document">隐私政策</span>
            </span>
          </div>
        </div>

        <el-button class="submit-button" type="primary" native-type="submit" :loading="loading" :disabled="!form.agree">
          {{ mode === 'register' ? '注册并进入系统' : '登录' }}
        </el-button>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth';

const AGENT_HOME = '/agent/chat';
const auth = useAuthStore();

function nextParam() {
  return new URLSearchParams(location.search).get('next');
}
const loading = ref(false);
const mode = ref<'password' | 'register'>('password');
const modeOptions = [
  { label: '密码登录', value: 'password' },
  { label: '注册', value: 'register' },
];
const form = reactive({
  name: '',
  phone: '',
  enterpriseName: '',
  password: '',
  agree: true,
});

onMounted(async () => {
  try {
    await auth.load();
    if (auth.session) goAfterLogin();
  } catch {
    /* stay on login */
  }
});

function isAgentLoginPath(pathname: string) {
  return pathname === '/agent/login' || pathname.startsWith('/agent/login/');
}

function hasOctopToken() {
  return Boolean(localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'));
}

async function startOctopSession() {
  if (hasOctopToken()) {
    window.location.href = AGENT_HOME;
    return;
  }
  try {
    const res = await fetch('/api/auth/oauth/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ kind: 'oidc', redirect_after: '/chat' }),
    });
    if (res.ok) {
      const data = (await res.json()) as { authorization_url?: string };
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
    }
  } catch {
    /* fall through */
  }
  window.location.href = AGENT_HOME;
}

async function goAfterLogin() {
  const next = nextParam();
  if (next?.startsWith('/middle')) {
    window.location.href = next;
    return;
  }
  if (next?.startsWith('/agent')) {
    if (isAgentLoginPath(next)) {
      await startOctopSession();
      return;
    }
    window.location.href = next;
    return;
  }
  if (next?.startsWith('http://') || next?.startsWith('https://')) {
    try {
      const u = new URL(next);
      const okHost = u.hostname === location.hostname || ['127.0.0.1', 'localhost'].includes(u.hostname);
      if (okHost && isAgentLoginPath(u.pathname)) {
        await startOctopSession();
        return;
      }
      const okDest =
        u.pathname.startsWith('/agent') ||
        u.pathname.startsWith('/middle') ||
        u.pathname.startsWith('/middle/api/oidc') ||
        u.pathname.startsWith('/api/oidc') ||
        u.pathname.startsWith('/api/auth/oidc');
      if (okHost && okDest) {
        window.location.href = next;
        return;
      }
    } catch {
      /* fall through */
    }
  }
  await startOctopSession();
}

async function onSubmit() {
  if (!form.agree) {
    ElMessage.warning('请先勾选服务协议和隐私协议');
    return;
  }
  if (!/^1\d{10}$/.test(form.phone)) {
    ElMessage.warning('请输入正确的手机号');
    return;
  }
  if (mode.value === 'register' && !form.name.trim()) {
    ElMessage.warning('请输入姓名');
    return;
  }
  if (mode.value === 'register' && !form.enterpriseName.trim()) {
    ElMessage.warning('请输入企业/主体名称');
    return;
  }

  loading.value = true;
  try {
    if (mode.value === 'register') {
      await auth.register({
        name: form.name.trim(),
        phone: form.phone,
        password: form.password,
        enterpriseName: form.enterpriseName.trim(),
      });
      ElMessage.success('注册成功');
    } else {
      await auth.login(form.phone, form.password);
      ElMessage.success('登录成功');
    }
    goAfterLogin();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : mode.value === 'register' ? '注册失败' : '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  align-items: center;
  background: #f5f7fb;
  display: flex;
  justify-content: center;
  min-height: 100%;
  padding: 16px;
}
.login-shell {
  align-items: center;
  display: flex;
  flex-direction: column;
  width: min(440px, 100%);
}
.login-card {
  background: #fff;
  border: 1px solid #e7eaf0;
  border-radius: 0;
  box-shadow: 0 24px 60px rgba(16, 24, 40, 0.08);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 28px;
  width: 100%;
}
.login-card--register {
  gap: 8px;
  padding: 16px 20px;
}
.login-card-head {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 4px;
  text-align: center;
}
.login-logo {
  display: block;
  height: 72px;
  width: 72px;
}
.login-card--register .login-logo {
  height: 56px;
  width: 56px;
}
.login-card-head h2 {
  color: #333946;
  font-size: 22px;
  margin: 0;
}
.login-card--register .login-card-head h2 {
  font-size: 18px;
}
.login-card-head p {
  color: #666;
  font-size: 13px;
  margin: 0;
}
.mode-switch {
  width: 100%;
}
.field {
  display: grid;
  gap: 8px;
}
.field > span {
  color: #666;
  font-size: 13px;
  font-weight: 500;
}
.agreement {
  color: #666;
  font-size: 12px;
}
.agreement-consent {
  align-items: center;
  display: flex;
  gap: 8px;
}
.agreement-document {
  color: #2563eb;
}
.submit-button {
  width: 100%;
}
:deep(.el-input__wrapper) {
  background: #f8fafc;
  border: 1px solid #e7eaf0;
  border-radius: 0;
  box-shadow: none;
  height: 44px;
}
:deep(.el-input__wrapper.is-focus) {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
:deep(.el-segmented),
:deep(.el-segmented__item),
:deep(.el-checkbox__inner) {
  border-radius: 0;
}
:deep(.el-button--primary:not(.is-text):not(.is-link)) {
  background: #2563eb;
  border-color: #2563eb;
  border-radius: 10px;
  height: 44px;
}
.login-card--register :deep(.el-input__wrapper) {
  height: 36px;
}
.login-card--register :deep(.el-button--primary:not(.is-text):not(.is-link)) {
  height: 36px;
}
</style>
