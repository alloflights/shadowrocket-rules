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
2. **海外核心服务（X / Twitter / YouTube）原生直通保障与去广告彻底剥离**：
   * **彻底剥离 X (Twitter) 去广告**：X/Twitter 官方客户端原生部署了强 SSL Pinning 证书锁定与严密的 GraphQL 加密签名机制。任何对 `ads-api.x.com` 等广告域名的 REJECT 阻断，或对 `x.com` 的 MITM 解密/脚本注入，都会导致客户端请求报错或陷入无限死循环加载（打不开推文、时间线无法刷新）。
   * **纯净代理直通（Zero-Interference Proxy）**：彻底移除 `modules/twitter.sgmodule` 与 `twitter.js` 脚本，禁止任何针对 Twitter 的 MITM 解密与 REJECT 规则。在核心配置中通过顶级直通规则（`DOMAIN-SUFFIX,x.com` / `twitter.com` / `twimg.com` / `t.co`）直接分流至对应代理（LazyGroup 分流至 `Twitter` 策略组，AllInOne 分流至 `PROXY`），确保原生客户端秒开且时间线刷新永不卡死。

