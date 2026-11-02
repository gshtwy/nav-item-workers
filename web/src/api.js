import axios from 'axios';
const BASE = '/api';

export const login = (username, password) => axios.post(`${BASE}/login`, { username, password });

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// 首屏聚合API（v1.2.0 新增：一次拿齐菜单+首栏卡片+广告+友链+版权）
export const getBootstrap = () => axios.get(`${BASE}/bootstrap`);

// 后台页面（/admin）请求公开 GET 时附加 _t 参数绕开公开缓存，保证管理页永远看到最新数据；
// 首页不附加，正常吃 ETag/短缓存。
const bustParams = () => (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin') ? { _t: Date.now() } : {});

// 菜单相关API
export const getMenus = () => axios.get(`${BASE}/menus`, { params: bustParams() });
export const addMenu = (data) => axios.post(`${BASE}/menus`, data, { headers: authHeaders() });
export const updateMenu = (id, data) => axios.put(`${BASE}/menus/${id}`, data, { headers: authHeaders() });
export const deleteMenu = (id) => axios.delete(`${BASE}/menus/${id}`, { headers: authHeaders() });

// 子菜单相关API
export const getSubMenus = (menuId) => axios.get(`${BASE}/menus/${menuId}/submenus`);
export const addSubMenu = (menuId, data) => axios.post(`${BASE}/menus/${menuId}/submenus`, data, { headers: authHeaders() });
export const updateSubMenu = (id, data) => axios.put(`${BASE}/menus/submenus/${id}`, data, { headers: authHeaders() });
export const deleteSubMenu = (id) => axios.delete(`${BASE}/menus/submenus/${id}`, { headers: authHeaders() });

// 卡片相关API
export const getCards = (menuId, subMenuId = null) => {
  const params = { ...(subMenuId ? { subMenuId } : {}), ...bustParams() };
  return axios.get(`${BASE}/cards/${menuId}`, { params });
};
export const addCard = (data) => axios.post(`${BASE}/cards`, data, { headers: authHeaders() });
export const updateCard = (id, data) => axios.put(`${BASE}/cards/${id}`, data, { headers: authHeaders() });
export const deleteCard = (id) => axios.delete(`${BASE}/cards/${id}`, { headers: authHeaders() });

export const uploadLogo = (file) => {
  const formData = new FormData();
  formData.append('logo', file);
  return axios.post(`${BASE}/upload`, formData, { headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' } });
};

// 广告API
export const getAds = () => axios.get(`${BASE}/ads`, { params: bustParams() });
export const addAd = (data) => axios.post(`${BASE}/ads`, data, { headers: authHeaders() });
export const updateAd = (id, data) => axios.put(`${BASE}/ads/${id}`, data, { headers: authHeaders() });
export const deleteAd = (id) => axios.delete(`${BASE}/ads/${id}`, { headers: authHeaders() });

// 友链API
export const getFriends = () => axios.get(`${BASE}/friends`, { params: bustParams() });
export const addFriend = (data) => axios.post(`${BASE}/friends`, data, { headers: authHeaders() });
export const updateFriend = (id, data) => axios.put(`${BASE}/friends/${id}`, data, { headers: authHeaders() });
export const deleteFriend = (id) => axios.delete(`${BASE}/friends/${id}`, { headers: authHeaders() });

// 用户API
export const getUserProfile = () => axios.get(`${BASE}/users/profile`, { headers: authHeaders() });
export const changePassword = (oldPassword, newPassword) => axios.put(`${BASE}/users/password`, { oldPassword, newPassword }, { headers: authHeaders() });
export const getUsers = () => axios.get(`${BASE}/users`, { headers: authHeaders() }); 
// 版权设置API（Workers 版新增：后台「版权所有」栏 + 页脚渲染）
export const getCopyright = () => axios.get(`${BASE}/copyright`, { params: bustParams() });
export const updateCopyright = (data) => axios.put(`${BASE}/copyright`, data, { headers: authHeaders() });
// 背景设置API（Workers 版新增：后台「背景设置」栏 + 首页背景渲染）
export const getBackground = () => axios.get(`${BASE}/background`, { params: bustParams() });
export const updateBackground = (data) => axios.put(`${BASE}/background`, data, { headers: authHeaders() });
export const collectBackground = (source) => axios.post(`${BASE}/background/collect`, { source }, { headers: authHeaders() });
// 图床API（Workers 版新增：后台「图库管理」页；上传/列表/删除，管理员登录调用，密钥调用走服务端 X-API-Key）
export const imgList = (cursor) => axios.get(`${BASE}/img/list`, { headers: authHeaders(), params: { ...bustParams(), ...(cursor ? { cursor } : {}) } });
export const imgUpload = (formData) => axios.post(`${BASE}/img/upload`, formData, { headers: authHeaders() });
export const imgDelete = (key) => axios.delete(`${BASE}/img/delete`, { headers: authHeaders(), params: { key } });
