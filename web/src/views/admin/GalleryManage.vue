<template>
  <div class="gallery-manage">
    <div class="gallery-header"></div>
    <div class="gallery-card">
      <div
        class="drop-zone"
        :class="{ dragging: dragging }"
        @click="pickFiles"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <p class="drop-title">{{ uploading ? '上传中...' : '点击选择图片，或把图片拖到这里' }}</p>
        <p class="drop-sub">支持 png / jpg / gif / webp / svg / ico / avif / bmp，单个最大 20MB，可多选</p>
        <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onPick" />
      </div>
      <div class="form-actions">
        <span v-if="tip" class="saved-tip">{{ tip }}</span>
        <span v-if="errorTip" class="error-tip">{{ errorTip }}</span>
        <span class="count-tip">共 {{ images.length }} 张（仅图床目录 img/ 与根目录文件）</span>
      </div>
      <div v-if="loading" class="empty-tip">加载中...</div>
      <div v-else-if="!images.length" class="empty-tip">图库还是空的，先传一张试试</div>
      <div v-else class="grid">
        <div class="item" v-for="img in images" :key="img.key">
          <div class="thumb"><img :src="img.url" :alt="img.key" loading="lazy" /></div>
          <div class="meta">
            <div class="name" :title="img.key">{{ shortName(img.key) }}</div>
            <div class="sub">{{ formatSize(img.size) }} · {{ formatDate(img.uploaded) }}</div>
          </div>
          <div class="ops">
            <button class="op-btn" @click="copyText(fullUrl(img.url), '直链')">直链</button>
            <button class="op-btn" @click="copyText('![](' + fullUrl(img.url) + ')', 'Markdown')">MD</button>
            <button class="op-btn danger" @click="remove(img)">删除</button>
          </div>
        </div>
      </div>
      <div class="api-box">
        <div class="preview-label">API 密钥调用（PicGo / Typora / 脚本）</div>
        <p class="api-line">上传：<code>POST /api/img/upload</code>，请求头 <code>X-API-Key: 你的图床密钥</code>，表单字段 <code>file</code></p>
        <p class="api-line">列表：<code>GET /api/img/list</code>；删除：<code>DELETE /api/img/delete?key=文件名</code>（同一密钥）</p>
        <p class="api-line">密钥是 Worker 的 Secret <code>IMG_API_KEY</code>，与管理员密码分开，可单独更换。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { imgList, imgUpload, imgDelete } from '../../api';

const images = ref([]);
const loading = ref(false);
const uploading = ref(false);
const dragging = ref(false);
const tip = ref('');
const errorTip = ref('');
const fileInput = ref(null);

function fullUrl(u) {
  return u.startsWith('http') ? u : window.location.origin + u;
}
function shortName(key) {
  const parts = key.split('/');
  return parts.length > 1 ? parts.slice(-2).join('/') : key;
}
function formatSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}
function formatDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    tip.value = label + '已复制';
    errorTip.value = '';
  } catch (e) {
    errorTip.value = '复制失败，请手动复制：' + text;
  }
}
async function load() {
  loading.value = true;
  try {
    const res = await imgList();
    images.value = res.data.images || [];
  } catch (e) {
    errorTip.value = '加载失败：' + (e.response?.data?.error || e.message || '未知错误');
  } finally {
    loading.value = false;
  }
}
function pickFiles() {
  fileInput.value && fileInput.value.click();
}
function onPick(e) {
  uploadFiles(Array.from(e.target.files || []));
  e.target.value = '';
}
function onDrop(e) {
  dragging.value = false;
  uploadFiles(Array.from(e.dataTransfer.files || []));
}
async function uploadFiles(files) {
  if (!files.length) return;
  uploading.value = true;
  tip.value = '';
  errorTip.value = '';
  try {
    for (const f of files) {
      const fd = new FormData();
      fd.append('file', f);
      await imgUpload(fd);
    }
    tip.value = '上传成功';
    await load();
  } catch (e) {
    const status = e.response?.status;
    if (status === 401) {
      errorTip.value = '上传失败：登录已失效，请退出后重新登录';
    } else {
      errorTip.value = '上传失败：' + (e.response?.data?.error || e.message || '未知错误');
    }
  } finally {
    uploading.value = false;
  }
}
async function remove(img) {
  if (!window.confirm('确定删除这张图吗？直链将立即失效：' + img.key)) return;
  try {
    await imgDelete(img.key);
    images.value = images.value.filter((x) => x.key !== img.key);
    tip.value = '已删除';
    errorTip.value = '';
  } catch (e) {
    errorTip.value = '删除失败：' + (e.response?.data?.error || e.message || '未知错误');
  }
}
onMounted(load);
</script>

<style scoped>
.gallery-manage {
  max-width: 1080px;
  width: 94%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.gallery-header {
  height: 32px;
}
.gallery-card {
  width: 100%;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  padding: 28px 24px;
  box-sizing: border-box;
}
.drop-zone {
  border: 2px dashed #b9c8e2;
  border-radius: 10px;
  padding: 28px 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.drop-zone:hover, .drop-zone.dragging {
  border-color: #2566d8;
  background: #f2f7ff;
}
.drop-title {
  margin: 0 0 6px;
  font-size: 1.05rem;
  color: #222;
}
.drop-sub {
  margin: 0;
  color: #888;
  font-size: 0.88rem;
}
.form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 14px 0 6px;
  min-height: 22px;
}
.saved-tip {
  color: #1abc9c;
  font-size: 0.95rem;
}
.error-tip {
  color: #e74c3c;
  font-size: 0.95rem;
}
.count-tip {
  color: #888;
  font-size: 0.88rem;
  margin-left: auto;
}
.empty-tip {
  color: #888;
  text-align: center;
  padding: 30px 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
  margin-top: 10px;
}
.item {
  border: 1px solid #e3e6ef;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  display: flex;
  flex-direction: column;
}
.thumb {
  height: 120px;
  background: #f5f7fa repeating-conic-gradient(#eceff5 0% 25%, #f5f7fa 0% 50%) 0 0/16px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb img {
  max-width: 100%;
  max-height: 120px;
  object-fit: contain;
}
.meta {
  padding: 8px 10px 4px;
}
.name {
  font-size: 0.85rem;
  color: #222;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub {
  font-size: 0.78rem;
  color: #999;
  margin-top: 2px;
}
.ops {
  display: flex;
  gap: 6px;
  padding: 8px 10px 10px;
  margin-top: auto;
}
.op-btn {
  flex: 1;
  background: #eef3fd;
  color: #2566d8;
  border: none;
  border-radius: 4px;
  padding: 5px 0;
  cursor: pointer;
  font-size: 0.85rem;
}
.op-btn:hover {
  background: #dbe7fb;
}
.op-btn.danger {
  background: #fdeeee;
  color: #e74c3c;
}
.op-btn.danger:hover {
  background: #fbdcdc;
}
.api-box {
  margin-top: 22px;
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
.api-line {
  margin: 4px 0;
  color: #333;
  font-size: 0.92rem;
}
.api-line code {
  background: #e8edf5;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 0.88em;
}
</style>
