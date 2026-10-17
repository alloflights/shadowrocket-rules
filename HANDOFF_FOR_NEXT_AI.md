# 维护说明（v3）

## 原则
0. **分流与去广告分离**：两个 `.conf` 只做分流（不得出现 REJECT 规则、[URL Rewrite]、[Script]、[MITM]）；去广告全部在 `modules/adblock-ultimate.sgmodule`（由 `src/rules/10-adblock.list` + `src/apps/*.js` 生成）。测试会强制检查。
1. **只改 `src/` 和 `modules/scripts/`**，然后 `npm run build && npm test`。两个 `.conf` 与生成的模块都是产物，手改会被覆盖，`npm test` 也会报“产物过期”。
2. **Apple 原生服务永远最先匹配、不解密、不拒绝**（`src/rules/00-protect.list` + `skip-proxy` / `always-real-ip` / `tun-excluded-routes`）。
3. **MITM 只写精确主机名**，不解密银行 / 支付 / 运营商 / 大 CDN，也不写 `*.qq.com`、`*.taobao.com` 这类整站通配。每个 MITM 主机会自动生成 `UDP/443 → REJECT` 规则，迫使 App 用 TCP（否则 QUIC 会绕过重写与脚本）；`block-quic=all-proxy` 只管走代理的连接，管不到直连 App。
4. **不要用宽泛 REJECT**（如 `gtimg.cn`、`umeng.com`、`bytegecko.com`、京东 / 淘宝联盟跳转域名），测试里有黑名单。
5. 脚本：只按明确的广告字段删除，任何异常都 `$done({})` 原样放行；`timeout=10`（微博 30），`max-size` ≤ 5MB，禁止 `-1`。

## 新增 / 修改一个 App
在 `src/apps/<id>.js` 导出：
```js
{ id, name, desc, rules: [], rewrites: [], scripts: [{ name, type: 'request'|'response', pattern, script, maxSize, binary, timeout }], mitm: [] }
```
构建会把它写进 `modules/adblock-ultimate.sgmodule` 和 `modules/<id>.sgmodule`（`moduleFile: false` 则只进全量模块）。

## 已知根因（别再走回头路）
- **酷安开屏要点“跳过”**：酷安自营开屏 = `/v6/main/init` 返回的第一张 `entityTemplate=imageCard`。只拦图片会得到“空白开屏 + 跳过”。正确做法：删除 imageCard，并把配置卡（entityId 6390）的 `SplashAd.Type=""`、`SplashAd.timeout="0"`、`SplashAd.Expires=9999999999`、`SplashAd.onResume="0"`；请求阶段去掉 `If-None-Match`/`If-Modified-Since`。不要拦 `image.coolapk.com`。
- **闲鱼去开屏失效**：闲鱼经阿里 AMDC 调度走 spdy/xQUIC，请求不经过 HTTPS 解密。必须保留规则
  `AND,((URL-REGEX,"^http:\/\/.+\/amdc\/mobileDispatch"),(USER-AGENT,"%E9%97%B2%E9%B1%BC*")),REJECT`，
  开屏接口是 `mtop.taobao.idlecommerce.splash.ads`，首页是 `mtop.taobao.idlehome.home.nextfresh`。改完需重装 App 才能清掉缓存开屏。
- 高德同理（UA `AMapiPhone*`）；不要在 AMDC 上用 http-response 脚本改 header（无效）。

## 路由（分流配置）
`00 保护 → AI → 学术 / 海外 / 开发 / 媒体 / TLD → 金融 / 邮箱直连 → 服务规则集 → 国内 → China/Global 规则集 → GEOIP,CN,DIRECT → FINAL,漏网之鱼(默认 PROXY)`。
`GEOIP,CN` 不带 `no-resolve`：未命中规则的冷门国内域名解析到大陆 IP 时仍直连。

去广告模块的规则顺序：`QUIC 回落 → AWAvenue → 广告联盟 → App 专项`。Shadowrocket 中模块规则先于配置规则匹配，所以模块里绝不能拒绝 Apple 核心域名（测试已覆盖）。
