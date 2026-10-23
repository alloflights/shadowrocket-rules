# 维护说明（v3）

## v3.3.5：Shadowrocket 应用兼容修复
- `src/shadowrocket.js` 只在 SR 构建应用：`adapt()` 派生 App 覆盖，不修改 `src/apps` 源对象；`guardRules()` / `realIP()` 保护原生微信 DNS 和 QQ / 微信共用媒体；`filterAdRules()` 只移除五条已替代误拦截，保留 Loon 共享广告源。
- `routing()` 同时将已返回 403 的 DouYin jsDelivr 链接换成 GitHub raw；不要为了 SR 变更修改 Loon 基线。
- `zhihu-sr.js`、`xiaohongshu-sr.js`、`goofish-sr.js`、`ali-splash-sr.js` 为新分叉，Loon 继续引用原脚本。原文件必须保持不变，除非用户另行授权维护 Loon。
- QQ / 微信不再封共享素材 CDN；保留 GDT 等明确广告域。主配置和聚合模块都必须有前置保护，独立微信静态模块也必须同步；不允许通过全站 skip-proxy、禁用公众号 MITM 或关闭 STUN 隐私机制实现“加速”。
- 淘宝的三条 jq 替换为专用响应脚本，不能同时执行 jq 和 JS。视频查询只延续 guide-acs 原作用域，不扩展到普通商品视频；交易 / 聊天不接新脚本。闲鱼开屏保留成功信封，条件缓存只在已限定的开屏端点处理。未知结构和错误响应放行，不能声称离线缓存广告已被清除。
- 小红书评论接口和媒体类型依据 README 中固定版本参考，独立实现；不修改作者标识，不删除签名参数，不维护跨笔记评论媒体缓存。烘焙水印无法在没有原图时还原，不承诺全版本。
- 知乎空追踪字段与通用槽位不作为广告证据，正常问题附件 / 导航和分页必须保留；明确商业标记、SDK / MCN / 商品广告仍过滤。未知 commercial_api 不清空，分支匹配不读查询参数。
- `tests/app-fixes.js` 新增合成行为回归；全量模块完整性按 SR 派生单元检查，Loon 按原始单元计数，不再要求两个客户端脚本数量相同。当前 816 项通过，43 个公开规则源可用；不代表用户真机已验证。


## v3.3.4：最新决定——Shadowrocket Apple 一律 DIRECT
- `src/apple.js` 为 SR 专用保护来源：所有 Apple 服务包括 Developer / WWDC 均直连，不再有代理例外；历史 v3.3.2 的反向旁路修复策略已被本次用户决定覆盖。
- `confRules()` 默认施加 Apple 补丁，`appleProtection: false` 仅用于测试 Loon 的既有共享基线，不用于 SR 产物。Loon 产物保持不变，不能再宣传两端 Apple 策略完全一致。
- 基础服务使用显式 DIRECT + real IP；Apple_Domain 完整域名集补充其它 Apple 域名；Apple.list 也固定 DIRECT。不要恢复可切换到 PROXY 的苹果策略组。
- `apple.guardRules()` 也置于三个聚合去广告模块最前，以免模块先于主配置抢先拒绝；全量模块附加 Apple MITM 根域及子域排除。
- 17/8 和 *.apple.com 恢复旁路，增加 IPv6 ULA / 回环旁路；不以全网端口直连替代本地网络保护。不改动本轮无关的 STUN / 隐私设置。
- `tests/apple-services.js` 和 `tests/fixtures/apple-services.json` 必须验证 DIRECT 本身，不能只接受某个策略组“默认直连”。Developer 在 app-routing.json 的 expect 为 DIRECT，loonExpect 保留 Loon 原基线 PROXY。

## v3.3.3：Shadowrocket 全组件维护
- `meta.shadowrocketVersion` 同时用于 SR 主配置和生成模块；`meta.version` 继续只控制 Loon 产物。不要升级 Loon 产物版本来发布 SR 补丁。
- `tests/maintenance.js` 发现并检查全部 `.sgmodule`，包含不参与构建的 9 个静态模块；新静态模块必须满足脚本超时、更新间隔、资源限制和 MITM / QUIC 安全边界。
- `src/apps/*.js` 可选 `shadowrocketRules` 覆盖该单元在 SR 的 rules（Loon 仍用 rules）；当前公众号单元用它避免 wxs.qq.com 整域误拦，保留 Loon 基础产物不动。
- 外链仅 HTTP(S)，不依赖 URL API，不对已完整解出的目标继续整体 decodeURIComponent。脚本用 vm.Script 验证真实脚本语法，node --check 的 CommonJS 语法检查不能替代它。
- protobuf / gRPC 脚本必须捕获解码错误并原样放行；B 站只修改单个完整消息帧，损坏、多帧和 trailers 保守放行。
- CI 缺 jq 必须失败；`npm run check:remotes` 是联网检查，不替代离线回归。每周远程检查仅检测可用性及基本格式，不保证上游不存在误杀。
- 两端共享的 modules/scripts 修复也会影响 Loon；本轮 Loon 配置 / 插件 / 规则文件保持不变，不能声称 Loon 运行行为完全没变化。

