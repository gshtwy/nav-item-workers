// Nav-Item Workers 版 —— 由原版 eooce/Nav-Item（Express + SQLite）移植
// 运行模型：单个 Worker 同时托管前端静态资源（ASSETS）、/api/* 接口（D1）、/uploads/* 图片（R2）
// 与原版的差异（均为 Workers 平台所迫，接口契约保持不变）：
//   1. sqlite3 本地文件 → D1（SQL 原样复用，6 张表结构不变）
//   2. bcrypt 原生模块 → WebCrypto PBKDF2-SHA256（原生实现，不吃 CPU 配额；新库无旧哈希兼容问题）
//   3. jsonwebtoken → WebCrypto HMAC-SHA256 自签 JWT（HS256，2 小时有效期与原版一致）
//   4. multer 写本地磁盘 → R2；文件名规则不变（时间戳+原扩展名）
//   5. 上传接口补了登录鉴权：原版 upload 路由漏挂 auth（任何人可传图），前端本来就带 token，加上不影响使用
import { SEED } from './seed.js';

const VERSION = '1.3.10-workers';

// 页脚版权默认值（后台「版权所有」栏可改，存 D1 settings 表）
const COPYRIGHT_DEFAULTS = {
  year: '2026',
  name: '天诚导航网站',
  poweredText: 'CNLiang',
  poweredUrl: '',
};

// ---------- 基础工具 ----------
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
    },
  });
}

// 公开 GET 专用（v1.2.0 性能优化）：ETag 条件请求 + 短缓存。
// 数据经后台修改后，公开侧最多延迟 max-age 秒看到新值；后台页面自身的请求
// 由前端 api.js 自动附加 _t 参数绕开缓存（URL 不同即不同缓存键），不受影响。
const PUBLIC_CACHE_CONTROL = 'public, max-age=30, s-maxage=120, stale-while-revalidate=60';
async function publicJson(request, data) {
  const body = JSON.stringify(data);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const etag = 'W/"' + b64urlEncode(new Uint8Array(digest)).slice(0, 27) + '"';
  const headers = {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'cache-control': PUBLIC_CACHE_CONTROL,
    etag,
  };
  const inm = request.headers.get('if-none-match');
  if (inm && (inm.trim() === '*' || inm.split(',').map((s) => s.trim()).includes(etag))) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, { status: 200, headers });
}

function b64urlEncode(bytes) {
  let s = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecodeToBytes(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function b64Encode(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
function b64Decode(str) {
  const bin = atob(str);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ---------- 密码 PBKDF2（替代 bcrypt） ----------
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100000;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return 'pbkdf2$' + iterations + '$' + b64Encode(salt) + '$' + b64Encode(new Uint8Array(bits));
}
async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('pbkdf2$')) return false;
  const parts = stored.split('$');
  const iterations = parseInt(parts[1], 10);
  const salt = b64Decode(parts[2]);
  const expected = b64Decode(parts[3]);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return timingSafeEqual(new Uint8Array(bits), expected);
}

// ---------- JWT HS256（替代 jsonwebtoken，2 小时有效期与原版一致） ----------
async function jwtSign(payload, secret) {
  const header = b64urlEncode(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 2 * 3600 };
  const bodyB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(body)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(header + '.' + bodyB64));
  return header + '.' + bodyB64 + '.' + b64urlEncode(sig);
}
async function jwtVerify(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('bad token');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('HMAC', key, b64urlDecodeToBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new Error('bad signature');
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecodeToBytes(parts[1])));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('expired');
  return payload;
}

// ---------- 原版辅助逻辑 ----------
function getClientIp(request) {
  let ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
  return ip;
}
function getShanghaiTime() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const p = {};
  for (const part of fmt.formatToParts(new Date())) p[part.type] = part.value;
  return p.year + '-' + p.month + '-' + p.day + ' ' + p.hour + ':' + p.minute + ':' + p.second;
}
function jwtSecret(env) {
  return env.JWT_SECRET || 'nav-item-jwt-secret-2024-secure-key';
}

