# Nav-Item Workers 版

把 [eooce/Nav-Item](https://github.com/eooce/Nav-Item)（Vue 3 + Express + SQLite 的个人导航站）移植到 **Cloudflare Workers** 的版本：单个 Worker 同时托管前端静态资源、`/api/*` 接口与图片文件，数据存 D1，图片存 R2（**可选，没有 R2 也能部署运行**）。不需要服务器、不需要单独部署后端，Cloudflare 免费额度内即可运行。

接口路径与返回格式与原版保持一致，前端源码基本未改，后台管理功能完整保留，并在此基础上增加了背景自动轮换、图库管理等功能。

## 文档

| 文档 | 内容 |
|---|---|
| [部署手册](docs/部署手册.md) | 从零部署的完整步骤：Dashboard 手动路线 + wrangler 命令行路线，**有 R2 / 无 R2 两种情况分开写明**，含验收清单与常见问题 |
| [配置参数](docs/配置参数.md) | 全部绑定与变量：DB / ASSETS / BUCKET、明文变量、各 Secret 的用途、是否必需、生成方法 |
| [项目架构](docs/项目架构.md) | 整体架构、请求流程、数据表、关键机制（鉴权、背景解析、图库、缓存） |

## 功能

- **导航首页**：栏目/子栏目切换、卡片网格、聚合搜索（Google / 百度 / Bing / GitHub / 站内）、左右广告位、友情链接
- **后台管理**（`/admin`）：栏目、卡片、广告、友链、图库、版权、背景、用户共八个管理页
- **背景自动轮换**（后台「背景设置」四选一）：
  - **Bing 每日图**：Bing 官方一天只出一张，本版按北京时间分 4 个时段（0/6/12/18 点）轮换——优先用各国市场（中/美/日/英）的今日图、按图去重，撞图时拿前几天的补位；今日中国版固定在 6–12 点段
  - **NASA 每日图**：NASA 官方图库按「日期+时段」选图，同样 6 小时一换，只收录太空天文类内容（地面/发布会类已过滤）；APOD 接口作备用通道
  - **本地图**：站点自带 `background.webp`
  - **自定义图片**：填任意图片地址
- **一键收藏背景图**：背景设置页有「Bing / NASA 每日图保存图库」按钮，看到喜欢的背景可直接把原图存进自己的图库
- **图库管理**：后台可拖拽上传图片、复制直链/Markdown、删除；另提供 API 接口（`X-API-Key` 鉴权）供其它程序当图床调用（需 R2）
- **版权设置**：页脚「Copyright © 年份 主体 | Powered by 文案」在后台维护，链接可点、悬停高亮
- **登录鉴权**：JWT（HS256，2 小时有效）；密码 PBKDF2-SHA256（10 万次迭代）存储
- **首启自初始化**：首次请求自动建表并播种默认数据（菜单/卡片/友链）与默认设置，开箱即用

## R2 是可选的

没有 R2（或不想开通）完全可以部署：站点、后台、背景轮换都正常，只有涉及图片文件的三个功能会返回明确的「R2 未绑定」提示而不可用——图片上传、图库管理、背景图收藏。卡片/广告的图标直接填外链图片地址即可，不受影响。详见 [部署手册](docs/部署手册.md) 的两条路线与 [配置参数](docs/配置参数.md)。

## 与原版的差异（均为 Workers 平台限制所迫）

| 原版 | Workers 版 | 说明 |
|---|---|---|
| Express `app.listen` 常驻服务 | Worker `fetch` 入口 | 路由按原路径复刻 |
| sqlite3 本地文件 | D1 | 表结构基本原样，另加 `settings` 表存站点设置 |
| bcrypt 原生模块 | WebCrypto PBKDF2-SHA256 | 密码哈希自洽，登录/改密逻辑不变 |
| jsonwebtoken | WebCrypto HMAC 自签 JWT | 有效期与原版一致 |
| multer 写本地磁盘 | R2 对象存储 | 文件名规则不变（时间戳+扩展名） |
| express.static 托管前端 | Workers Assets（ASSETS 绑定） | SPA 回退由 assets 配置处理 |

另外两处有意改动：原版上传接口漏挂登录鉴权，本版补上（前端本来就带 token，不受影响）；新增 `GET /api/health` 用于探活。

## 性能设计

- `/api/menus` 用一条 LEFT JOIN 一次查完菜单+子菜单（原版是逐栏目查询）
- 首页走 `GET /api/bootstrap`：一次请求、一次批量查询拿齐菜单+首栏卡片+广告+友链+版权+背景设置，失败自动回退逐个请求
- 初始化带 `schema_version` 标记快路径，热请求只多一次轻查询
- 公开 GET 接口带 ETag 与短缓存（`max-age=30, s-maxage=120`），后台请求自动绕缓存读最新数据
- 壁纸接口 302 跳转带 1 小时缓存，前端请求地址带「日期+时段」参数，跨时段自动穿透缓存换图
- 提示：D1 是单主数据库，创建时尽量选离主要访客近的区域（`wrangler d1 create --location`），延迟差别明显

## 项目结构

```
nav-item-workers/
├── README.md
├── docs/
│   ├── 部署手册.md        从零部署全流程（两条路线 × 有无 R2）
│   ├── 配置参数.md        绑定与变量全表
│   └── 项目架构.md        架构与关键机制
├── src/
│   ├── index.js          Worker 主源码（路由、鉴权、D1、背景解析、图库、缓存）
│   └── seed.js           首启播种的默认数据（原版演示数据）
├── schema.sql            建表 SQL（与代码内初始化一致，供手动建表参考）
├── wrangler.toml         配置模板（占位符换成自己的资源 id；R2 段默认注释）
├── .dev.vars.example     本地开发环境变量示例（复制为 .dev.vars 使用，勿提交）
├── web/                  前端（Vue 3 + Vite）
│   ├── src/
│   │   ├── api.js        接口层
│   │   ├── components/   MenuBar / CardGrid / CopyrightFooter
│   │   └── views/        Home、Admin 与各管理页
│   └── public/           背景图、默认图标等静态文件
└── tests/
    └── api-test.py       本地接口回归测试（38 项；无 R2 时上传项以 501 判定通过）
```

## 快速开始

```bash
# 1. 构建前端
cd web && npm install && npm run build && cd ..

# 2. 创建 D1 并把 database_id 填进 wrangler.toml
npx wrangler d1 create nav-item-workers-db

# 3. 设置必需的 Secret（管理员密码、JWT 密钥）
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put JWT_SECRET

# 4. 部署
npx wrangler deploy
```

完整步骤（含 R2 开通与跳过、Dashboard 手动部署、验收方法）见 [部署手册](docs/部署手册.md)。

## 本地开发与测试

```bash
cp .dev.vars.example .dev.vars   # 填本地测试用的密码/密钥
npx wrangler dev --port 8791     # 本地启动（D1/R2 为本地模拟）
python3 tests/api-test.py        # 另一个终端跑回归测试（38 项）
```

注意：测试脚本最后一项会把本地管理员密码改为 `newpass-2026`，之后本地登录用新密码或删 `.wrangler` 重开干净实例。

## 致谢

原项目 [eooce/Nav-Item](https://github.com/eooce/Nav-Item)。本版为运行环境移植与功能扩展，默认版权信息（天诚导航网站 / CNLiang）为移植者站点设置，可在后台「版权所有」栏自行修改。