## v3.3.2：仅 Shadowrocket 分流补丁
- `src/meta.js` 的 `shadowrocketVersion` 用于两个 SR 主配置；`version` 当时仍用于 Loon / 去广告模块（v3.3.3 起模块改用 shadowrocketVersion）。两者独立升级，不要因 SR 分流补丁批量更新其它产物。
- SR 的 `general()` 用派生旁路列表，不旁路 `*.apple.com` 或 `17.0.0.0/8`，以免遮蔽 Developer / WWDC CDN 代理规则；其余 Apple 域名仍默认直连。共享基础列表继续供 Loon 使用，未改变 Loon 产物。
- SR Claude / Gemini 默认选 `AI稳定线路`（fallback）；它减少测速切线但不保证固定 IP。需要固定出口时选单节点，已有客户端可能需要手动更新策略选择。


## 原则
0. **分流与去广告分离**：两个 `.conf` 只做分流（不得出现 REJECT 规则、[URL Rewrite]、[Script]、[MITM]）；去广告全部在 `modules/adblock-ultimate.sgmodule`（由 `src/rules/10-adblock.list` + `src/apps/*.js` 生成）。测试会强制检查。
1. **生成模块只改 `src/` 和 `modules/scripts/`；9 个静态模块可直接维护并必须通过测试**，然后 `npm run build && npm test`。两个 `.conf` 与生成的模块都是产物，手改会被覆盖，`npm test` 也会报“产物过期”。
2. **Apple 原生服务永远最先匹配、不解密、不拒绝**（`src/rules/00-protect.list` + `skip-proxy` / `always-real-ip` / `tun-excluded-routes`）。
3. **MITM 只写精确主机名**，不解密银行 / 支付 / 运营商 / 大 CDN，也不写 `*.qq.com`、`*.taobao.com` 这类整站通配。每个 MITM 主机会自动生成 `UDP/443 → REJECT` 规则，迫使 App 用 TCP（否则 QUIC 会绕过重写与脚本）；`block-quic=all-proxy` 只管走代理的连接，管不到直连 App。
4. **不要用宽泛 REJECT**（如 `gtimg.cn`、`umeng.com`、`bytegecko.com`、京东 / 淘宝联盟跳转域名），测试里有黑名单。
5. 脚本：只按明确的广告字段删除，任何异常都 `$done({})` 原样放行；`timeout=10`（微博 30），`max-size` ≤ 5MB，禁止 `-1`。

## 新增 / 修改一个 App
在 `src/apps/<id>.js` 导出：
```js
{ id, name, desc, rules: [], rewrites: [], bodyRewrites: [{ pattern, jq }], scripts: [{ name, type: 'request'|'response', pattern, script, maxSize, binary, timeout }], mitm: [] }
```
构建会把它写进 `modules/adblock-ultimate.sgmodule` 和 `modules/<id>.sgmodule`（`moduleFile: false` 则只进全量模块）。
- `bodyRewrites` 生成 `[Body Rewrite]` 的 `http-response-jq`。`jq` 可以是字符串或数组（多步），构建时每一步都包成 `(. as $o | try (步骤) catch $o)`，单步失败原样放行；jq 里不能出现单引号。测试会用本机 jq 对每条表达式做语法 + 4 种异常输入的健壮性检查，并有行为用例。能用 jq 就不要写脚本。
- 只是“返回空数据”的接口用 `reject-dict`（URL Rewrite），不要用脚本。