// ---------- 数据库初始化 + 默认数据（对应原版 db.js 行为：表空时自动播种） ----------
// v1.2.0 性能优化：初始化完成后在 settings 写 schema_version 标记；冷实例先用
// 一次轻查询探标记，命中就跳过整轮初始化（原先每个冷实例要跑 8 次 D1 操作）。
// 表结构有变更时把 SCHEMA_VERSION 加 1，旧库会自动重走完整初始化。
const SCHEMA_VERSION = '1';
let initPromise = null;
function ensureInit(env) {
  if (!initPromise) {
    initPromise = initOnce(env).catch((e) => { initPromise = null; throw e; });
  }
  return initPromise;
}
async function initOnce(env) {
  try {
    const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('schema_version').first();
    if (row && row.value === SCHEMA_VERSION) return; // 已初始化：快路径
  } catch (e) { /* settings 表还不存在 → 走完整初始化 */ }
  await doInit(env);
}
async function doInit(env) {
  const db = env.DB;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS menus (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, "order" INTEGER DEFAULT 0)'),
    db.prepare('CREATE TABLE IF NOT EXISTS sub_menus (id INTEGER PRIMARY KEY AUTOINCREMENT, parent_id INTEGER NOT NULL, name TEXT NOT NULL, "order" INTEGER DEFAULT 0, FOREIGN KEY(parent_id) REFERENCES menus(id) ON DELETE CASCADE)'),
    db.prepare('CREATE TABLE IF NOT EXISTS cards (id INTEGER PRIMARY KEY AUTOINCREMENT, menu_id INTEGER, sub_menu_id INTEGER, title TEXT NOT NULL, url TEXT NOT NULL, logo_url TEXT, custom_logo_path TEXT, desc TEXT, "order" INTEGER DEFAULT 0, FOREIGN KEY(menu_id) REFERENCES menus(id) ON DELETE CASCADE, FOREIGN KEY(sub_menu_id) REFERENCES sub_menus(id) ON DELETE CASCADE)'),
    db.prepare('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, last_login_time TEXT, last_login_ip TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS ads (id INTEGER PRIMARY KEY AUTOINCREMENT, position TEXT NOT NULL, img TEXT NOT NULL, url TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS friends (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL, logo TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)'),
  ]);

  // 版权设置默认值（仅缺失时写入，不覆盖后台已改的值；v1.2.0 起改为一次 batch）
  await db.batch(Object.entries({
    copyright_year: COPYRIGHT_DEFAULTS.year,
    copyright_name: COPYRIGHT_DEFAULTS.name,
    copyright_powered_text: COPYRIGHT_DEFAULTS.poweredText,
    copyright_powered_url: COPYRIGHT_DEFAULTS.poweredUrl,
  }).map(([k, v]) => db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').bind(k, v)));

  // 三张表的计数一次 batch 查完（v1.2.0：原先是 3 次串行查询）
  const [userCountRes, menuCountRes, friendCountRes] = await db.batch([
    db.prepare('SELECT COUNT(*) AS count FROM users'),
    db.prepare('SELECT COUNT(*) AS count FROM menus'),
    db.prepare('SELECT COUNT(*) AS count FROM friends'),
  ]);
  const userCount = userCountRes.results[0];
  const menuCount = menuCountRes.results[0];
  const friendCount = friendCountRes.results[0];

  // 默认管理员（原版：users 表为空时按环境变量建号）
  if (userCount && userCount.count === 0) {
    const username = env.ADMIN_USERNAME || 'admin';
    const password = env.ADMIN_PASSWORD || '123456';
    await db.prepare('INSERT INTO users (username, password) VALUES (?, ?)')
      .bind(username, await hashPassword(password)).run();
  }

  // 默认菜单/子菜单/卡片（原版：menus 表为空时播种，数据见 seed.js）
  if (menuCount && menuCount.count === 0) {
    const menuMap = {};
    for (const [name, order] of SEED.menus) {
      const r = await db.prepare('INSERT INTO menus (name, "order") VALUES (?, ?)').bind(name, order).run();
      menuMap[name] = r.meta.last_row_id;
    }
    const subMenuMap = {};
    for (const sm of SEED.subMenus) {
      if (!menuMap[sm.parentMenu]) continue;
      const r = await db.prepare('INSERT INTO sub_menus (parent_id, name, "order") VALUES (?, ?, ?)')
        .bind(menuMap[sm.parentMenu], sm.name, sm.order).run();
      subMenuMap[sm.parentMenu + '_' + sm.name] = r.meta.last_row_id;
    }
    for (const card of SEED.cards) {
      if (card.subMenu) {
        let subMenuId = null;
        for (const [key, id] of Object.entries(subMenuMap)) {
          if (key.endsWith('_' + card.subMenu)) { subMenuId = id; break; }
        }
        if (subMenuId) {
          await db.prepare('INSERT INTO cards (menu_id, sub_menu_id, title, url, logo_url, desc) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(null, subMenuId, card.title, card.url, card.logo_url, card.desc).run();
        }
      } else if (menuMap[card.menu]) {
        await db.prepare('INSERT INTO cards (menu_id, sub_menu_id, title, url, logo_url, desc) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(menuMap[card.menu], null, card.title, card.url, card.logo_url, card.desc).run();
      }
    }
  }

  // 默认友链（原版：friends 表为空时播种）
  if (friendCount && friendCount.count === 0) {
    for (const [title, url, logo] of SEED.friends) {
      await db.prepare('INSERT INTO friends (title, url, logo) VALUES (?, ?, ?)').bind(title, url, logo).run();
    }
  }

  // 全部初始化成功后才写版本标记（中途失败不会误入快路径）
  await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .bind('schema_version', SCHEMA_VERSION).run();
}

// ---------- 鉴权（对应原版 authMiddleware，报错文案不变） ----------
async function requireAuth(request, env) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return { error: json({ error: '未授权' }, 401) };
  try {
    const user = await jwtVerify(auth.slice(7), jwtSecret(env));
    return { user };
  } catch (e) {
    return { error: json({ error: '无效token' }, 401) };
  }
}

// 图床鉴权（v1.2.6 新增）：管理员 JWT 或独立图床密钥（X-API-Key 头，对照 Secret IMG_API_KEY）任一通过即可
const IMG_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'avif', 'bmp'];
async function requireAuthOrKey(request, env) {
  const key = request.headers.get('x-api-key') || '';
  if (key && env.IMG_API_KEY) {
    const a = new TextEncoder().encode(key);
    const b = new TextEncoder().encode(String(env.IMG_API_KEY));
    if (a.length === b.length && timingSafeEqual(a, b)) return { user: { id: 0, username: 'api-key' } };
  }
  return requireAuth(request, env);
}

async function readBody(request) {
  try { return await request.json(); } catch (e) { return {}; }
}
// D1 的 bind 不接受 undefined（原版 sqlite3 会当 NULL 处理）：缺失字段统一转 null
function nn(x) { return x === undefined ? null : x; }

// 分页小工具（原版 ads/friends/menus/users 四处同款逻辑）
function pageParams(url) {
  const page = url.searchParams.get('page');
  const pageSize = url.searchParams.get('pageSize');
  if (!page && !pageSize) return null;
  const pageNum = parseInt(page, 10) || 1;
  const size = parseInt(pageSize, 10) || 10;
  return { pageNum, size, offset: (pageNum - 1) * size };
}

// ---------- v1.2.0 查询小工具（menus 一次 JOIN、卡片 logo 补全、版权组装） ----------
// 原先 /api/menus 是「查菜单 + 逐个菜单查子菜单」的 N+1 串行查询（8 个菜单 = 9 次
// 远程 D1 查询）；改成一条 LEFT JOIN 一次查完，在内存里组装，响应结构不变。
const MENUS_JOIN_SQL = `SELECT m.id AS m_id, m.name AS m_name, m."order" AS m_order,
  s.id AS s_id, s.parent_id AS s_parent_id, s.name AS s_name, s."order" AS s_order
  FROM menus m LEFT JOIN sub_menus s ON s.parent_id = m.id
  ORDER BY m."order", m.id, s."order", s.id`;
function assembleMenus(joinRows) {
  const out = [];
  const byId = new Map();
  for (const r of joinRows) {
    let menu = byId.get(r.m_id);
    if (!menu) {
      menu = { id: r.m_id, name: r.m_name, order: r.m_order, subMenus: [] };
      byId.set(r.m_id, menu);
      out.push(menu);
    }
    if (r.s_id !== null && r.s_id !== undefined) {
      menu.subMenus.push({ id: r.s_id, parent_id: r.s_parent_id, name: r.s_name, order: r.s_order });
    }
  }
  return out;
}
function decorateCards(rows) {
  for (const card of rows) {
    if (!card.custom_logo_path) {
      card.display_logo = card.logo_url || (card.url.replace(/\/+$/, '') + '/favicon.ico');
    } else {
      card.display_logo = '/uploads/' + card.custom_logo_path;
    }
  }
  return rows;
}
function assembleCopyright(settingsRows) {
  const map = {};
  for (const r of settingsRows) map[r.key] = r.value;
  return {
    year: map.copyright_year ?? COPYRIGHT_DEFAULTS.year,
    name: map.copyright_name ?? COPYRIGHT_DEFAULTS.name,
    poweredText: map.copyright_powered_text ?? COPYRIGHT_DEFAULTS.poweredText,
    poweredUrl: map.copyright_powered_url ?? COPYRIGHT_DEFAULTS.poweredUrl,
  };
}
const COPYRIGHT_KEYS_SQL = "SELECT key, value FROM settings WHERE key IN ('copyright_year','copyright_name','copyright_powered_text','copyright_powered_url')";
function assembleBackground(settingsRows) {
  const map = {};
  for (const r of settingsRows) map[r.key] = r.value;
  const mode = ['bing', 'local', 'custom', 'nasa'].includes(map.bg_mode) ? map.bg_mode : 'bing';
  return { mode, url: map.bg_url ?? '' };
}
const BG_KEYS_SQL = "SELECT key, value FROM settings WHERE key IN ('bg_mode','bg_url')";

// ---------- 主入口 ----------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'access-control-allow-headers': 'content-type,authorization',
        },
      });
    }

    // 图片读取走 R2（对应原版 express.static('/uploads')）
    if (method === 'GET' && path.startsWith('/uploads/')) {
      return handleUploadGet(request, env, path.slice('/uploads/'.length));
    }

    // 每日壁纸（v1.2.3 新增）：服务端拉 Bing 每日图接口、当天图 302 直达微软 CDN，
    // 拉不到就回退站点自带本地图。放在 ASSETS 兜底之前、且不走公开接口的 ETag 缓存包装。
    if (path === '/api/wallpaper') {
      return handleWallpaper(url, env);
    }

    // 非 API 路径全部交给前端静态资源（SPA 回退在 wrangler.toml 的 assets 配置里）
    if (!path.startsWith('/api/') && path !== '/api') {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response('Nav-Item Workers API 已运行，前端资源未绑定。', { status: 200 });
    }

    try {
      await ensureInit(env);
      return await handleApi(request, env, url, path, method);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};

