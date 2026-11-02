<template>
  <span>Copyright © {{ info.year }} {{ info.name }} | Powered by <a v-if="info.poweredUrl" :href="info.poweredUrl" target="_blank" class="footer-link">{{ info.poweredText }}</a><span v-else>{{ info.poweredText }}</span></span>
</template>

<script setup>
// 页脚版权：从 /api/copyright 读取后台「版权所有」栏的设置渲染；读不到时用与定稿一致的默认值兜底
import { ref, onMounted } from 'vue';
import { getCopyright } from '../api';

// 首页可通过 initial 传入 bootstrap 已带回的版权数据，省掉一次单独请求；不传则自己拉取（后台页脚走这条）
const props = defineProps({ initial: { type: Object, default: null } });
const info = ref({ year: '2026', name: '天诚导航网站', poweredText: 'CNLiang', poweredUrl: '', ...(props.initial || {}) });

onMounted(async () => {
  if (props.initial) return;
  try {
    const res = await getCopyright();
    if (res.data) info.value = { ...info.value, ...res.data };
  } catch (e) {
    // 接口异常时保持默认文案，不影响页面使用
  }
});
</script>

<style scoped>
/* 样式必须写在本组件里：Home/Admin 的 scoped 样式进不到子组件内部的 <a>，
   之前链接只吃到全局重置样式（与正文同色、无下划线），看起来跟普通文字没区别。
   平时与正文同色，鼠标悬停变蓝+下划线（用户 2026-11-01 截图定稿效果）。 */
.footer-link {
  color: inherit;
  text-decoration: none;
  transition: color 0.2s;
}
.footer-link:hover {
  color: #2f7bff;
  text-decoration: underline;
}
</style>
