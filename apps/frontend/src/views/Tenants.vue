<template>
  <div>
    <PageHeader title="租户" description="平台超管在此进入某家企业，再管理控制台。">
      <el-button v-if="canCreate" type="primary" @click="open = true">新建</el-button>
    </PageHeader>

    <el-table :data="rows" v-loading="loading">
      <el-table-column prop="name" label="名称" min-width="160" />
      <el-table-column prop="slug" label="标识" min-width="140" />
      <el-table-column label="类型" width="120">
        <template #default="{ row }">{{ typeText(row.type) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100" />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button type="primary" link :disabled="entering === row.id" @click="enterTenant(row)">
            {{ currentId === row.id ? '当前企业' : '进入' }}
          </el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="还没有租户" />
      </template>
    </el-table>

    <el-dialog v-model="open" title="新建租户" width="420px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="标识" prop="slug"><el-input v-model="form.slug" placeholder="demo-co" /></el-form-item>
        <el-form-item label="类型" prop="type">
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
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { TenantTypeLabel, type TenantType } from '@mammoth/shared';
import { tenantApi, type TenantRow } from '../api/tenants';
import PageHeader from '../components/PageHeader.vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const rows = ref<TenantRow[]>([]);
const loading = ref(false);
const open = ref(false);
const saving = ref(false);
const entering = ref('');
const formRef = ref<FormInstance>();
const form = reactive({
  name: '',
  slug: '',
  type: 'ENTERPRISE' as TenantType,
  parentId: undefined as string | undefined,
});
const canCreate = computed(() => Boolean(auth.session?.user.isPlatformAdmin));
const currentId = computed(() => auth.session?.currentTenant?.id);
const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  slug: [{ required: true, message: '请输入标识', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
};

function typeText(type: TenantType) {
  return TenantTypeLabel[type];
}

async function load() {
  loading.value = true;
  try {
    rows.value = await tenantApi.list();
  } finally {
    loading.value = false;
  }
}

async function enterTenant(row: TenantRow) {
  if (currentId.value === row.id) {
    void router.push('/console/');
    return;
  }
  entering.value = row.id;
  try {
    await auth.switchTenant(row.id);
    ElMessage.success(`已进入 ${row.name}`);
    void router.push('/console/');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '切换失败');
  } finally {
    entering.value = '';
  }
}

async function onCreate() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
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
