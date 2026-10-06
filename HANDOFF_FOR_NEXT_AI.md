# Shadowrocket 去广告与分流系统：AI 继任开发者工作指南 (Project Handoff Specification)

> 本文档专为接手的 AI 优化助手量身定制，涵盖项目核心架构、文件映射关系、当前已解决痛点、待优化的核心缺陷（重点：腾讯优量汇漏网问题）及验收规范。

---

## 1. 项目基本概况与技术背景

* **项目名称**：`shadowrocket-rules`
* **代码仓库**：`https://github.com/allofights/shadowrocket-rules`（远端分支：`main`，开发者标识：`allofights`）
* **运行平台**：iOS Shadowrocket（小火箭）
* **核心目标**：提供 iPhone 全量 App 的开屏秒开（0s 跳过）、内置信息流净化、防摇一摇跳转、境外精准分流与本地无感 Mock。

### 核心架构原理
1. **双轨同步机制**：
   - **单体模块（Modules）**：位于 `modules/` 目录下（如 `coolapk.sgmodule`, `baidunetdisk.sgmodule`, `pwesports.sgmodule`），以及聚合版 `modules/adblock-ultimate.sgmodule`。
   - **大一统配置（Conf）**：位于根目录的 `Shadowrocket_LazyGroup_Merged.conf`（懒鱼策略组集成版）与 `Shadowrocket_AllInOne_Ultimate.conf`。
   - **⚠️ 核心红线**：修改任何 App 的去广告规则，**必须全量同步更新上述 4 类配置文件**，严禁只改模块漏改主配置。
2. **CDN 脚本外置机制**：
   - 过滤与 Mock 脚本位于 `modules/scripts/*.js`；
   - 生产环境通过 jsDelivr CDN 直连加速执行：`https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/<name>.js`。
3. **开屏拦截原则（严禁盲目 Socket REJECT）**：
   - 现代 App（如百度网盘、酷安、完美世界电竞）内置离线持久化缓存与网络容灾机制。
   - 对 App 自建开屏配置接口**严禁使用网络层 REJECT**（会导致客户端判定网络错误，触发降级回退到本地 SQLite/沙盒缓存广告，或原地等待 5 秒超时）；
   - **唯一正解**：通过 Shadowrocket 的 `type=http-request` 或 `type=http-response` 执行本地 0.1ms Mock，返回状态 200 OK 且包含合法空数据结构（如 `{ code: 0, data: { splash: null } }`），欺骗客户端秒进主页。

---

## 2. 核心文件索引清单

| 类别 | 关键文件路径 | 说明 |
| :--- | :--- | :--- |
| **主配置文件** | `Shadowrocket_LazyGroup_Merged.conf` | 用户真机主用底模，含海外分流、懒鱼策略组及内嵌去广告 |
| **主配置文件** | `Shadowrocket_AllInOne_Ultimate.conf` | 全功能一体化配置 |
| **全能去广告模块** | `modules/adblock-ultimate.sgmodule` | 用户在 Shadowrocket 模块界面挂载的终极模块 |
| **酷安专项模块** | `modules/coolapk.sgmodule` | 酷安 App 专用去广告规则与重写 |
| **酷安专项脚本** | `modules/scripts/coolapk.js` | 酷安开屏/信息流/动态详情/评论区清洗脚本 |
| **百度网盘模块** | `modules/baidunetdisk.sgmodule` | 百度网盘开屏与推广阻断 |
| **百度网盘脚本** | `modules/scripts/baidunetdisk.js` | 百度网盘 0.1ms 本地 Mock 与数据流清理 |
| **完美世界电竞模块** | `modules/pwesports.sgmodule` | 完美世界电竞专属模块 |
| **完美世界电竞脚本** | `modules/scripts/pwesports.js` | 完美世界电竞开屏 Mock 与赛事/社区净化脚本 |
| **自动化测试套件** | `tests/verify_all.js` | 覆盖全文件 AST 语法、正则有效性与架构冲突检查（`npm test`） |

---

## 3. 当前进展与已解决痛点（前期基线）

截至最新 Commit `13e6aae`：
1. **百度网盘（Baidu Netdisk）**：
   - 修复了此前正则括号嵌套导致根路径 `/splash/*` 漏匹配脱靶的缺陷；
   - 解决了 iOS Objective-C 将 `splash: {}` 误判为非空对象而启动 5 秒倒计时的 Bug，统一返回 `splash: null`；
   - 移除 Socket 级 `issuecdn` REJECT，改由 MITM 下发透明 1x1 占位图，防止图片加载库挂起超时。
2. **完美世界电竞（PWEsports）**：
   - 移除了 `[URL Rewrite]` 中对 `advert` 的 `reject-dict` 抢断，改由脚本统一返回合法结构，根治了客户端启动因 `NSNull` 崩溃和离线广告回退问题；
   - 全面覆盖比赛、资讯、社区与商城弹窗。
