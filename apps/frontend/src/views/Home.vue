<template>
  <div>
    <h3>工作台</h3>
    <el-descriptions :column="2" border>
      <el-descriptions-item label="用户">{{ session?.user.name }}</el-descriptions-item>
      <el-descriptions-item label="手机号">{{ session?.user.phone }}</el-descriptions-item>
      <el-descriptions-item label="当前租户">{{ session?.currentTenant?.name || '未选择' }}</el-descriptions-item>
      <el-descriptions-item label="角色">{{ roleText }}</el-descriptions-item>
    </el-descriptions>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { MemberRoleLabel } from '@mammoth/shared';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const session = computed(() => auth.session);
const roleText = computed(() => {
  if (session.value?.user.isPlatformAdmin) return '平台超管';
  const role = session.value?.currentRole;
  return role ? MemberRoleLabel[role] : '-';
});
</script>