## 已知根因（别再走回头路）
- **酷安开屏要点“跳过”**：酷安自营开屏 = `/v6/main/init` 返回的第一张 `entityTemplate=imageCard`。只拦图片会得到“空白开屏 + 跳过”。正确做法：删除 imageCard，并把配置卡（entityId 6390）的 `SplashAd.Type=""`、`SplashAd.timeout="0"`、`SplashAd.Expires=9999999999`、`SplashAd.onResume="0"`；请求阶段去掉 `If-None-Match`/`If-Modified-Since`。不要拦 `image.coolapk.com`。
- **闲鱼 / 淘宝开屏去不掉**：阿里系 App 先请求明文 `http://<ip或域名>/amdc/mobileDispatch` 拿调度结果，之后走 spdy / xQUIC 长连接，HTTPS 解密与重写全部失效。v3.1 用的 `AND(URL-REGEX + USER-AGENT 闲鱼*)` 不可靠（UA 会变、部分请求不带 UA），v3.2 改为**全局** `URL-REGEX,"^http:\/\/.+\/amdc\/mobileDispatch",REJECT` + `amdc.m.taobao.com` / `amdc.m.youku.com`（`10-adblock.list` 第 7 段）。支付宝在关键服务直连段，先于此规则命中，不受影响；不要拒绝 `amdc.alipay.com`。改完需重装 App 才能清掉缓存开屏。
  **v3.2.1 实测**：闲鱼用缓存 / 内置 IP 直连 80 端口请求 AMDC（校园网下是 CERNET 节点 58.205.x），Shadowrocket 建连时只看到 IP，上面的 DOMAIN / URL-REGEX 规则都匹配不到（日志命中 `GEOIP,CN,DIRECT`）。因此 `scripts/build.js` 里的 `AMDC_REWRITE`（`[URL Rewrite]` reject，排除 alipay 主机）作为兜底，写进全量模块和带 AMDC 规则的单 App 模块。不要改成按 IP 封（节点随网络变化，且会误伤支付宝）。
- 高德同理；不要在 AMDC 上用 http-response 脚本改 header（无效）。
- **贴吧**：必须关闭「通过 HTTP/2 进行中间人攻击」，否则登录态异常（ack20a / 可莉插件同样的说明）。`tieba-json.js` 处理 JSON 接口，protobuf 接口只做 reject。
- **关键服务下的精确广告域名**（如 `ad.12306.cn`、`ads.95516.com`、`m1.ad.10010.com`）：写在 `10-adblock.list` 即可，`criticalGuard` 会把它们提到关键服务直连段之前。

## 路由（分流配置）
`00 保护 → AI → 学术 / 海外 / 开发 / 媒体 / TLD → 金融 / 邮箱直连 → 服务规则集 → 国内 → China/Global 规则集 → GEOIP,CN,DIRECT → FINAL,漏网之鱼(默认 PROXY)`。
`GEOIP,CN` 不带 `no-resolve`：未命中规则的冷门国内域名解析到大陆 IP 时仍直连。
- **v3.3.1 直连延迟根因**：①`WeChat` 曾引用 QuantumultX 版规则集（`HOST*` 类型小火箭不认，且 `IP-ASN` 不带 `no-resolve`），导致排在它之后的所有国内请求都要先等一次 DNS；现改用 Shadowrocket 版，测试禁止 SR 配置引用非 Shadowrocket 格式规则集。②blackmatrix7 的 `China.list` 实际只有 IP/UA 等约 60 条，3700+ 国内域名在 `China_Domain.list`（DOMAIN-SET），已紧跟 China.list 加入（Loon 同步）。不要换成 ChinaMax_Domain / Global_Domain（数万条，内存和耗电不划算）。③测速组 interval 600→1800。
- 用户 App 清单在 `tests/fixtures/app-routing.json`：新增 / 修改分流后跑 `npm test`，每个 App 的代表域名必须命中**显式规则**且策略正确（远程 RULE-SET 不算，防止规则集下载失败时分流跑偏）。没有固定域名的国内小 App 放 `geoipOnly`。
- 测试禁止：同一域名两条规则策略不同；更具体的规则排在更宽的同后缀规则之后且策略不同（永远不会生效）。
- 用户决策：Klook / Price / B&O / Adobe(Lightroom) / Canva / Zoom / Notion / Xmind / Bark / Starryblu / TestFlight / Kimi / B站国际版 直连；Edge + 必应、Apple Developer（developer.apple.com 与两个视频 CDN）、AltStore、Surge / QX / Karing / Hiddify 官网走代理。`msn.com` 仍在 81-mail 直连（Outlook 相关），Edge 新标签页资讯因此是国内版，属预期。

去广告模块的规则顺序：`QUIC 回落 → AWAvenue → 广告联盟 → App 专项`。Shadowrocket 中模块规则先于配置规则匹配，所以模块里绝不能拒绝 Apple 核心域名（测试已覆盖）。

