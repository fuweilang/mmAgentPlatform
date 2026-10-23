<template>
  <div>
    <div class="bar">
      <h3>租户</h3>
      <el-button v-if="canCreate" type="primary" @click="open = true">新建</el-button>
    </div>
    <el-table :data="rows" v-loading="loading">
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="slug" label="标识" />
      <el-table-column label="类型">
        <template #default="{ row }">{{ TenantTypeLabel[row.type] }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100" />
    </el-table>

    <el-dialog v-model="open" title="新建租户" width="420px">
      <el-form label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="标识"><el-input v-model="form.slug" placeholder="demo-co" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="代理商" value="AGENCY" />
            <el-option label="企业" value="ENTERPRISE" />
          </el-select>
        </el-form-item>
        <el-form-item label="上级">
          <el-select v-model="form.parentId" clearable placeholder="可选" style="width: 100%">
            <el-option v-for="t in rows" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="open = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { TenantTypeLabel, type TenantType } from '@mammoth/shared';
import { tenantApi, type TenantRow } from '../api/tenants';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const rows = ref<TenantRow[]>([]);
const loading = ref(false);
const open = ref(false);
const saving = ref(false);
const form = reactive({ name: '', slug: '', type: 'ENTERPRISE' as TenantType, parentId: undefined as string | undefined });
const canCreate = computed(
  () => auth.session?.user.isPlatformAdmin || auth.session?.currentRole === 'OWNER' || auth.session?.currentRole === 'ADMIN',
);

async function load() {
  loading.value = true;
  try {
    rows.value = await tenantApi.list();
  } finally {
    loading.value = false;
  }
}

async function onCreate() {
  saving.value = true;
  try {
    await tenantApi.create({
      name: form.name,
      slug: form.slug,
      type: form.type,
      parentId: form.parentId || undefined,
    });
    ElMessage.success('已创建');
    open.value = false;
    await load();
    await auth.load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '失败');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
