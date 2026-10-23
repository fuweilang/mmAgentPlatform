<template>
  <div>
    <div class="bar">
      <h3>成员 · {{ auth.session?.currentTenant?.name || '未选择租户' }}</h3>
      <el-button type="primary" :disabled="!auth.session?.currentTenant" @click="open = true">添加</el-button>
    </div>
    <el-table :data="rows" v-loading="loading">
      <el-table-column label="姓名" prop="user.name" />
      <el-table-column label="手机号" prop="user.phone" />
      <el-table-column label="角色">
        <template #default="{ row }">{{ MemberRoleLabel[row.role] }}</template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="open" title="添加成员" width="420px">
      <el-form label-width="80px">
        <el-form-item label="姓名"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" maxlength="11" @input="form.phone = form.phone.replace(/[^\d]/g, '').slice(0, 11)" />
        </el-form-item>
        <el-form-item label="密码"><el-input v-model="form.password" type="password" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="负责人" value="OWNER" />
            <el-option label="管理员" value="ADMIN" />
            <el-option label="成员" value="MEMBER" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="open = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onAdd">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { MemberRoleLabel, type MemberRole } from '@mammoth/shared';
import { tenantApi, type MemberRow } from '../api/tenants';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const rows = ref<MemberRow[]>([]);
const loading = ref(false);
const open = ref(false);
const saving = ref(false);
const form = reactive({
  name: '',
  phone: '',
  password: '12345678',
  role: 'MEMBER' as MemberRole,
});

async function load() {
  if (!auth.session?.currentTenant) {
    rows.value = [];
    return;
  }
  loading.value = true;
  try {
    rows.value = await tenantApi.members();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

async function onAdd() {
  saving.value = true;
  try {
    await tenantApi.addMember({
      name: form.name,
      phone: form.phone,
      password: form.password,
      role: form.role,
    });
    ElMessage.success('已添加');
    open.value = false;
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '失败');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
watch(() => auth.session?.currentTenant?.id, load);
</script>

<style scoped>
.bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
