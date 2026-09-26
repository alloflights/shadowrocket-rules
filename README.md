# Shadowrocket Rules & Modules (iPhone 终极去广告与分流系统)

为 iPhone 量身定制的 Shadowrocket 终极去广告模块、精细化分流策略与高可用代理配置库。

---

## 🌟 核心特性与架构

1. **国内极速 CDN 加速**：所有 JavaScript 解包净化脚本 100% 托管于国内直连无阻的 jsDelivr CDN，彻底根除因 GFW 阻断 `raw.githubusercontent.com` 导致的脚本下载超时、静默失效问题。
2. **全联盟 SDK 深度封杀**：内置穿山甲 (Pangolin)、优量汇 (GDT)、百青藤 (MobAds)、快手联盟 (Kwai)、西柚 (Sigmob)、TopOn、掌驭及 AWAvenue 900+ 聚合广告域名，阻断摇一摇开屏跳转与跨应用行为追踪。
3. **HTTPDNS 探针阻断**：严厉阻断百度、阿里、腾讯等内置 HTTPDNS 直连解析，杜绝 App 绕过本地 MITM 与 URL 重写。
4. **头部 App 深度脚本解包**：支持 JSON 与 Protobuf 双引擎二进制解包，实现开屏秒开、信息流无商业推广、无水印原图/实况下载。

---

## 📱 方案选择与安装指引

### 【方案 A：全能模块一键挂载（强烈推荐，基座解耦）】
如果你正在使用 `懒鱼策略组 (Shadowrocket_LazyGroup_Merged.conf)` 或其他已有底模配置，**无需修改你的底模文件**，直接挂载终极模块即可：

1. 打开 **Shadowrocket** -> 底栏 **配置** -> 滑动到 **模块 (Modules)** -> 点击右上角 **`+`**。
2. 粘贴模块链接并安装：
   ```text
   https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/adblock-ultimate.sgmodule
   ```
3. 勾选启用该模块即可。

---

### 【方案 B：大一统完整独立配置 (All-in-One Ultimate)】
如果你希望一个配置搞定全部海外分流、国内直连、Gemini专线与全部去广告，可直接导入此完整配置：

- **订阅/导入链接**：
  ```text
  https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Shadowrocket_AllInOne_Ultimate.conf
  ```

---

### 【方案 C：高阶体验与无感自动化模块（按需即装即用）】

除了系统级广告拦截外，针对全网外链拦截跳转、短视频无水印下载、每日资产自动签到与 Safari 纯净浏览，提供即装即用的独立增强模块：

| 增强功能模块 | 模块功能说明 | Shadowrocket 模块安装链接 |
| :--- | :--- | :--- |
| **全球主流 AI 与智能体生态分流** | 精准分流 Meta Muse 智能体、OpenAI/ChatGPT、Claude、Gemini、Grok、Perplexity、Cursor、Suno、Midjourney 及全网主流 Agent，国内 AI 严格直连免风控 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/ai-services.sgmodule` |
| **全球 Top 500 常用海外应用与网站极速分流** | 收录全球 Top 500 核心资讯、科技媒体、跨国差旅、生命科学学术科研 (Rosalind)、开发者原生云生态及海外法定 TLD，彻底杜绝境外未知流量落入直连导致的白屏与打不开 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/overseas-top500.sgmodule` |
| **全网外链直接跳转** | 自动绕过知乎/CSDN/简书/掘金/微博/贴吧/QQ/少数派/Gitee/语雀安全跳转确认页，0.05ms 本地直出 302 重定向 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/direct-link.sgmodule` |
| **TikTok 免拔卡原画直存** | 原生免拔卡换区(美区)，解除作者保存限制，视频无水印 1080P 下载与信息流净化 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/tiktok.sgmodule` |
| **BoxJs 资产签到工作台** | 运行在小火箭内的无感自动化工作台，Safari 访问 `http://boxjs.com` 即可管理会话与每日资产自动签到 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/boxjs.sgmodule` |
| **Safari 移动纯净浏览** | 屏蔽“打开App/前往客户端”遮罩霸屏、百度搜索热议软文、强制展开全文、App引导横幅 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/safari-clean.sgmodule` |

> [!IMPORTANT]
> **关于国内抖音（Douyin）无水印与评论区正常的关键说明**：
> 抖音国内版客户端内置了强效的 SSL Pinning 证书绑定，任何代理工具对其核心接口（`amemv.com`）开启中间人解密（MITM）都会导致评论区、关注流或刷新异常中断。为确保日常使用体验零损伤，抖音去水印推荐使用免解密的 **iOS 原生快捷指令**（在分享菜单中 1 秒提取原画存相册），保证 App 评论区与通信 100% 顺畅。