// 北京时间当前日期与 6 小时段（NASA 种子与 Bing 轮换共用）
function bjNow() {
  const parts = {};
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  for (const part of fmt.formatToParts(new Date())) parts[part.type] = part.value;
  return { date: parts.year + '-' + parts.month + '-' + parts.day, block: Math.floor(parseInt(parts.hour, 10) / 6) };
}

// Bing 轮换（v1.3.8，办法三）：Bing 一天只出一张新图，实测各国市场多数日子是同一张，
// 故按「今日各国图优先、撞图拿前几天补」凑齐 4 张不重样，对应北京 0/6/12/18 四个时段。
const BING_MARKETS = ['zh-CN', 'en-US', 'ja-JP', 'en-GB'];
async function fetchBingArchive(idx, mkt) {
  try {
    const r = await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=' + idx + '&n=1&mkt=' + mkt);
    if (!r.ok) return null;
    const d = await r.json();
    const im = d && d.images && d.images[0];
    return im && im.url ? im : null;
  } catch (e) { return null; }
}
async function fetchBingSlot() {
  const block = bjNow().block;
  const keyOf = (rel) => { const m = /OHR\.([A-Za-z0-9]+)_/.exec(rel); return m ? m[1] : rel; };
  // 今日中国版固定放在 6–12 点段（用户 2026-11-02 定）：先单独取它作锚，其余图按原优先序去重凑齐填 0/12/18 段
  const anchorIm = await fetchBingArchive(0, 'zh-CN');
  const anchor = anchorIm ? { key: keyOf(anchorIm.url), rel: anchorIm.url, title: anchorIm.title || anchorIm.copyright || '' } : null;
  const pool = [];
  for (let idx = 0; idx <= 6 && pool.length < 3; idx++) {
    for (const mkt of BING_MARKETS) {
      if (pool.length >= 3) break;
      const im = await fetchBingArchive(idx, mkt);
      if (!im) continue;
      const k = keyOf(im.url);
      if (anchor && k === anchor.key) continue;
      const ex = pool.find((e) => e.key === k);
      if (ex) { if (mkt === 'zh-CN' && im.title) ex.title = im.title; continue; }
      pool.push({ key: k, rel: im.url, title: im.title || im.copyright || '' });
    }
  }
  let slot = null;
  if (anchor) {
    if (block === 1) slot = anchor;
    else if (block === 0) slot = pool[0];
    else slot = pool[block - 1];
    slot = slot || anchor;
  } else {
    slot = pool[block] || pool[0] || null;
  }
  return slot ? { url: 'https://www.bing.com' + slot.rel, title: slot.title } : null;
}

