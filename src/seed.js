// 默认种子数据：直接提取自原版 db.js（菜单 6 / 子菜单 7 / 卡片 60 / 友链 2），内容未改动。
// 首次启动且表为空时由 index.js 的 ensureInit() 写入 D1，行为与原版一致。
export const SEED = {
 "menus": [
  [
   "Home",
   1
  ],
  [
   "Ai Stuff",
   2
  ],
  [
   "Cloud",
   3
  ],
  [
   "Software",
   4
  ],
  [
   "Tools",
   5
  ],
  [
   "Other",
   6
  ]
 ],
 "subMenus": [
  {
   "parentMenu": "Ai Stuff",
   "name": "AI chat",
   "order": 1
  },
  {
   "parentMenu": "Ai Stuff",
   "name": "AI tools",
   "order": 2
  },
  {
   "parentMenu": "Tools",
   "name": "Dev Tools",
   "order": 1
  },
  {
   "parentMenu": "Software",
   "name": "Mac",
   "order": 1
  },
  {
   "parentMenu": "Software",
   "name": "iOS",
   "order": 2
  },
  {
   "parentMenu": "Software",
   "name": "Android",
   "order": 3
  },
  {
   "parentMenu": "Software",
   "name": "Windows",
   "order": 4
  }
 ],
 "cards": [
  {
   "menu": "Home",
   "title": "Baidu",
   "url": "https://www.baidu.com",
   "logo_url": "",
   "desc": "全球最大的中文搜索引擎"
  },
  {
   "menu": "Home",
   "title": "Youtube",
   "url": "https://www.youtube.com",
   "logo_url": "https://img.icons8.com/ios-filled/100/ff1d06/youtube-play.png",
   "desc": "全球最大的视频社区"
  },
  {
   "menu": "Home",
   "title": "Gmail",
   "url": "https://mail.google.com",
   "logo_url": "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico",
   "desc": ""
  },
  {
   "menu": "Home",
   "title": "GitHub",
   "url": "https://github.com",
   "logo_url": "",
   "desc": "全球最大的代码托管平台"
  },
  {
   "menu": "Home",
   "title": "ip.sb",
   "url": "https://ip.sb",
   "logo_url": "",
   "desc": "ip地址查询"
  },
  {
   "menu": "Home",
   "title": "Cloudflare",
   "url": "https://dash.cloudflare.com",
   "logo_url": "",
   "desc": "全球最大的cdn服务商"
  },
  {
   "menu": "Home",
   "title": "ChatGPT",
   "url": "https://chat.openai.com",
   "logo_url": "https://cdn.oaistatic.com/assets/favicon-eex17e9e.ico",
   "desc": "人工智能AI聊天机器人"
  },
  {
   "menu": "Home",
   "title": "Huggingface",
   "url": "https://huggingface.co",
   "logo_url": "",
   "desc": "全球最大的开源模型托管平台"
  },
  {
   "menu": "Home",
   "title": "ITDOG - 在线ping",
   "url": "https://www.itdog.cn/tcping",
   "logo_url": "",
   "desc": "在线tcping"
  },
  {
   "menu": "Home",
   "title": "Ping0",
   "url": "https://ping0.cc",
   "logo_url": "",
   "desc": "ip地址查询"
  },
  {
   "menu": "Home",
   "title": "浏览器指纹",
   "url": "https://www.browserscan.net/zh",
   "logo_url": "",
   "desc": "浏览器指纹查询"
  },
  {
   "menu": "Home",
   "title": "nezha面板",
   "url": "https://ssss.nyc.mn",
   "logo_url": "https://nezha.wiki/logo.png",
   "desc": "nezha面板"
  },
  {
   "menu": "Home",
   "title": "Api测试",
   "url": "https://hoppscotch.io",
   "logo_url": "",
   "desc": "在线api测试工具"
  },
  {
   "menu": "Home",
   "title": "域名检查",
   "url": "https://who.cx",
   "logo_url": "",
   "desc": "域名可用性查询"
  },
  {
   "menu": "Home",
   "title": "域名比价",
   "url": "https://www.whois.com",
   "logo_url": "",
   "desc": "域名价格比较"
  },
  {
   "menu": "Home",
   "title": "NodeSeek",
   "url": "https://www.nodeseek.com",
   "logo_url": "https://www.nodeseek.com/static/image/favicon/favicon-32x32.png",
   "desc": "主机论坛"
  },
  {
   "menu": "Home",
   "title": "Linux do",
   "url": "https://linux.do",
   "logo_url": "https://linux.do/uploads/default/optimized/3X/9/d/9dd49731091ce8656e94433a26a3ef36062b3994_2_32x32.png",
   "desc": "新的理想型社区"
  },
  {
   "menu": "Home",
   "title": "在线音乐",
   "url": "https://music.eooce.com",
   "logo_url": "https://p3.music.126.net/tBTNafgjNnTL1KlZMt7lVA==/18885211718935735.jpg",
   "desc": "在线音乐"
  },
  {
   "menu": "Home",
   "title": "在线电影",
   "url": "https://libretv.eooce.com",
   "logo_url": "https://img.icons8.com/color/240/cinema---v1.png",
   "desc": "在线电影"
  },
  {
   "menu": "Home",
   "title": "免费接码",
   "url": "https://www.smsonline.cloud/zh",
   "logo_url": "",
   "desc": "免费接收短信验证码"
  },
  {
   "menu": "Home",
   "title": "订阅转换",
   "url": "https://sublink.eooce.com",
   "logo_url": "https://img.icons8.com/color/96/link--v1.png",
   "desc": "最好用的订阅转换工具"
  },
  {
   "menu": "Home",
   "title": "webssh",
   "url": "https://ssh.eooce.com",
   "logo_url": "https://img.icons8.com/fluency/240/ssh.png",
   "desc": "最好用的webssh终端管理工具"
  },
  {
   "menu": "Home",
   "title": "文件快递柜",
   "url": "https://filebox.nnuu.nyc.mn",
   "logo_url": "https://img.icons8.com/nolan/256/document.png",
   "desc": "文件输出分享"
  },
  {
   "menu": "Home",
   "title": "真实地址生成",
   "url": "https://address.nnuu.nyc.mn",
   "logo_url": "https://static11.meiguodizhi.com/favicon.ico",
   "desc": "基于当前ip生成真实的地址"
  },
  {
   "menu": "Ai Stuff",
   "title": "ChatGPT",
   "url": "https://chat.openai.com",
   "logo_url": "https://cdn.oaistatic.com/assets/favicon-eex17e9e.ico",
   "desc": "OpenAI官方AI对话"
  },
  {
   "menu": "Ai Stuff",
   "title": "Deepseek",
   "url": "https://www.deepseek.com",
   "logo_url": "https://cdn.deepseek.com/chat/icon.png",
   "desc": "Deepseek AI搜索"
  },
  {
   "menu": "Ai Stuff",
   "title": "Claude",
   "url": "https://claude.ai",
   "logo_url": "https://img.icons8.com/fluency/240/claude-ai.png",
   "desc": "Anthropic Claude AI"
  },
  {
   "menu": "Ai Stuff",
   "title": "Google Gemini",
   "url": "https://gemini.google.com",
   "logo_url": "https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg",
   "desc": "Google Gemini大模型"
  },
  {
   "menu": "Ai Stuff",
   "title": "阿里千问",
   "url": "https://chat.qwenlm.ai",
   "logo_url": "https://g.alicdn.com/qwenweb/qwen-ai-fe/0.0.11/favicon.ico",
   "desc": "阿里云千问大模型"
  },
  {
   "menu": "Ai Stuff",
   "title": "Kimi",
   "url": "https://www.kimi.com",
   "logo_url": "",
   "desc": "月之暗面Moonshot AI"
  },
  {
   "subMenu": "AI chat",
   "title": "ChatGPT",
   "url": "https://chat.openai.com",
   "logo_url": "https://cdn.oaistatic.com/assets/favicon-eex17e9e.ico",
   "desc": "OpenAI官方AI对话"
  },
  {
   "subMenu": "AI chat",
   "title": "Deepseek",
   "url": "https://www.deepseek.com",
   "logo_url": "https://cdn.deepseek.com/chat/icon.png",
   "desc": "Deepseek AI搜索"
  },
  {
   "subMenu": "AI tools",
   "title": "ChatGPT",
   "url": "https://chat.openai.com",
   "logo_url": "https://cdn.oaistatic.com/assets/favicon-eex17e9e.ico",
   "desc": "OpenAI官方AI对话"
  },
  {
   "subMenu": "AI tools",
   "title": "Deepseek",
   "url": "https://www.deepseek.com",
   "logo_url": "https://cdn.deepseek.com/chat/icon.png",
   "desc": "Deepseek AI搜索"
  },
  {
   "menu": "Cloud",
   "title": "阿里云",
   "url": "https://www.aliyun.com",
   "logo_url": "https://img.alicdn.com/tfs/TB1_ZXuNcfpK1RjSZFOXXa6nFXa-32-32.ico",
   "desc": "阿里云官网"
  },
  {
   "menu": "Cloud",
   "title": "腾讯云",
   "url": "https://cloud.tencent.com",
   "logo_url": "",
   "desc": "腾讯云官网"
  },
  {
   "menu": "Cloud",
   "title": "甲骨文云",
   "url": "https://cloud.oracle.com",
   "logo_url": "",
   "desc": "Oracle Cloud"
  },
  {
   "menu": "Cloud",
   "title": "亚马逊云",
   "url": "https://aws.amazon.com",
   "logo_url": "https://img.icons8.com/color/144/amazon-web-services.png",
   "desc": "Amazon AWS"
  },
  {
   "menu": "Cloud",
   "title": "DigitalOcean",
   "url": "https://www.digitalocean.com",
   "logo_url": "https://www.digitalocean.com/_next/static/media/apple-touch-icon.d7edaa01.png",
   "desc": "DigitalOcean VPS"
  },
  {
   "menu": "Cloud",
   "title": "Vultr",
   "url": "https://www.vultr.com",
   "logo_url": "",
   "desc": "Vultr VPS"
  },
  {
   "menu": "Software",
   "title": "Hellowindows",
   "url": "https://hellowindows.cn",
   "logo_url": "https://hellowindows.cn/logo-s.png",
   "desc": "windows系统及office下载"
  },
  {
   "menu": "Software",
   "title": "奇迹秀",
   "url": "https://www.qijishow.com/down",
   "logo_url": "https://www.qijishow.com/img/ico.ico",
   "desc": "设计师的百宝箱"
  },
  {
   "menu": "Software",
   "title": "易破解",
   "url": "https://www.ypojie.com",
   "logo_url": "https://www.ypojie.com/favicon.ico",
   "desc": "精品windows软件"
  },
  {
   "menu": "Software",
   "title": "软件先锋",
   "url": "https://topcracked.com",
   "logo_url": "https://cdn.mac89.com/win_macxf_node/static/favicon.ico",
   "desc": "精品windows软件"
  },
  {
   "menu": "Software",
   "title": "Macwk",
   "url": "https://www.macwk.com",
   "logo_url": "https://www.macwk.com/favicon-32x32.ico",
   "desc": "精品Mac软件"
  },
  {
   "menu": "Software",
   "title": "Macsc",
   "url": "https://mac.macsc.com",
   "logo_url": "https://cdn.mac89.com/macsc_node/static/favicon.ico",
   "desc": ""
  },
  {
   "menu": "Tools",
   "title": "JSON工具",
   "url": "https://www.json.cn",
   "logo_url": "https://img.icons8.com/nolan/128/json.png",
   "desc": "JSON格式化/校验"
  },
  {
   "menu": "Tools",
   "title": "base64工具",
   "url": "https://www.qqxiuzi.cn/bianma/base64.htm",
   "logo_url": "https://cdn.base64decode.org/assets/images/b64-180.webp",
   "desc": "在线base64编码解码"
  },
  {
   "menu": "Tools",
   "title": "二维码生成",
   "url": "https://cli.im",
   "logo_url": "https://img.icons8.com/fluency/96/qr-code.png",
   "desc": "二维码生成工具"
  },
  {
   "menu": "Tools",
   "title": "JS混淆",
   "url": "https://obfuscator.io",
   "logo_url": "https://img.icons8.com/color/240/javascript--v1.png",
   "desc": "在线Javascript代码混淆"
  },
  {
   "menu": "Tools",
   "title": "Python混淆",
   "url": "https://freecodingtools.org/tools/obfuscator/python",
   "logo_url": "https://img.icons8.com/color/240/python--v1.png",
   "desc": "在线python代码混淆"
  },
  {
   "menu": "Tools",
   "title": "Remove.photos",
   "url": "https://remove.photos/zh-cn",
   "logo_url": "https://img.icons8.com/doodle/192/picture.png",
   "desc": "一键抠图"
  },
  {
   "subMenu": "Dev Tools",
   "title": "Uiverse",
   "url": "https://uiverse.io/elements",
   "logo_url": "https://img.icons8.com/fluency/96/web-design.png",
   "desc": "CSS动画和设计元素"
  },
  {
   "subMenu": "Dev Tools",
   "title": "Icons8",
   "url": "https://igoutu.cn/icons",
   "logo_url": "https://maxst.icons8.com/vue-static/landings/primary-landings/favs/icons8_fav_32×32.png",
   "desc": "免费图标和设计资源"
  },
  {
   "menu": "Other",
   "title": "Gmail",
   "url": "https://mail.google.com",
   "logo_url": "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico",
   "desc": "Google邮箱"
  },
  {
   "menu": "Other",
   "title": "Outlook",
   "url": "https://outlook.live.com",
   "logo_url": "https://img.icons8.com/color/256/ms-outlook.png",
   "desc": "微软Outlook邮箱"
  },
  {
   "menu": "Other",
   "title": "Proton Mail",
   "url": "https://account.proton.me",
   "logo_url": "https://account.proton.me/assets/apple-touch-icon-120x120.png",
   "desc": "安全加密邮箱"
  },
  {
   "menu": "Other",
   "title": "QQ邮箱",
   "url": "https://mail.qq.com",
   "logo_url": "https://mail.qq.com/zh_CN/htmledition/images/favicon/qqmail_favicon_96h.png",
   "desc": "腾讯QQ邮箱"
  },
  {
   "menu": "Other",
   "title": "雅虎邮箱",
   "url": "https://mail.yahoo.com",
   "logo_url": "https://img.icons8.com/color/240/yahoo--v2.png",
   "desc": "雅虎邮箱"
  },
  {
   "menu": "Other",
   "title": "10分钟临时邮箱",
   "url": "https://linshiyouxiang.net",
   "logo_url": "https://linshiyouxiang.net/static/index/zh/images/favicon.ico",
   "desc": "10分钟临时邮箱"
  }
 ],
 "friends": [
  [
   "Noodseek图床",
   "https://www.nodeimage.com",
   "https://www.nodeseek.com/static/image/favicon/favicon-32x32.png"
  ],
  [
   "Font Awesome",
   "https://fontawesome.com",
   "https://fontawesome.com/favicon.ico"
  ]
 ]
};
