# Shadowrocket / Loon 分流 + 去广告

iPhone 用 Shadowrocket / Loon 配置：精确分流，App 开屏与信息流去广告。Loon 版见[下方](#loon-版)。

## 小火箭 v3.3.4：Apple 服务统一直连

按最新选择，**所有 Apple 服务固定 `DIRECT`**：Apple Music、iCloud、App Store、Apple Account、APNs 推送、iMessage、FaceTime、接力关联域、地图、查找、天气、Siri、系统更新，以及 **Developer / WWDC / TestFlight**。不再保留 Apple 代理例外，也不再依赖可切到代理的「苹果服务」组。

- 补齐 `applemusic.com`、`apzones.com`、`.apple`（含 `networking.apple` / `safebrowsing.apple`）等显式保护，增加 Apple 完整域名集直连兜底；基础服务的代表域名不依赖远程列表下载。
- 恢复 `*.apple.com` 与 Apple 公网 `17.0.0.0/8` 旁路；保留并补齐本地、IPv6 链路本地 / ULA 和组播规则，避免接力、AirDrop、AirPlay 的本地连接进入代理。
- 全量、广告联盟、AWAvenue 三个聚合模块中的 Apple 保护先于广告列表；全量模块增加 Apple 根域名和子域名的 MITM 排除。不改变其它去广告脚本或隐私设置。
- 主配置和已启用的聚合去广告模块都要更新，地址不变。更新后重新连接小火箭，关闭并重开音乐以建立新连接；无需卸载 App。使用全局代理模式或自行添加更高优先级模块时，需另外检查运行模式 / 模块规则。
- 本补丁仅调整 Shadowrocket。Loon 生成产物保持原样，因此两端 Apple 策略现在有意不同；测试分别验证，不能再宣称全量等价。

官方网络清单：[Apple 服务域名](https://support.apple.com/101555)、[本地发现和服务端口](https://support.apple.com/103229)。直连不能替代接力本身的蓝牙、Wi-Fi、账号及设备兼容性条件，也不保证特定网络上的所有 Apple 端点均可达。尚未做用户设备的真机验证。

### v3.3.3 历史维护记录

本轮维护覆盖两个 Shadowrocket 主配置、全部 43 个模块和 21 个脚本的静态 / 安全检查。Loon 配置、插件和规则产物未改动；两端共用的脚本修复也会作用于引用同一脚本的 Loon 插件。

- 继承 v3.3.2 分流修复：Apple Developer / WWDC CDN 不再被 Apple 整站旁路覆盖；Claude / Gemini 默认使用 fallback 稳定线路，但不保证固定出口 IP。
- 外链直跳不再依赖浏览器 URL API；保留路径和签名参数编码，只允许 HTTP(S)，校验来源主机，拒绝危险协议、凭据及响应头注入。
- 高德、微博、小红书、喜马拉雅和 protobuf 脚本补齐异常放行；B 站 / 网易云修复非 CommonJS 沙箱的顶层 return；B 站增加完整单帧 gRPC 检查与 ArrayBuffer 支持。
- 完美电竞不再因 `thread` / `download` 等类型、普通福利标签或正文标题误删内容；小红书不再仅因普通 `card_icon` 删除笔记。
- 小火箭公众号模块取消 `wxs.qq.com` 整域拦截，继续按具体广告接口处理；全量模块补齐关键服务根域名排除；阿里系单模块加入支付宝前置保护。
- 独立抖音模块移除全局 `-*` 解密排除与 `bytegecko.com` 整域拦截；独立模块补齐解密主机 QUIC 回落和脚本资源上限。
- 网页净化仅处理 HTML、避免重复注入，保留普通按钮和登录框；不覆盖只读 Location 方法，不移除 CSP。网站 CSP 可能阻止内联脚本，主动 `location` 跳转不保证拦截。
- `npm test` 覆盖所有生成及静态模块；CI 强制安装 jq，提交 / PR 自动测试，每周或手动运行远程规则源检查。

**升级**：更新主配置和已启用模块，并刷新远程脚本（默认更新间隔 24 小时）；地址不变。已有客户端如保留旧选择，可把 Claude / Gemini 手动切到「AI稳定线路」。不要为本版本直接卸载 App；缓存问题优先清缓存，重装前先备份本地数据。

> 这是离线回归和规则源验证后的维护版本，不代表所有 App 版本均已真机验证；广告接口、证书绑定和上游脚本变化仍可能影响效果。

## 使用方式：分流配置 + 去广告模块

**1. 分流配置（二选一，纯分流，不含任何去广告）**

| 配置 | 说明 | 订阅地址 |
| :--- | :--- | :--- |
| **懒人策略组版（推荐）** | AI 专线、流媒体、社交、地区自动测速等策略组 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Shadowrocket_LazyGroup_Merged.conf` |
| **大一统精简版** | 规则相同，只有 PROXY / DIRECT 两种出口 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Shadowrocket_AllInOne_Ultimate.conf` |

**2. 去广告模块（配置 → 模块 → 右上角 + 添加）**

| 模块 | 地址 |
| :--- | :--- |
| **全量去广告（推荐，含同源生成的 App / 浏览增强模块）** | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/adblock-ultimate.sgmodule` |
| 仅广告联盟拦截 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/adblock.sgmodule` |

全量去广告需要 HTTPS 解密：配置文件 ⓘ → HTTPS 解密 → 生成并安装 CA 证书 → 系统设置 → 通用 → 关于本机 → 证书信任设置 中信任证书。

> 旧开屏仍出现时先清理 App 缓存；如确需重装闲鱼、淘宝或贴吧，先确认账号和本地数据已备份。
> 贴吧需关闭 HTTPS 解密里的「通过 HTTP/2 进行中间人攻击」，否则可能提示未登录。
> 全量模块与单 App 模块不要同时开启（内容重复）。

## 单 App / 其它模块（只想净化个别 App 时用，与全量模块二选一）

| 模块 | 地址 |
| :--- | :--- |
| 酷安 / 闲鱼 / 淘宝（含飞猪、淘票票）/ 京东 / 拼多多 / 滴滴 / 知乎 / 微博 / B站 / 小红书 / 贴吧 / 百度网盘 / 高德 / 夸克 / 斗鱼 / 转转 / 微店 / 小黑盒 / 公众号文章 / 网易云 / 喜马拉雅 / 起点 / 虎扑 / 航旅纵横 / 肯德基 / 麦当劳 / 完美电竞 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/<coolapk\|goofish\|taobao\|jd\|pdd\|didi\|zhihu\|weibo\|bilibili\|xiaohongshu\|tieba\|baidunetdisk\|amap\|quark\|douyu\|zhuanzhuan\|weidian\|xiaoheihe\|wechat-mp\|netease\|ximalaya\|qidian\|hupu\|umetrip\|kfc\|mcdonald\|pwesports>.sgmodule` |
| 外链直跳 / Safari 网页去打扰 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/direct-link.sgmodule`、`https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/safari-clean.sgmodule` |
| AI 服务分流 / 海外常用分流（给使用其它分流配置的用户） | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/ai-services.sgmodule`、`https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/overseas-top500.sgmodule` |

番茄小说、网易大神、WakeUp 课程表、山姆、创客贴等少量规则只在全量模块里。抖音、TikTok、微信、BoxJs 等模块为独立维护的静态模块，不包含在全量模块内，见 `modules/`。TikTok 的 US / CA / JP / TW 地区版四选一；`douyin-web` 与 `douyin-watermark` 二选一，避免重复执行。抖音电商拦截可能影响购物；微信广告与正常内容可能共用素材域名，遇到异常请停用独立模块排查。BoxJS 仅在需要管理脚本数据时启用，勿公开面板、Cookie 或脚本持久化数据。

## Loon 版

分流共用基础规则；自 Shadowrocket v3.3.4 起 Apple 服务策略有意不同（两端分别测试），去广告整合了[可莉插件](https://hub.kelee.one)。

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

- 按 App 清单逐个校验（`tests/fixtures/app-routing.json`）：Google / YouTube / Telegram / X / Meta / TikTok / Steam / Spotify / PayPal / Edge / AltStore 等走代理；Apple Developer 自 v3.3.4 起随全部 Apple 服务直连；Klook / Price / B&O / Lightroom / Canva / Zoom / Notion / Xmind / Bark / TestFlight / Kimi / B站国际版及国内 App 直连。
- 测试同时禁止策略互相矛盾、被更宽规则遮蔽而不生效的规则。
- 直连提速：国内域名由 3700+ 条 `China_Domain`（DOMAIN-SET）直接命中，无需先做 DNS 再走 GEOIP；所有远程规则集的 IP 规则都带 `no-resolve`；测速组每 30 分钟测一次，减少后台唤醒。

## 致谢

规则与接口参考了 [可莉 luestr/ProxyResource](https://github.com/luestr/ProxyResource)（hub.kelee.one 插件）、[fmz200/wool_scripts](https://github.com/fmz200/wool_scripts)、[ack20a/sr-ad-plugins](https://github.com/ack20a/sr-ad-plugins)、[blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script)、[TG-Twilight/AWAvenue-Ads-Rule](https://github.com/TG-Twilight/AWAvenue-Ads-Rule)；本仓库只取已核对的部分并做了 Shadowrocket 适配与回归测试；Loon 版直接引用可莉插件。

## 目录结构

```
src/
  meta.js          版本号、CDN 地址
  apple.js         仅小火箭：Apple 全直连、模块保护和本地链路规则
  profile.js       [General] / [Proxy Group] / [Host]
  loon.js          Loon 版：可莉插件清单、策略组、节点筛选
  rules/00,20-99   分流规则分段（进主配置）
  rules/10-adblock 广告联盟拦截（进去广告模块）
  apps/*.js        每个 App 的去广告规则 / 重写 / Body Rewrite(jq) / 脚本 / MITM（进全量模块和单 App 模块）
modules/scripts/   脚本
scripts/build.js   生成两个分流配置与全部模块
scripts/loon.js    生成 Loon 配置、插件（loon/plugins）与远程规则（loon/rules）
scripts/check-remotes.js  远程规则健康检查
.github/workflows/validate.yml  提交 / PR 回归和每周远程规则检查
tests/             校验、脚本行为、jq 改写与 App 分流清单测试
```

```bash
npm run build   # 修改 src/ 后重新生成
npm test        # 全部生成 / 静态模块安全边界、脚本沙箱语法、异常与行为回归（完整测试需要 jq）
npm run check:remotes # 联网检查 43 个上游规则 URL、非空内容及基本格式（数量随规则变更）
```