// Bing 每日图：HPImageArchive 取最近一天列表的第一张（1920x1080），302 到图片真实地址；
// 跳转带 1 小时缓存（图每天才换一张，足够新），任何异常都跳本地兜底图，保证背景永不空白。
async function handleWallpaper(url, env) {
  // NASA 每日天文图（v1.2.7 新增，?src=nasa）：需 Secret NASA_API_KEY（api.nasa.gov 免费申请）；
  // 无 key、接口失败、当天是视频或占位图时回退前一天，再不行回退本地图，保证背景永不空白。
  if (url && url.searchParams.get('src') === 'nasa') {
    const img = await fetchNasaDailyImage(env);
    if (img) {
      return new Response(null, {
        status: 302,
        headers: { Location: img, 'Cache-Control': 'public, max-age=3600' },
      });
    }
    return new Response(null, { status: 302, headers: { Location: '/background.webp', 'Cache-Control': 'no-store' } });
  }
  try {
    const slot = await fetchBingSlot();
    if (slot) {
      return new Response(null, {
        status: 302,
        headers: { Location: slot.url, 'Cache-Control': 'public, max-age=3600' },
      });
    }
  } catch (e) { /* 落到兜底 */ }
  return new Response(null, { status: 302, headers: { Location: '/background.webp', 'Cache-Control': 'no-store' } });
}

// 美东日期串（formatToParts 拼装，不依赖 locale 默认格式）
function etDateString(d, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = {};
  for (const part of fmt.formatToParts(d)) parts[part.type] = part.value;
  return parts.year + '-' + parts.month + '-' + parts.day;
}

// NASA 每日图主通道（v1.3.0）：NASA 官方图库 images-api（免 key）按日期种子定主题与条目，全天同一张、每天轮换；
// APOD 官方接口（api.nasa.gov）从机房网络调用会被对方降级（返回占位图/超时，2026-11-02 实测），只作备用通道。
// NASA 每日图主通道（v1.3.0，v1.3.1 收紧为纯太空天文图）：NASA 官方图库 images-api（免 key）。
// 图库是全量影像库（含地面设施/人物纪实），故按望远镜天文主题词搜索后，再按标题/说明做内容过滤：
// 必须含天文词、且不含地面纪实词（火箭/发射/设施/人员等），保证挑出来的是太空图；按美东日期种子定主题与条目，全天同一张、每天轮换。
// APOD 官方接口（api.nasa.gov）从机房网络调用会被对方降级（返回占位图/超时，2026-11-02 实测），只作备用通道。
const NASA_THEMES = ['Hubble nebula', 'star forming region', 'spiral galaxy', 'star cluster', 'supernova remnant', 'planetary nebula', 'Andromeda galaxy', 'Orion nebula'];
const NASA_EXCLUDE = ['sounding rocket', 'launch', 'facility', 'scientist', 'engineer', 'astronaut', 'portrait', 'visits', 'visiting', ' tour', 'building', 'hangar', 'runway', 'ceremony', 'award', 'ground station', 'control room', 'clean room', 'assembly', 'technician', 'aircraft', 'antenna', 'observatory', 'press conference', 'briefing', 'history of', 'anniversary', 'poster', 'infographic', 'diagram', 'chart', 'logo', 'unveil', 'reveal'];
const NASA_REQUIRE = ['nebula', 'galaxy', 'star', 'supernova', 'cluster', 'hubble', 'webb', 'milky way', 'andromeda', 'orion', 'stellar', 'cosmos', 'universe', 'planet', 'jupiter', 'saturn', 'mars', 'moon', 'eclipse', 'comet', 'asteroid', 'black hole', 'telescope', 'astro'];
async function fetchNasaDailyImage(env) {
  try {
    // 种子按北京时间「日期+6小时段」（用户 2026-11-02 定）：0/6/12/18 点各换一张；APOD 备用通道仍按美东日期（NASA 按美东发布）
    const bj = bjNow();
    const seedStr = bj.date + '-' + bj.block;
    let h = 0;
    for (const ch of seedStr) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const theme = NASA_THEMES[h % NASA_THEMES.length];
    const r = await fetch('https://images-api.nasa.gov/search?q=' + encodeURIComponent(theme) + '&media_type=image&page_size=80');
    if (r.ok) {
      const d = await r.json();
      const items = (d && d.collection && d.collection.items) || [];
      const withImg = items.filter((it) => it.links && it.links[0] && it.links[0].href && !/\.svg($|\?)/i.test(it.links[0].href));
      const good = withImg.filter((it) => {
        const dd = (it.data && it.data[0]) || {};
        const t = ((dd.title || '') + ' ' + (dd.description || '')).toLowerCase();
        if (NASA_EXCLUDE.some((x) => t.includes(x))) return false;
        return NASA_REQUIRE.some((x) => t.includes(x));
      });
      const pool = good.length ? good : withImg;
      if (pool.length) {
        const raw = pool[h % pool.length].links[0].href;
        if (!raw.includes('~small')) return raw;
        // 变体可用性因图而异（如 PIA04227 只有 ~orig/~small、没有 ~medium，盲目升级会 403 破图）：逐个 HEAD 探测
        const medium = raw.replace('~small', '~medium');
        try { const hd = await fetch(medium, { method: 'HEAD' }); if (hd.ok) return medium; } catch (e) { /* 继续试原图 */ }
        const orig = raw.replace('~small', '~orig');
        try { const hd = await fetch(orig, { method: 'HEAD' }); if (hd.ok) return orig; } catch (e) { /* 落到 ~small */ }
        return raw;
      }
    }
  } catch (e) { /* 落到备用通道 */ }
  return fetchApodImage(env);
}

