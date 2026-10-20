# Shadowrocket / Loon 分流 + 去广告

iPhone 用 Shadowrocket / Loon 配置：精确分流，App 开屏与信息流去广告。Loon 版见[下方](#loon-版)。

## 使用方式：分流配置 + 去广告模块

**1. 分流配置（二选一，纯分流，不含任何去广告）**

| 配置 | 说明 | 订阅地址 |
| :--- | :--- | :--- |
| **懒人策略组版（推荐）** | AI 专线、流媒体、社交、地区自动测速等策略组 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Shadowrocket_LazyGroup_Merged.conf` |
| **大一统精简版** | 规则相同，只有 PROXY / DIRECT 两种出口 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Shadowrocket_AllInOne_Ultimate.conf` |

**2. 去广告模块（配置 → 模块 → 右上角 + 添加）**

| 模块 | 地址 |
| :--- | :--- |
| **全量去广告（推荐，已含下面所有单 App 模块）** | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/adblock-ultimate.sgmodule` |
| 仅广告联盟拦截 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/adblock.sgmodule` |

全量去广告需要 HTTPS 解密：配置文件 ⓘ → HTTPS 解密 → 生成并安装 CA 证书 → 系统设置 → 通用 → 关于本机 → 证书信任设置 中信任证书。

> 升级到 v3.2 后：闲鱼、淘宝、百度贴吧删除重装一次，百度网盘清理缓存（清掉旧开屏缓存）。
> 贴吧需关闭 HTTPS 解密里的「通过 HTTP/2 进行中间人攻击」，否则可能提示未登录。
> 全量模块与单 App 模块不要同时开启（内容重复）。

## 单 App / 其它模块（只想净化个别 App 时用，与全量模块二选一）

| 模块 | 地址 |
| :--- | :--- |
| 酷安 / 闲鱼 / 淘宝（含飞猪、淘票票）/ 京东 / 拼多多 / 滴滴 / 知乎 / 微博 / B站 / 小红书 / 贴吧 / 百度网盘 / 高德 / 夸克 / 斗鱼 / 转转 / 微店 / 小黑盒 / 公众号文章 / 网易云 / 喜马拉雅 / 起点 / 虎扑 / 航旅纵横 / 肯德基 / 麦当劳 / 完美电竞 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/<coolapk\|goofish\|taobao\|jd\|pdd\|didi\|zhihu\|weibo\|bilibili\|xiaohongshu\|tieba\|baidunetdisk\|amap\|quark\|douyu\|zhuanzhuan\|weidian\|xiaoheihe\|wechat-mp\|netease\|ximalaya\|qidian\|hupu\|umetrip\|kfc\|mcdonald\|pwesports>.sgmodule` |
| 外链直跳 / Safari 网页去打扰 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/direct-link.sgmodule`、`https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/safari-clean.sgmodule` |
| AI 服务分流 / 海外常用分流（给使用其它分流配置的用户） | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/ai-services.sgmodule`、`https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/overseas-top500.sgmodule` |

番茄小说、网易大神、WakeUp 课程表、山姆、创客贴等少量规则只在全量模块里。抖音、TikTok、微信、BoxJs 等模块为独立维护的静态模块，见 `modules/`。

## Loon 版

分流规则与 Shadowrocket 懒人版完全一致（测试逐域名比对），去广告整合了[可莉插件](https://hub.kelee.one)。

**1. 配置**：配置 → 从 URL 下载配置，粘贴：

`https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Loon_LazyGroup.conf`

然后在「订阅节点」里添加机场订阅。

**2. 插件**：配置里已带好，默认开启：

| 插件 | 说明 |
| :--- | :--- |
| 自研补充去广告 | 广告联盟 / HTTPDNS / 阿里 AMDC 拦截，以及可莉没覆盖的 App（肯德基、麦当劳、山姆、NGA、外链直跳等） |
| 可莉插件 35 个 | 广告平台拦截器、HTTPDNS 拦截器、可莉广告过滤器、YouTube、Spotify，以及闲鱼、淘宝、京东、拼多多、微博、知乎、小红书、B站、贴吧、高德、滴滴、微信公众号 / 小程序等 |
| 自研全量去广告（默认关闭） | 内容同 Shadowrocket 全量模块。不想用可莉时开它，同时关掉可莉插件和「自研补充」 |

**3. MitM**：配置 → MitM → 生成并安装证书，在 设置 → 通用 → 关于本机 → 证书信任设置 中信任；同页开启「MitM over HTTP/2」（YouTube 需要）。

- 直连更快：系统 DNS 与阿里 / 腾讯 UDP DNS 并发取最快结果（不配 DoH）；只用 IPv4；国内域名直接按规则直连，不额外查 DNS；广告域名在 DNS 阶段返回 127.0.0.1，不等超时。
- 银行、支付、12306、政务、运营商等关键服务放在本地规则最前面直连，并在 MitM 里排除，即使插件写了这些主机也不会解密。
- 可莉插件只能在 Loon 里下载（kelee.one 会拦截其它客户端）。

## 分流说明

- 按 App 清单逐个校验（`tests/fixtures/app-routing.json`）：Google / YouTube / Telegram / X / Meta / TikTok / Steam / Spotify / PayPal / Edge / Apple Developer / AltStore 等走代理；Klook / Price / B&O / Lightroom / Canva / Zoom / Notion / Xmind / Bark / TestFlight / Kimi / B站国际版及国内 App 直连。
- 测试同时禁止策略互相矛盾、被更宽规则遮蔽而不生效的规则。
- 直连提速：国内域名由 3700+ 条 `China_Domain`（DOMAIN-SET）直接命中，无需先做 DNS 再走 GEOIP；所有远程规则集的 IP 规则都带 `no-resolve`；测速组每 30 分钟测一次，减少后台唤醒。

## 致谢

规则与接口参考了 [可莉 luestr/ProxyResource](https://github.com/luestr/ProxyResource)（hub.kelee.one 插件）、[fmz200/wool_scripts](https://github.com/fmz200/wool_scripts)、[ack20a/sr-ad-plugins](https://github.com/ack20a/sr-ad-plugins)、[blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script)、[TG-Twilight/AWAvenue-Ads-Rule](https://github.com/TG-Twilight/AWAvenue-Ads-Rule)；本仓库只取已核对的部分并做了 Shadowrocket 适配与回归测试；Loon 版直接引用可莉插件。

## 目录结构

```
src/
  meta.js          版本号、CDN 地址
  profile.js       [General] / [Proxy Group] / [Host]
  loon.js          Loon 版：可莉插件清单、策略组、节点筛选
  rules/00,20-99   分流规则分段（进主配置）
  rules/10-adblock 广告联盟拦截（进去广告模块）
  apps/*.js        每个 App 的去广告规则 / 重写 / Body Rewrite(jq) / 脚本 / MITM（进全量模块和单 App 模块）
modules/scripts/   脚本
scripts/build.js   生成两个分流配置与全部模块
scripts/loon.js    生成 Loon 配置、插件（loon/plugins）与远程规则（loon/rules）
tests/             校验、脚本行为、jq 改写与 App 分流清单测试
```

```bash
npm run build   # 修改 src/ 后重新生成
npm test        # 产物同步、正则、MITM 安全边界、脚本行为
```
