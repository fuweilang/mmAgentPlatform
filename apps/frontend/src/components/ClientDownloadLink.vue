<template>
  <div class="client-download-wrap" :class="`client-download-wrap--${variant}`">
    <a class="client-download" :class="`client-download--${variant}`" :href="primaryUrl">
      <Download class="client-download-icon" :stroke-width="1.8" />
      {{ primaryLabel }}
    </a>
    <el-dropdown trigger="click" placement="bottom-end">
      <button class="client-download-more" type="button" title="下载其它版本">
        <ChevronDown class="client-download-more-icon" :stroke-width="2" />
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="item in CLIENT_PLATFORM_OPTIONS"
            :key="item.id"
            @click="download(item.id)"
          >
            <span>{{ item.label }}</span>
            <span v-if="item.id === primaryPlatform" class="client-download-recommended">推荐</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ChevronDown, Download } from 'lucide-vue-next';
import {
  CLIENT_PLATFORM_OPTIONS,
  clientDownloadPrimaryLabel,
  clientDownloadUrl,
  detectClientPlatform,
  type ClientPlatform,
} from '../utils/clientDownload';

withDefaults(defineProps<{ variant?: 'navbar' | 'login' }>(), { variant: 'navbar' });

const primaryPlatform = detectClientPlatform();
const primaryUrl = computed(() => clientDownloadUrl(primaryPlatform));
const primaryLabel = computed(() => clientDownloadPrimaryLabel(primaryPlatform));

function download(platform: ClientPlatform) {
  window.location.assign(clientDownloadUrl(platform));
}
</script>

<style scoped>
.client-download-wrap {
  align-items: stretch;
  display: inline-flex;
}

.client-download {
  align-items: center;
  color: #667085;
  display: inline-flex;
  font-size: 13px;
  gap: 6px;
  text-decoration: none;
}

.client-download:hover {
  color: #2563eb;
}

.client-download-icon {
  flex-shrink: 0;
  height: 16px;
  width: 16px;
}

.client-download-wrap--navbar {
  background: #2563eb;
  height: 32px;
  overflow: hidden;
}

.client-download--navbar {
  background: transparent;
  color: #fff;
  font-weight: 600;
  height: 32px;
  padding: 0 12px;
}

.client-download--navbar:hover {
  background: #1d4ed8;
  color: #fff;
}

.client-download--login {
  justify-content: center;
  min-height: 32px;
}

.client-download-more {
  align-items: center;
  background: transparent;
  border: 0;
  color: #2563eb;
  cursor: pointer;
  display: inline-flex;
  justify-content: center;
  padding: 0;
}

.client-download-wrap--navbar .client-download-more {
  background: rgba(255, 255, 255, 0.16);
  border-left: 1px solid rgba(255, 255, 255, 0.22);
  color: #fff;
  height: 32px;
  width: 28px;
}

.client-download-wrap--navbar .client-download-more:hover {
  background: rgba(255, 255, 255, 0.28);
}

.client-download-wrap--login .client-download-more {
  height: 32px;
  width: 24px;
}

.client-download-wrap--login .client-download-more:hover {
  color: #1d4ed8;
}

.client-download-more-icon {
  height: 14px;
  width: 14px;
}

.client-download-recommended {
  color: #2563eb;
  font-size: 12px;
  margin-left: 8px;
}
</style>