## Loon 版（v3.3）
产物：`Loon_LazyGroup.conf`、`loon/plugins/adblock-supplement.plugin`（配合可莉）、`loon/plugins/adblock-ultimate.plugin`（不用可莉时）、`loon/rules/*.list`（自研分流块）。全部由 `scripts/loon.js` 从同一份 `src/` 生成；可莉插件清单在 `src/loon.js`。
- **Loon 规则来源优先级：本地 [Rule] > 插件 > [Remote Rule]**，且域名请求先匹配所有域名规则，没命中才解析 DNS 匹配 IP 规则。所以本地只放 00 保护 + 关键服务（含 `criticalGuard` 提前的精确广告拒绝）+ 邮件端口 + GEOIP / FINAL；分流全部做成远程规则，否则本地的 `DOMAIN-SUFFIX,taobao.com,DIRECT` 之类会盖掉可莉 / 自研插件的拒绝规则。
- 远程规则一个文件只能对应一个策略。`routingBlocks` 按原顺序分块：显式规则只并入更早的同策略块，中间不能隔着不同策略的 RULE-SET（屏障）或与之重叠的不同策略规则。测试逐域名比对 Loon 与 Shadowrocket 懒人版的首个命中，并检查每条显式规则前面的不同策略规则集不变。块编号会随规则增减变化，主配置同步重新生成即可。
- `KELEE_PLUGINS[].covers` = 被该可莉插件取代的自研单元：补充插件自动排除这些单元，避免同一接口被两套脚本处理。新增 App 单元时先查可莉有没有同名插件（`https://kelee.one/Tool/Loon/Lpx/<Name>.lpx`，kelee.one 只允许 Loon 客户端下载，沙箱里拿不到原文，可参考 GitHub 上的镜像）。不收录 12306 / 云闪付插件（会解密关键服务）；主配置 [MitM] 用 `-域名` 排除全部关键服务，可莉的可莉广告过滤器 / 小程序插件里写了 10086、10010、tenpay、bankcomm、12306 的主机，靠这里排除。
- 直连提速：`dns-server = system,223.5.5.5,119.29.29.29`，**不要加 doh-server**（Loon 配了加密 DNS 就优先用它）；`ip-mode = ipv4-only`；`domain-reject-mode = DNS`。
- jq 改写用 Loon 旧语法 `response-body-json-jq '...'`，脚本用旧语法 `http-response <正则> script-path=..., requires-body=true, binary-body-mode=true, timeout=10, tag=...`，脚本文件与 Shadowrocket 共用 `modules/scripts/`。尚未真机验证 Loon 的 jq 是否支持 `try ... catch`（只影响默认关闭的全量插件）。
- 已知：blackmatrix7 的 `China.list` 上游目前只有 74 行（头部写 3752 条），两个客户端都靠自研 90-domestic 与 GEOIP,CN 兜底。

## 抖音 38.4.0 与 Notion（v3.3.6）

- 临时只读测试（commit 5d38c5c）在用户 iPhone 上只能刷两个视频、评论区打不开：抖音 38.4.0 不接受解密 `api*-normal-*.amemv.com` / `aggr*`。测试模块已撤下。不要再解密抖音 App 接口，也不要恢复旧的推荐流脚本。
- 因此推荐流里的广告、带货和挂游戏下载链接的推广视频，无法在小火箭里按字段过滤；它们和正常视频共用推荐接口与 `douyinvod.com`。
- `src/shadowrocket.js` 的 `DOUYIN_ADS` 只给小火箭两个广告模块追加广告 / 线索表单 / 遥测主机；用户真实请求记录中的推荐、评论、视频、图片、直播、配置主机由 `tests/sr-douyin-notion.js` 保护。`p3-developer.bytemaimg.com`（小程序 / 小游戏图标）故意不拦。
- Notion：用户改为走代理。`notionProxy()` 只改小火箭主配置和海外分流模块；Loon 保持原直连基线（fixture `loonExpect`）。

## 拼多多（v3.3.7）

- 用户反馈拼多多加载慢且本身广告少，要求小火箭去掉拼多多相关的重写和分流。`src/shadowrocket.js` 的 `SR_DROPPED` 让小火箭不再生成 pdd 单元（无重写 / jq / 解密 / QUIC 阻断 / titan 等拒绝），`filterAdRules` 与 `routing` 去掉拼多多显式规则；`modules/pdd.sgmodule` 已撤下。拼多多域名交给 China_Domain / GEOIP 直连。
- `src/apps/pdd.js` 与 Loon 的拼多多插件保持原样（Loon 不动）。上游 AWAvenue 自带的两条拼多多广告投放域名不在本仓库控制范围内。不要再给小火箭加回拼多多处理。