---

## 🎯 适配与净化应用清单

| 应用名称 | 净化范围与效果 | 技术实现方案 |
| :--- | :--- | :--- |
| **百度贴吧** | 开屏广告、首页推荐流伪装广告贴、吧内商业推广、直播推荐 | JSON + Protobuf 双引擎二进制解包 |
| **小红书** | 开屏广告、瀑布流商业卡片、去水印原画质图片与LivePhoto保存 | JSON 解包 + 水印配置拦截 |
| **哔哩哔哩** | 开屏秒开、首页推荐流广告、动态列表商业卡片、播放页UP主带货广告 | JSON + gRPC Protobuf 双引擎 |
| **知乎** | 开屏广告、推荐流商业推广卡片、回答列表带货回答与右下角活动浮窗 | JSON 数据流过滤 + 商业 API 拦截 |
| **微博** | 开屏实时广告、时间线营销广告、关注流卡片、搜索发现流广告、签到浮窗 | 核心净化脚本 + 预加载阻断 |
| **高德地图** | 开屏广告、首页卡片、搜索框商业热词、路线规划推广、导航结束页打车/福利弹窗 | AMDC 调度改写 + FAAS 数据过滤 |
| **网易云音乐** | 开屏广告、发现页/推荐页商业推广、评论区插入广告、侧栏VIP推广 | 墨鱼核心脚本 + 推广 API 拦截 |
| **起点读书** | 开屏广告、每日导读强制弹窗、活动Tab、书架右下角浮窗及福利推广 | Argus API 劫持过滤 |
| **喜马拉雅** | 开屏广告、首页轮播广告、播放页直播与动态推广、我的页面营销角标 | 动态流过滤 + 直播流拦截 |
| **酷安** | 开屏广告、首页与信息流推广、详情页赞助卡片、评论区广告、搜索热词 | 数据流解析过滤 + 商业热词拦截 |
| **百度网盘** | 开屏广告、摇一摇跳转第三方、横幅推广、福利弹窗、首页短剧与信息流推广 | URL Rewrite (reject-dict / reject-200) |
| **闲鱼** | 开屏广告、首页 Banner 推广流、营销浮窗与弹窗 | mtop 接口定向重写 (reject-dict) |
| **抖音** | 开屏广告、穿山甲追踪打点、视频内小黄车与带货橱窗、直播弹窗 | snssdk 广告接口重写与域名阻断 |
| **虎扑** | 开屏广告、下拉刷新广告流、帖子详情商业推广卡片及广告图片 | 接口阻断 + 推广图片屏蔽 |
| **YouTube** | 首页瀑布流推荐广告、视频播放页下方推荐位赞助广告 | Protobuf 二进制解包过滤 |
| **全网通用App** | 穿山甲、优量汇、百青藤、快手联盟、西柚Sigmob、TopOn、掌驭等摇一摇跳转 | AWAvenue + SDK 域名级全网拦截 |

---

## ⚠️ 关键操作注意事项（解决“广告依然出现”的真实根因）

1. **必须开启 HTTPS 解密 (MITM)**：
   - 进入 Shadowrocket -> 配置 -> 点击当前激活配置后的 `(i)` 图标 -> **HTTPS 解密** -> 开启开关。
   - 首次使用需生成 CA 证书 -> 安装证书 -> 前往 iPhone **设置 > 通用 > 关于本机 > 证书信任设置** -> 开启对应证书的 **完全信任**。
2. **清除 App 本地预存开屏广告（沙盒缓存效应）**：
   - 现代各大 App（如微博、知乎、B站、高德等）会在**前一天晚上或上一次打开时，提前静默下载未来 24 小时的开屏广告素材**存入手机沙盒（`Documents/Caches`）。
   - 安装新规则后，由于读的是本地磁盘缓存，开屏可能仍会出现 1~2 次。
   - **解决办法**：双击 Home 或从底部向上轻扫后台上滑**彻底强制关闭该 App**，重新打开 1~2 次；让本地沙盒内的旧缓存自然过期耗尽，且后续所有广告获取网络请求均被小火箭阻断，开屏广告即可永久消失。
3. **微信朋友圈广告的技术边界**：
   - 微信朋友圈采用腾讯私有 `MMTLS` 协议加密，非标准 HTTPS，网络代理工具无法中间人解密，强行解密会导致微信断网或触发安全风控。当前全网公开方案均遵循不解密微信的原则。