3. **穿山甲 (Pangle) 全套 SDK 域名补齐**：
   - 封禁了穿山甲摇一摇全套域名（`pangolin.snssdk.com`, `csjbi.com`, `isplusurl.com`, `bytead.net` 等）。

---

## 4. 待解决的核心任务（本次交付重点）

用户在实测中反馈：**酷安 App 仍会弹出半屏启动/唤醒卡片广告（表现为“热门推荐礼盒”、“摇动/点击了解更多内容”、“3s后可自动关闭”，推广七鲜/第三方应用），右下角带有广告合规标识。**
用户指出：**该广告疑似来自腾讯优量汇（Tencent GDT），之前未阻断干净。**

请继任 AI 重点针对以下两方面进行彻底排查与加固：

### 任务 1：腾讯优量汇（GDT / 广点通）域名与协议地毯式封堵
目前的规则虽然包含了部分基础域名，但腾讯优量汇近年来扩充了大量动态与垂直业务分发域名，需全面加固：
1. **核心请求与通信域名补全**：
   - `*.gdt.qq.com`（特别注意：`c.gdt.qq.com`, `v.gdt.qq.com`, `win.gdt.qq.com`, `t.gdt.qq.com`, `api.gdt.qq.com`, `mi.gdt.qq.com`）
   - `*.e.qq.com`（`sdk.e.qq.com`, `ad.qq.com`）
   - `*.qzs.qq.com`（优量汇部分落地页与样式模板）
2. **素材与 CDN 资源域名补全**：
   - `*.gdtimg.com`（`adsmind.gdtimg.com`, `qzs.gdtimg.com`, `v.gdtimg.com`）
   - `*.ugdtimg.com`（`pgdt.ugdtimg.com` 等）
   - `*.gtimg.cn`（`pgdt.gtimg.cn` 等）
3. **TME 腾讯音乐与泛腾讯系广告联盟域名**：
   - `tmead.y.qq.com`, `ad.tencentmusic.com`, `adstats.tencentmusic.com`
4. **优量汇 HTTPDNS IP 防绕过**：
   - 检查已有的腾讯移动解析 HTTPDNS IP（`119.29.29.98/32`, `182.254.116.0/24` 等）是否完备，防止 SDK 直连 IP 绕过域名分流。

### 任务 2：京东京媒（JAD / JADYun）与三方聚合 SDK 的兜底防御
由于广告主为京东自营生鲜“七鲜”，除优量汇外，酷安还集成了京东自建的“京媒平台”及其他聚合 SDK，建议一并加固以防按瀑布流（Waterfall）兜底穿透：
1. **京东京媒（JAD SDK）域名集**：
   - `DOMAIN-SUFFIX,jadyun.com,REJECT`
   - `DOMAIN-SUFFIX,jad.jd.com,REJECT`
   - `DOMAIN-SUFFIX,dsp-x.jd.com,REJECT`
   - `DOMAIN-SUFFIX,ad.jd.com,REJECT`
2. **酷安脚本（`modules/scripts/coolapk.js`）响应层加固**：
   - 审查 `/main/init`、`/main/index*`、`dataList*` 等接口返回的 JSON；
   - 彻底剥离卡片模板中的插屏/礼盒/弹窗对象（如 `popup`, `pop_window`, `floating_layer`, `interstitial`, `extraData.gdt`, `extraData.jad`）；
   - 凡命中七鲜、摇一摇、外部 DeepLink 跳转推广的实体，一律递归剔除。

---

## 5. 开发、测试与移交规范

1. **多文件同步修改清单**：
   - 若新增了域名或 IP 规则，务必同步写入：
     1. `modules/coolapk.sgmodule`
     2. `modules/adblock-ultimate.sgmodule`
     3. `Shadowrocket_LazyGroup_Merged.conf`
     4. `Shadowrocket_AllInOne_Ultimate.conf`
   - 若涉及新的 HTTPS 重写或脚本路径，必须检查并同步注册至上述四个文件的 `[MITM] hostname` 中。
2. **语法与冲突自查**：
   - 必须运行 `npm test`（即 `node tests/verify_all.js`）。
   - 如果新增了测试断言，请直接在 `tests/verify_all.js` 中扩充测试用例，确保自动化测试 100% 通过（当前基线为 66/66 全部 PASS）。
3. **完成后的移交流程**：
   - 继任 AI 优化完毕后，无需自行配置 GitHub 凭据或推送，**只需完成代码与测试验证**，并通知原调度 Agent。
   - 原调度 Agent 会负责：全套代码语法复核、Git 远端推送至 `main` 分支、调用 jsDelivr Purge API 全网刷新 CDN 缓存，并通过 Bark 移动端向用户发送手机推送通知。