// 取 NASA APOD 当天图（按美东日期；当天不可用时回退前一天）
async function fetchApodImage(env) {
  const key = env && env.NASA_API_KEY;
  if (!key) return null;
  const etDate = etDateString;
  // 最多回溯 7 天找最近一张真图：NASA 偶尔连续几天只发占位图/视频（2026-11-01/02 实测即占位图）
  for (let back = 0; back <= 7; back++) {
    try {
      const date = etDate(new Date(Date.now() - back * 86400000));
      const r = await fetch('https://api.nasa.gov/planetary/apod?api_key=' + encodeURIComponent(key) + '&date=' + date);
      if (!r.ok) continue;
      const d = await r.json();
      const u = d && d.media_type === 'image' ? (d.hdurl || d.url) : null;
      if (u && !u.includes('nasa-logo')) return u;
    } catch (e) { /* 落到前一天/兜底 */ }
  }
  return null;
}

async function handleUploadGet(request, env, key) {
  if (!key) return new Response('404 Not Found', { status: 404 });
  if (env.BUCKET) {
    const obj = await env.BUCKET.get(key);
    if (obj) {
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set('etag', obj.httpEtag);
      headers.set('cache-control', 'public, max-age=86400');
      return new Response(obj.body, { headers });
    }
  }
  // 仓库自带的默认图标 R2 里没有时，回退到前端 public 里的同名文件
  if (key === 'default-favicon.png' && env.ASSETS) {
    return env.ASSETS.fetch(new Request(new URL('/default-favicon.png', request.url)));
  }
  return new Response('404 Not Found', { status: 404 });
}

