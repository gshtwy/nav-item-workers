<template>
  <div class="copyright-manage">
    <div class="copyright-header"></div>
    <div class="copyright-card">
      <div class="form-row">
        <label>背景模式</label>
        <div class="radio-group">
          <label class="radio-row"><input type="radio" value="bing" v-model="form.mode" /> Bing 每日图（微软官方接口，每天自动换新）</label>
          <label class="radio-row"><input type="radio" value="nasa" v-model="form.mode" /> NASA 每日图（NASA 官方图库，每天自动换新）</label>
          <label class="radio-row"><input type="radio" value="local" v-model="form.mode" /> 本地图（站点自带 background.webp）</label>
          <label class="radio-row"><input type="radio" value="custom" v-model="form.mode" /> 自定义图片（填图片地址）</label>
        </div>
      </div>
      <div class="form-row" v-if="form.mode === 'custom'">
        <label>图片地址</label>
        <input v-model="form.url" class="input" placeholder="https://example.com/bg.jpg" />
      </div>
      <div class="form-actions">
        <button class="btn" @click="save" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        <button class="btn collect-btn" v-if="form.mode === 'bing' || form.mode === 'nasa'" @click="collect" :disabled="collecting">{{ collecting ? '保存中...' : (form.mode === 'bing' ? 'Bing 每日图保存图库' : 'NASA 每日图保存图库') }}</button>
        <span v-if="savedTip" class="saved-tip">已保存，刷新首页即可看到新背景</span>
        <span v-if="collectTip" class="saved-tip">{{ collectTip }}</span>
        <span v-if="collectError" class="error-tip">{{ collectError }}</span>
        <span v-if="errorTip" class="error-tip">{{ errorTip }}</span>
      </div>
      <div class="preview-box">
        <div class="preview-label">背景预览</div>
        <img v-if="previewSrc" :src="previewSrc" class="bg-preview" alt="背景预览" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { getBackground, updateBackground, collectBackground } from '../../api';

const form = ref({ mode: 'bing', url: '' });
const saving = ref(false);
const savedTip = ref(false);
const collecting = ref(false);
const collectTip = ref('');
const collectError = ref('');
async function collect() {
  collecting.value = true;
  collectTip.value = '';
  collectError.value = '';
  try {
    const res = await collectBackground(form.value.mode);
    collectTip.value = '已存到图库' + (res.data.title ? '：' + res.data.title : '') + '（去图库管理查看）';
  } catch (e) {
    const status = e.response?.status;
    if (status === 401) {
      collectError.value = '保存失败：登录已失效，请退出后重新登录';
    } else {
      collectError.value = '保存失败：' + (e.response?.data?.error || e.message || '未知错误');
    }
  } finally {
    collecting.value = false;
  }
}
const errorTip = ref('');

const dayKey = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '-' + Math.floor(d.getHours() / 6);
};
const previewSrc = computed(() => {
  if (form.value.mode === 'local') return '/background.webp';
  if (form.value.mode === 'custom') return form.value.url || '';
  if (form.value.mode === 'nasa') return '/api/wallpaper?src=nasa&d=' + dayKey();
  return '/api/wallpaper?d=' + dayKey();
});

onMounted(async () => {
  const res = await getBackground();
  form.value = { ...form.value, ...res.data };
});

async function save() {
  saving.value = true;
  savedTip.value = false;
  errorTip.value = '';
  try {
    await updateBackground({ ...form.value });
    savedTip.value = true;
  } catch (e) {
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
.radio-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.radio-group .radio-row {
  width: auto;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
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
.collect-btn {
  background: #eef3fd;
  color: #2566d8;
  margin-left: 10px;
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
.bg-preview {
  width: 100%;
  max-height: 180px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
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
