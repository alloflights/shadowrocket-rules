# Shadowrocket 去广告与分流系统：v2.0 架构与维护规范 (Project Handoff Specification)

## 1. 核心架构升级（v2.0 单一事实源体系）

* **构建引擎**：`scripts/sync_architecture.js`（执行 `npm run build`）
  * 自动对齐 `Shadowrocket_LazyGroup_Merged.conf`、`Shadowrocket_AllInOne_Ultimate.conf` 与 `modules/adblock-ultimate.sgmodule` 的 `[General]`、`[Rule]`、`[Host]`、`[URL Rewrite]`、`[Script]` 与 `[MITM]`。
  * 自动扫描并剔除重复规则，消除 `REJECT` 与 `DIRECT` 前后阴影冲突（严禁封杀 `volces.com` 整域以免误伤豆包/火山引擎直连，仅拦截 `neptune-api.volces.com`）。
* **零打扰无感原则（Zero-Touch Silence）**：
  * 所有去广告与净化脚本严禁调用 `$notification.post` 弹出错误横幅；
  * 所有脚本必须具备空响应早退保护（`if (!$response || !$response.body) { $done({}); return; }`）与顶层 `try/catch` 兜底。

## 2. 重点攻克机制说明

1. **酷安（Coolapk）“去掉广告但空白广告页/卡片还在”根治方案**：
   * **破除 HTTP 304 缓存**：通过 `酷安_初始化请求`（`type=http-request`）剥离 `/v6/main/init` 请求中的 `If-None-Match` 与 `If-Modified-Since`，强制服务端返回 200 完整配置并由响应脚本递归置空 `V8_APP_EXTRA` 中的 `SplashAd.*` 与 `Ad.*` 参数，彻底阻止冷启动与切回后台时的开屏容器页面实例化。
   * **字符串与对象双轨 `extraData` 解析**：酷安真实响应中 `extraData` 常为序列化 JSON 字符串（同时伴随 `extraDataArr` 对象）。`coolapk.js` 同时解析两种形态，精准识别 GDT/JAD/GroMore/Pangle/Tanx 广告槽位。
   * **自底向上（Bottom-Up）空壳容器剥离**：先递归过滤子数组（`entities` / `rows` / `items`），若外层卡片容器原本包含子节点且过滤后变为空数组（`length === 0`），自动连同外层空壳容器一并移除，杜绝空白广告框残留。
2. **海外流媒体与社交平台去广告（YouTube / X / Spotify / Twitch / Reddit / Pixiv）**：
   * **X (Twitter)**：`modules/twitter.sgmodule` + `modules/scripts/twitter.js` 拦截 `ads-api.x.com` 等域名，并实时清洗 GraphQL（`HomeTimeline`、`TweetDetail`、`SearchTimeline`、`UserTweets`、`ExplorePage`）中的 `promoted-tweet`、`promotedMetadata` 与评论区推广回复，严格保留 `cursor-*` 分页游标。
   * **YouTube**：`modules/youtube.sgmodule` + `modules/scripts/youtube.js` + `twitter.js` 结合 Protobuf 二进制与 JSON 双引擎，拦截 `initplayback`/`oad` 贴片流、`adPlacements`、`playerAds` 与 `adSlots`。
