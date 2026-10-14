# Shadowrocket Rules & Modules (iPhone 零打扰无感去广告与分流系统 v2.0)

为 iPhone 量身定制的 Shadowrocket 终极无感去广告模块、海内外全流媒体净化与高精度代理配置体系。

## 核心架构特性

1. **单一事实源 (Single Source of Truth) 编译架构**：通过 `scripts/sync_architecture.js`（`npm run build`）一键编译同步 `Shadowrocket_LazyGroup_Merged.conf`、`Shadowrocket_AllInOne_Ultimate.conf` 与 `modules/adblock-ultimate.sgmodule`，彻底杜绝多文件漏改、规则重复与策略冲突。
2. **100% 零弹窗静默无感运行**：全量净化脚本移除一切 `$notification.post` 报错横幅与高频控制台日志，内置完整 `try/catch` 沙盒保护与空响应秒退机制。
3. **酷安“空白广告框/残留开屏页”彻底根治**：
   * 拦截 `/v6/main/init` 的 `If-None-Match` / `If-Modified-Since` 304 缓存校验头，强制下发并抹平 `V8_APP_EXTRA` 中全部 `SplashAd.*` 与 `Ad.*` 参数，从根源阻止冷启动开屏页与后台切回热启动唤醒页实例化。
   * 双轨解析字符串型 `extraData` 与对象型 `extraDataArr`，结合自底向上（Bottom-Up）空壳容器剔除算法，彻底消灭因网络层拦截导致的空白广告占位框与半屏礼盒壳。
4. **海内外流媒体与社交平台全覆盖**：除国内主流 App 外，深度集成 **YouTube / YouTube Music**（Protobuf + JSON 双引擎 + 贴片流拦截）、**X (Twitter)**（GraphQL 时间线推广推文、评论区插播广告、热搜买量词条剥离）、**Spotify / Twitch / Reddit / Pixiv** 去广告。

## 方案选择与安装指引

### 方案 A：懒鱼策略组集成定制版（推荐主力配置）
集成 AI 独立专线锁区（OpenAI / Claude / Gemini / MetaAI）、本机全量 App 分流与全套无感去广告：
```text
https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Shadowrocket_LazyGroup_Merged.conf
```

### 方案 B：大一统完整独立配置 (All-in-One Ultimate)
单一配置搞定海外分流、国内直连、金融政务豁免与全量去广告：
```text
https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Shadowrocket_AllInOne_Ultimate.conf
```

### 方案 C：按需挂载独立增强模块 (Modules)

| 模块名称 | 功能说明 | 模块安装链接 |
| :--- | :--- | :--- |
| **终极去广告全能模块** | 整合国内外全联盟 SDK 封杀、各大国内 App 与 YouTube/X 海外流媒体去广告 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/adblock-ultimate.sgmodule` |
| **酷安深度无感净化** | 破除 304 缓存残留、根治空白开屏页与信息流/详情页/评论区空白广告容器 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/coolapk.sgmodule` |
| **X (Twitter) & 海外流媒体净化** | 剥离 X 时间线 Promoted 推文、评论区插播广告与热搜推广，拦截 Spotify/Reddit/Pixiv 广告 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/twitter.sgmodule` |
| **YouTube 深度去广告增强版** | Protobuf + JSON 双引擎净化首页/播放页广告，拦截贴片流与 DoubleClick | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/youtube.sgmodule` |
| **百度网盘极速净化** | 0.1ms 本地 Mock 秒开，根治 5s 倒计时白屏与本地缓存回退，清空短剧与福利卡片 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/baidunetdisk.sgmodule` |
| **完美世界电竞净化** | 本地 Mock 开屏秒开，剥离社区、赛事、资讯信息流推广与商业横幅弹窗 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/pwesports.sgmodule` |
| **知乎深度净化** | 拦截 `ad-style-service`、`feed-root` 聚合流、关注流、热榜与回答列表商业卡片 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/zhihu.sgmodule` |
| **全球主流 AI 智能体分流** | 精准分流 OpenAI、Claude、Gemini、Meta Muse、Grok、Perplexity、Cursor，国内 AI 直连 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/ai-services.sgmodule` |
| **全网外链直接跳转** | 自动绕过知乎/CSDN/简书/掘金/微博/贴吧/QQ/少数派/Gitee/语雀安全确认页，直出 302 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/direct-link.sgmodule` |
| **Safari 移动纯净浏览** | 屏蔽“打开App查看全文”遮罩、自动展开全文、解除复制限制与 Scheme 强跳劫持 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/safari-clean.sgmodule` |

## 工程构建与自动化验证

```bash
# 一键编译同步全部主配置与聚合模块
npm run build

# 运行全量 AST 语法、脚本沙盒、零弹窗与跨文件一致性验证
npm test
```