async function handleApi(request, env, url, path, method) {
  const db = env.DB;
  const seg = path.split('/').filter(Boolean); // 例：['api','menus','3','submenus']

  // 健康检查（新增小接口，部署后探活使用，原版无此路由）
  if (method === 'GET' && path === '/api/health') {
    return json({ ok: true, version: VERSION });
  }

  // ----- 首屏聚合（v1.2.0 新增）：首页一次请求拿齐菜单+首栏卡片+广告+友链+版权 -----
  // 原先首页要串行发 menus→cards→ads→friends→copyright 五个请求、每个请求各付一次
  // 跨区 D1 往返；这里用一次 db.batch 在服务端一次取齐（卡片用子查询锁定排序第一的菜单）。
  if (method === 'GET' && path === '/api/bootstrap') {
    const [menuRes, cardRes, adRes, friendRes, settingRes, bgRes] = await db.batch([
      db.prepare(MENUS_JOIN_SQL),
      db.prepare('SELECT * FROM cards WHERE menu_id = (SELECT id FROM menus ORDER BY "order", id LIMIT 1) AND sub_menu_id IS NULL ORDER BY "order", id'),
      db.prepare('SELECT * FROM ads'),
      db.prepare('SELECT * FROM friends'),
      db.prepare(COPYRIGHT_KEYS_SQL),
      db.prepare(BG_KEYS_SQL),
    ]);
    return publicJson(request, {
      menus: assembleMenus(menuRes.results),
      cards: decorateCards(cardRes.results),
      ads: adRes.results,
      friends: friendRes.results,
      copyright: assembleCopyright(settingRes.results),
      background: assembleBackground(bgRes.results),
    });
  }

  // ----- 版权设置（新增：后台「版权所有」栏维护，首页/后台页脚读取渲染） -----
  if (path === '/api/copyright' && method === 'GET') {
    const { results } = await db.prepare(COPYRIGHT_KEYS_SQL).all();
    return publicJson(request, assembleCopyright(results));
  }
  if (path === '/api/copyright' && method === 'PUT') {
    const a = await requireAuth(request, env);
    if (a.error) return a.error;
    const b = await readBody(request);
    const pairs = [
      ['copyright_year', b.year],
      ['copyright_name', b.name],
      ['copyright_powered_text', b.poweredText],
      ['copyright_powered_url', b.poweredUrl],
    ];
    for (const [k, v] of pairs) {
      if (v === undefined) continue;
      await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
        .bind(k, String(v)).run();
    }
    return json({ message: '版权设置已保存' });
  }

  // ----- 背景设置（v1.2.4 新增：后台「背景设置」栏维护，首页背景读取渲染） -----
  if (path === '/api/background' && method === 'GET') {
    const { results } = await db.prepare(BG_KEYS_SQL).all();
    return publicJson(request, assembleBackground(results));
  }
  if (path === '/api/background' && method === 'PUT') {
    const a = await requireAuth(request, env);
    if (a.error) return a.error;
    const b = await readBody(request);
    if (b.mode !== undefined && !['bing', 'local', 'custom', 'nasa'].includes(b.mode)) {
      return json({ error: '背景模式无效' }, 400);
    }
    const pairs = [
      ['bg_mode', b.mode],
      ['bg_url', b.url],
    ];
    for (const [k, v] of pairs) {
      if (v === undefined) continue;
      await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
        .bind(k, String(v)).run();
    }
    return json({ message: '背景设置已保存' });
  }

  // 背景图收藏（v1.3.5 新增）：把 Bing/NASA 当前这张背景图抓下来存进图库（R2 的 img/ 目录），图库管理页里能看到
  if (path === '/api/background/collect' && method === 'POST') {
    const a = await requireAuth(request, env);
    if (a.error) return a.error;
    if (!env.BUCKET) return json({ error: 'R2 未绑定，无法保存到图库' }, 501);
    const b = await readBody(request);
    let imgUrl = null;
    let title = '';
    try {
      if (b.source === 'bing') {
        const slot = await fetchBingSlot();
        if (slot) { imgUrl = slot.url; title = slot.title || ''; }
      } else if (b.source === 'nasa') {
        imgUrl = await fetchNasaDailyImage(env);
        if (imgUrl) {
          const m = imgUrl.match(/images-assets\.nasa\.gov\/image\/([^/]+)\//);
          if (m) {
            try {
              const mr = await fetch('https://images-api.nasa.gov/search?nasa_id=' + encodeURIComponent(m[1]));
              const md = await mr.json();
              const it = md && md.collection && md.collection.items && md.collection.items[0];
              title = (it && it.data && it.data[0] && it.data[0].title) || '';
            } catch (e) { /* 标题拿不到不影响保存 */ }
          }
        }
      } else {
        return json({ error: 'source 只支持 bing 或 nasa' }, 400);
      }
    } catch (e) { /* 落到取图失败 */ }
    if (!imgUrl) return json({ error: '当前没有取到背景图，请稍后再试' }, 502);
    // 下载原图：带浏览器 UA（NASA 图床 CDN 会拦默认抓取 UA）；NASA 的 ~medium 失败时退 ~small 再试
    const dlHeaders = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', 'accept': 'image/*,*/*' };
    const candidates = [imgUrl];
    if (imgUrl.includes('~medium')) candidates.push(imgUrl.replace('~medium', '~small'));
    let fr = null;
    for (const u of candidates) {
      try {
        const r = await fetch(u, { headers: dlHeaders });
        if (r.ok) { fr = r; break; }
      } catch (e) { /* 换下一个候选 */ }
    }
    if (!fr) return json({ error: '背景图下载失败' }, 502);
    const ctype = (fr.headers.get('content-type') || '').split(';')[0].trim();
    if (!ctype.startsWith('image/')) return json({ error: '取到的不是图片' }, 502);
    const buf = await fr.arrayBuffer();
    if (buf.byteLength > 20 * 1024 * 1024) return json({ error: '图片超过 20MB' }, 400);
    const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
    const ext = extMap[ctype] || 'jpg';
    const bj = new Date(Date.now() + 8 * 3600 * 1000);
    const ymd = bj.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 8);
    const key = 'img/' + ymd + '/' + Date.now() + '-' + rand + '.' + ext;
    await env.BUCKET.put(key, buf, { httpMetadata: { contentType: ctype } });
    return json({ key, url: '/uploads/' + key, title });
  }

  // ----- 登录（原 routes/auth.js） -----
  if (method === 'POST' && path === '/api/login') {
    const { username, password } = await readBody(request);
    const user = await db.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
    if (!user) return json({ error: '用户名或密码错误' }, 401);
    const ok = await verifyPassword(password || '', user.password);
    if (!ok) return json({ error: '用户名或密码错误' }, 401);
    const lastLoginTime = user.last_login_time;
    const lastLoginIp = user.last_login_ip;
    await db.prepare('UPDATE users SET last_login_time=?, last_login_ip=? WHERE id=?')
      .bind(getShanghaiTime(), getClientIp(request), user.id).run();
    const token = await jwtSign({ id: user.id, username: user.username }, jwtSecret(env));
    return json({ token, lastLoginTime, lastLoginIp });
  }

  // ----- 菜单（原 routes/menu.js） -----
  if (seg[1] === 'menus') {
    if (method === 'GET' && seg.length === 2) {
      const pg = pageParams(url);
      if (pg) {
        const countRow = await db.prepare('SELECT COUNT(*) AS total FROM menus').first();
        const { results } = await db.prepare('SELECT * FROM menus ORDER BY "order" LIMIT ? OFFSET ?').bind(pg.size, pg.offset).all();
        return json({ total: countRow.total, page: pg.pageNum, pageSize: pg.size, data: results });
      }
      // v1.2.0：一条 LEFT JOIN 一次查完（原先逐菜单查子菜单，8 个菜单要 9 次串行查询）
      const { results: joinRows } = await db.prepare(MENUS_JOIN_SQL).all();
      return publicJson(request, assembleMenus(joinRows));
    }
    if (method === 'GET' && seg.length === 4 && seg[3] === 'submenus') {
      const { results } = await db.prepare('SELECT * FROM sub_menus WHERE parent_id = ? ORDER BY "order"').bind(seg[2]).all();
      return publicJson(request, results);
    }
    // 以下写操作需登录
    const a = await requireAuth(request, env);
    if (a.error) return a.error;
    if (method === 'POST' && seg.length === 2) {
      const { name, order } = await readBody(request);
      const r = await db.prepare('INSERT INTO menus (name, "order") VALUES (?, ?)').bind(name, order || 0).run();
      return json({ id: r.meta.last_row_id });
    }
    if (method === 'POST' && seg.length === 4 && seg[3] === 'submenus') {
      const { name, order } = await readBody(request);
      const r = await db.prepare('INSERT INTO sub_menus (parent_id, name, "order") VALUES (?, ?, ?)').bind(seg[2], name, order || 0).run();
      return json({ id: r.meta.last_row_id });
    }
    if (method === 'PUT' && seg.length === 4 && seg[2] === 'submenus') {
      const { name, order } = await readBody(request);
      const r = await db.prepare('UPDATE sub_menus SET name=?, "order"=? WHERE id=?').bind(name, order || 0, seg[3]).run();
      return json({ changed: r.meta.changes });
    }
    if (method === 'DELETE' && seg.length === 4 && seg[2] === 'submenus') {
      const r = await db.prepare('DELETE FROM sub_menus WHERE id=?').bind(seg[3]).run();
      return json({ deleted: r.meta.changes });
    }
    if (method === 'PUT' && seg.length === 3) {
      const { name, order } = await readBody(request);
      const r = await db.prepare('UPDATE menus SET name=?, "order"=? WHERE id=?').bind(name, order || 0, seg[2]).run();
      return json({ changed: r.meta.changes });
    }
    if (method === 'DELETE' && seg.length === 3) {
      const r = await db.prepare('DELETE FROM menus WHERE id=?').bind(seg[2]).run();
      return json({ deleted: r.meta.changes });
    }
  }

  // ----- 卡片（原 routes/card.js） -----
  if (seg[1] === 'cards') {
    if (method === 'GET' && seg.length === 3) {
      const subMenuId = url.searchParams.get('subMenuId');
      let rows;
      if (subMenuId) {
        rows = (await db.prepare('SELECT * FROM cards WHERE sub_menu_id = ? ORDER BY "order"').bind(subMenuId).all()).results;
      } else {
        rows = (await db.prepare('SELECT * FROM cards WHERE menu_id = ? AND sub_menu_id IS NULL ORDER BY "order"').bind(seg[2]).all()).results;
      }
      return publicJson(request, decorateCards(rows));
    }
    const a = await requireAuth(request, env);
    if (a.error) return a.error;
    if (method === 'POST' && seg.length === 2) {
      const b = await readBody(request);
      const r = await db.prepare('INSERT INTO cards (menu_id, sub_menu_id, title, url, logo_url, custom_logo_path, desc, "order") VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(nn(b.menu_id), b.sub_menu_id || null, nn(b.title), nn(b.url), nn(b.logo_url), nn(b.custom_logo_path), nn(b.desc), b.order || 0).run();
      return json({ id: r.meta.last_row_id });
    }
    if (method === 'PUT' && seg.length === 3) {
      const b = await readBody(request);
      const r = await db.prepare('UPDATE cards SET menu_id=?, sub_menu_id=?, title=?, url=?, logo_url=?, custom_logo_path=?, desc=?, "order"=? WHERE id=?')
        .bind(nn(b.menu_id), b.sub_menu_id || null, nn(b.title), nn(b.url), nn(b.logo_url), nn(b.custom_logo_path), nn(b.desc), b.order || 0, seg[2]).run();
      return json({ changed: r.meta.changes });
    }
    if (method === 'DELETE' && seg.length === 3) {
      const r = await db.prepare('DELETE FROM cards WHERE id=?').bind(seg[2]).run();
      return json({ deleted: r.meta.changes });
    }
  }

  // ----- 广告（原 routes/ad.js；注意原版 PUT 只更新 img/url，不更新 position，照旧） -----
  if (seg[1] === 'ads' && seg.length === 2 && method === 'GET') {
    const pg = pageParams(url);
    if (pg) {
      const countRow = await db.prepare('SELECT COUNT(*) AS total FROM ads').first();
      const { results } = await db.prepare('SELECT * FROM ads LIMIT ? OFFSET ?').bind(pg.size, pg.offset).all();
      return json({ total: countRow.total, page: pg.pageNum, pageSize: pg.size, data: results });
    }
    const { results } = await db.prepare('SELECT * FROM ads').all();
    return publicJson(request, results);
  }
  if (seg[1] === 'ads') {
    const a = await requireAuth(request, env);
    if (a.error) return a.error;
    if (method === 'POST' && seg.length === 2) {
      const { position, img, url: adUrl } = await readBody(request);
      const r = await db.prepare('INSERT INTO ads (position, img, url) VALUES (?, ?, ?)').bind(position, img, adUrl).run();
      return json({ id: r.meta.last_row_id });
    }
    if (method === 'PUT' && seg.length === 3) {
      const { img, url: adUrl } = await readBody(request);
      const r = await db.prepare('UPDATE ads SET img=?, url=? WHERE id=?').bind(img, adUrl, seg[2]).run();
      return json({ changed: r.meta.changes });
    }
    if (method === 'DELETE' && seg.length === 3) {
      const r = await db.prepare('DELETE FROM ads WHERE id=?').bind(seg[2]).run();
      return json({ deleted: r.meta.changes });
    }
  }

  // ----- 友链（原 routes/friend.js） -----
  if (seg[1] === 'friends' && seg.length === 2 && method === 'GET') {
    const pg = pageParams(url);
    if (pg) {
      const countRow = await db.prepare('SELECT COUNT(*) AS total FROM friends').first();
      const { results } = await db.prepare('SELECT * FROM friends LIMIT ? OFFSET ?').bind(pg.size, pg.offset).all();
      return json({ total: countRow.total, page: pg.pageNum, pageSize: pg.size, data: results });
    }
    const { results } = await db.prepare('SELECT * FROM friends').all();
    return publicJson(request, results);
  }
  if (seg[1] === 'friends') {
    const a = await requireAuth(request, env);
    if (a.error) return a.error;
    if (method === 'POST' && seg.length === 2) {
      const { title, url: fUrl, logo } = await readBody(request);
      const r = await db.prepare('INSERT INTO friends (title, url, logo) VALUES (?, ?, ?)').bind(title, fUrl, logo).run();
      return json({ id: r.meta.last_row_id });
    }
    if (method === 'PUT' && seg.length === 3) {
      const { title, url: fUrl, logo } = await readBody(request);
      const r = await db.prepare('UPDATE friends SET title=?, url=?, logo=? WHERE id=?').bind(title, fUrl, logo, seg[2]).run();
      return json({ changed: r.meta.changes });
    }
    if (method === 'DELETE' && seg.length === 3) {
      const r = await db.prepare('DELETE FROM friends WHERE id=?').bind(seg[2]).run();
      return json({ deleted: r.meta.changes });
    }
  }

  // ----- 用户（原 routes/user.js；报错字段是 message，与其他路由的 error 不同，照旧） -----
  if (seg[1] === 'users') {
    const a = await requireAuth(request, env);
    if (a.error) return a.error;
    if (method === 'GET' && seg.length === 3 && seg[2] === 'profile') {
      const user = await db.prepare('SELECT id, username FROM users WHERE id = ?').bind(a.user.id).first();
      if (!user) return json({ message: '用户不存在' }, 404);
      return json({ data: user });
    }
    if (method === 'GET' && seg.length === 3 && seg[2] === 'me') {
      const user = await db.prepare('SELECT id, username, last_login_time, last_login_ip FROM users WHERE id = ?').bind(a.user.id).first();
      if (!user) return json({ message: '用户不存在' }, 404);
      return json({ last_login_time: user.last_login_time, last_login_ip: user.last_login_ip });
    }
    if (method === 'PUT' && seg.length === 3 && seg[2] === 'password') {
      const { oldPassword, newPassword } = await readBody(request);
      if (!oldPassword || !newPassword) return json({ message: '请提供旧密码和新密码' }, 400);
      if (newPassword.length < 6) return json({ message: '新密码长度至少6位' }, 400);
      const user = await db.prepare('SELECT password FROM users WHERE id = ?').bind(a.user.id).first();
      if (!user) return json({ message: '用户不存在' }, 404);
      const valid = await verifyPassword(oldPassword, user.password);
      if (!valid) return json({ message: '旧密码错误' }, 400);
      await db.prepare('UPDATE users SET password = ? WHERE id = ?').bind(await hashPassword(newPassword), a.user.id).run();
      return json({ message: '密码修改成功' });
    }
    if (method === 'GET' && seg.length === 2) {
      const pg = pageParams(url);
      if (pg) {
        const countRow = await db.prepare('SELECT COUNT(*) AS total FROM users').first();
        const { results } = await db.prepare('SELECT id, username FROM users LIMIT ? OFFSET ?').bind(pg.size, pg.offset).all();
        return json({ total: countRow.total, page: pg.pageNum, pageSize: pg.size, data: results });
      }
      const { results } = await db.prepare('SELECT id, username FROM users').all();
      return json({ data: results });
    }
  }

  // ----- 上传（原 routes/upload.js：字段名 logo，文件名=时间戳+扩展名；存储由本地磁盘改为 R2） -----
  if (seg[1] === 'upload' && method === 'POST') {
    const a = await requireAuth(request, env);
    if (a.error) return a.error;
    if (!env.BUCKET) return json({ error: 'R2 未绑定，图片上传不可用' }, 501);
    const form = await request.formData();
    const file = form.get('logo');
    if (!file || typeof file === 'string') return json({ error: 'No file uploaded' }, 400);
    const dot = file.name.lastIndexOf('.');
    const ext = dot >= 0 ? file.name.slice(dot) : '';
    const filename = Date.now() + ext;
    await env.BUCKET.put(filename, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
    });
    return json({ filename, url: '/uploads/' + filename });
  }

  // ----- 图床（v1.2.6 新增）：上传/列表/删除；存 R2 的 img/日期/ 目录，直链仍走 /uploads/* -----
  if (seg[1] === 'img' && seg[2] === 'upload' && method === 'POST') {
    const a = await requireAuthOrKey(request, env);
    if (a.error) return a.error;
    if (!env.BUCKET) return json({ error: 'R2 未绑定，图床不可用' }, 501);
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return json({ error: '未收到文件（字段名 file）' }, 400);
    const dot = file.name.lastIndexOf('.');
    const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : '';
    if (!IMG_EXTS.includes(ext)) return json({ error: '只支持图片文件（png/jpg/gif/webp/svg/ico/avif/bmp）' }, 400);
    if (file.size > 20 * 1024 * 1024) return json({ error: '文件超过 20MB 上限' }, 400);
    const bj = new Date(Date.now() + 8 * 3600 * 1000);
    const ymd = bj.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 8);
    const key = 'img/' + ymd + '/' + Date.now() + '-' + rand + '.' + ext;
    await env.BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
    });
    const url = '/uploads/' + key;
    const fullUrl = new URL(url, request.url).href;
    return json({ key, url, fullUrl, markdown: '![](' + fullUrl + ')' });
  }
  if (seg[1] === 'img' && seg[2] === 'list' && method === 'GET') {
    const a = await requireAuthOrKey(request, env);
    if (a.error) return a.error;
    if (!env.BUCKET) return json({ error: 'R2 未绑定，图床不可用' }, 501);
    const cursor = url.searchParams.get('cursor') || undefined;
    const listed = await env.BUCKET.list({ limit: 200, cursor });
    const images = listed.objects.map((o) => ({
      key: o.key, size: o.size, uploaded: o.uploaded, url: '/uploads/' + o.key,
    }));
    images.sort((x, y) => String(y.uploaded).localeCompare(String(x.uploaded)));
    return json({ images, cursor: listed.truncated ? listed.cursor : null });
  }
  if (seg[1] === 'img' && seg[2] === 'delete' && method === 'DELETE') {
    const a = await requireAuthOrKey(request, env);
    if (a.error) return a.error;
    if (!env.BUCKET) return json({ error: 'R2 未绑定，图床不可用' }, 501);
    const key = url.searchParams.get('key') || '';
    if (!key) return json({ error: '缺少 key 参数' }, 400);
    await env.BUCKET.delete(key);
    return json({ message: '已删除', key });
  }

  return json({ error: 'Not Found' }, 404);
}
