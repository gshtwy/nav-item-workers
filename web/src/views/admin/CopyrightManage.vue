<template>
  <div class="copyright-manage">
    <div class="copyright-header"></div>
    <div class="copyright-card">
      <div class="form-row">
        <label>版权年份</label>
        <input v-model="form.year" class="input" placeholder="如 2026" />
      </div>
      <div class="form-row">
        <label>版权主体</label>
        <input v-model="form.name" class="input" placeholder="如 天诚导航网站" />
      </div>
      <div class="form-row">
        <label>Powered by 文案</label>
        <input v-model="form.poweredText" class="input" placeholder="如 CNLiang" />
      </div>
      <div class="form-row">
        <label>Powered by 链接</label>
        <input v-model="form.poweredUrl" class="input" placeholder="超链接地址（可选，留空则不带链接）" />
      </div>
      <div class="form-actions">
        <button class="btn" @click="save" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        <span v-if="savedTip" class="saved-tip">已保存，刷新首页即可看到新页脚</span>
        <span v-if="errorTip" class="error-tip">{{ errorTip }}</span>
      </div>
      <div class="preview-box">
        <div class="preview-label">页脚预览</div>
        <p class="preview-text">Copyright © {{ form.year }} {{ form.name }} | Powered by <a v-if="form.poweredUrl" :href="form.poweredUrl" target="_blank">{{ form.poweredText }}</a><span v-else>{{ form.poweredText }}</span></p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getCopyright, updateCopyright } from '../../api';

const form = ref({ year: '', name: '', poweredText: '', poweredUrl: '' });
const saving = ref(false);
const savedTip = ref(false);
const errorTip = ref('');

onMounted(async () => {
  const res = await getCopyright();
  form.value = { ...form.value, ...res.data };
});

async function save() {
  saving.value = true;
  savedTip.value = false;
  errorTip.value = '';
  try {
    await updateCopyright({ ...form.value });
    savedTip.value = true;
  } catch (e) {
    // v1.2.1：保存失败不再静默——401 多半是部署换 JWT_SECRET 后旧登录态失效，明确提示重登
    const status = e.response?.status;
    if (status === 401) {
      errorTip.value = '保存失败：登录已失效，请退出后重新登录再保存';
    } else {
      errorTip.value = '保存失败：' + (e.response?.data?.error || e.response?.data?.message || e.message || '未知错误');
    }
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.copyright-manage {
  max-width: 900px;
  width: 90%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.copyright-header {
  height: 32px;
}
.copyright-card {
  width: 100%;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  padding: 32px 24px;
  box-sizing: border-box;
}
.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.form-row label {
  width: 130px;
  text-align: right;
  color: #222;
  font-size: 1rem;
  flex-shrink: 0;
}
.input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #d0d7e2;
  background: #fff;
  color: #222;
  height: 25px;
  font-size: 1rem;
}
.input:focus {
  outline: 2px solid #2566d8;
}
.form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0 8px 142px;
}
.btn {
  background: #2566d8;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 8px 22px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn:hover:not(:disabled) {
  background: #174ea6;
}
.btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.saved-tip {
  color: #1abc9c;
  font-size: 0.95rem;
}
.error-tip {
  color: #e74c3c;
  font-size: 0.95rem;
}
.preview-box {
  margin: 16px 0 0 142px;
  background: #f5f7fa;
  border: 1px solid #e3e6ef;
  border-radius: 8px;
  padding: 16px;
}
.preview-label {
  color: #888;
  font-size: 0.85rem;
  margin-bottom: 8px;
}
.preview-text {
  margin: 0;
  color: #222;
}
.preview-text a {
  color: #2566d8;
}
@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }
  .form-row label {
    width: auto;
    text-align: left;
  }
  .form-actions, .preview-box {
    margin-left: 0;
  }
}
</style>
