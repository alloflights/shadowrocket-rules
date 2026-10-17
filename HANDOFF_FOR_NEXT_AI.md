# Shadowrocket 生产级无感分流与去广告系统：项目交接与维护全景文档 (Project Handoff Specification)

> **版本**：v2.1.0  
> **维护者**：allofights  
> **仓库地址**：`https://github.com/alloflights/shadowrocket-rules`  
> **适用终端**：iOS / iPadOS Shadowrocket (小火箭)  
> **基线测试**：116 / 116 项自动化架构、正则与语义测试全绿通过 (`npm test`)

---

## 1. 项目定位与核心设计哲学

本项目为 iOS 平台 Shadowrocket 量身定制，旨在提供**零打扰、高稳定、秒启动**的日常分流与全域广告深度净化能力。

### 核心四大红线原则
1. **零打扰静默原则（Zero-Touch Silence）**：
   - 严禁任何脚本调用 `$notification.post` 弹出横幅通知，杜绝打扰用户正常操作；
   - 所有脚本必须具备防御性空响应早退机制：
     ```javascript
     if (!$response || !$response.body) { $done({}); return; }
     ```
   - 顶层必须包裹 `try / catch (e) { $done({}); }` 兜底，即便数据结构突变也绝不阻断客户端正常流程。
2. **移动端隧道抗拥塞与防假死原则（Tunnel Anti-Stall）**：
   - **海外去广告全面收敛**：不在移动端无节制堆叠海外第三方长尾域名拦截规则；
   - **严禁滥用 `h2=true` 与超大缓冲**：关闭不稳定 HTTP/2 MITM 解密，对大体积非文本流媒体严禁使用 `max-size=-1`（防止 iOS Network Extension 内存触顶被系统 Jetsam 强杀引发断网）；
   - **高安全域原生直通**：X (Twitter)、YouTube 等部署强 SSL Pinning 证书绑定或高频 GraphQL 签名的海外客户端，彻底剥离 MITM 解密与针对性 REJECT 规则，采用顶级直通路由直达代理节点，确保秒开且时间线刷新永不卡死。
3. **自底向上容器净化（Bottom-Up Empty Shell Pruning）**：
   - 拒绝简单的“将广告字段置空”导致客户端留下空白灰色占位框；
   - 采用自底向上的递归清洗算法，清洗子项后若父级容器变为空壳（`length === 0`），连同外层卡片容器一并剥离。
4. **单一事实源自动化构建（Single Source of Truth, SSOT）**：
   - 所有规则、MITM 域名、URL Rewrite 与脚本声明均由 `scripts/sync_architecture.js` 统一编译生成，禁止在主配置文件中手动盲目修改。

---

## 2. 核心架构与文件资产全景

```
shadowrocket-rules/
├── package.json                          # 构建与测试脚本定义 (npm run build / npm test)
├── scripts/
│   └── sync_architecture.js              # SSOT 架构编译引擎 (单向同步主配置与聚合模块)
├── tests/
│   └── verify_all.js                     # 116项自动化架构、正则、容错与语义一致性测试套件
├── Shadowrocket_LazyGroup_Merged.conf    # 【主力】定制策略组分流配置 (支持国内/海外/AI精细分流)
├── Shadowrocket_AllInOne_Ultimate.conf   # 【备选】大一统扁平分流配置 (直连/代理二元路由)
├── modules/
│   ├── adblock-ultimate.sgmodule         # 【全量】聚合无感去广告总模块 (包含全部主力应用与联盟广告)
│   ├── ai-services.sgmodule              # OpenAI / Claude / Gemini / Grok / Cursor 智能体分流模块
│   ├── direct-link.sgmodule              # 全网外链 302 秒跳中间页模块 (知乎/简书/掘金/CSDN/微博等)
│   ├── safari-clean.sgmodule             # Safari 移动端网页去流氓化 (自动展开全文/防诱导唤端)
│   ├── douyin-watermark.sgmodule         # 抖音无水印原片与图集提取模块
│   ├── [app-name].sgmodule               # 独立各 App 按需去广告模块 (coolapk/zhihu/goofish/...)
│   └── scripts/                          # 核心 JavaScript 拦截与净化脚本库
│       ├── goofish.js                    # 闲鱼开屏秒开、策略浮层过滤、推荐流净化
│       ├── coolapk.js                    # 酷安开屏Mock、304缓存破除、空壳容器剥离
│       ├── zhihu.js                      # 知乎全域推荐/热榜/动态/回答页/评论区/搜索广告净化
│       ├── baidunetdisk.js               # 百度网盘 0.1ms 开屏Mock与系统配置广告剥离
│       ├── bilibili-json.js & proto.js   # B站开屏/Tab/信息流 (JSON) 与视频播放页 (Protobuf)
│       ├── tieba-json.js & proto.js      # 百度贴吧 JSON + Protobuf 双引擎深度净化
│       ├── xiaohongshu.js                # 小红书无水印原图/LivePhoto 保存与推广过滤
│       ├── weibo.js                      # 微博时间线、开屏及广告预加载全面阻断
│       ├── amap.js & header.js           # 高德地图首页/路线/搜索净化及 AMDC 调度拦截
│       ├── netease.adblock.js            # 网易云音乐开屏、发现页、热搜与弹窗净化
│       ├── pwesports.js                  # 完美世界电竞开屏秒开与社区资讯广告剔除
│       ├── qidian.js                     # 起点读书开屏、每日导读与活动弹窗拦截
│       ├── ximalaya_json.js              # 喜马拉雅首页、推荐与动态流净化
│       └── direct-link.js                # 纯原生 302 重定向外链跳转解析器
```

---

## 3. 核心攻克技术机制深度解析

### 3.1 闲鱼（Goofish）全链路无感去广告与秒开
- **0.1ms 开屏 Mock**：
  - 通过 `goofish_splash`（`type=http-request`，`requires-body=0`）拦截 `mtop.taobao.idle.splash`、`mtop.taobao.idle.home.welcome` 等接口；
  - 本地快速返回空字典结构，客户端收到后判定无有效开屏排期，直接跳过 5 秒倒计时和冷启动动画，实现秒进首页。
- **策略下发净化（`user.strategy.list`）**：
  - 过滤掉下发的 `POPUP`（弹窗）、`FLOAT_LAYER`（悬浮层）、`BANNER` 等商业推广；
  - **白名单保护**：严格保留 `BIZ_PUBLISH_BALL`（底部中央发布“+”号按钮），确保核心发帖交互不受影响。
- **首页推荐流净化（`idle.home.recommend`）**：
  - 递归遍历推荐卡片，剔除携带 `adSign`、`isAd`、`cardType === 'ad'` 或推广标签的项目。

### 3.2 酷安（Coolapk）“广告去除但空白框残留”根治
- **破除 HTTP 304 缓存**：
  - 酷安客户端在本地持久化了 `ETag` 与 `Last-Modified`，若服务端返回 304，客户端将调用内置缓存继续展示开屏页面；
  - 在 `酷安_初始化请求`（`type=http-request`）中动态剥离 `/v6/main/init` 请求头中的 `If-None-Match` 与 `If-Modified-Since`，强制服务端返回 200 响应；
  - 随后由响应脚本将 `V8_APP_EXTRA` 中的 `SplashAd.*` 与开屏相关字段彻底抹平。
- **字符串与对象双轨解析**：
  - 针对酷安数据流中部分广告元数据被序列化为 JSON 字符串存储于 `extraData`，同时部分存在于 `extraDataArr` 对象的现象，脚本同时反序列化并解析两类字段，精准拦截广点通 (GDT)、穿山甲 (Pangle)、京准通 (JAD)、阿里妈妈 (Tanx) 等联盟广告位。
- **自底向上空壳容器移除**：
  - 清洗子数组后，若外层容器的子项被完全过滤（`length === 0`），连同外层卡片一并自数组删除，彻底杜绝空白灰色框残留。

### 3.3 知乎（Zhihu）全域深度广告拦截
- **全端点覆盖**：精准对齐 2026 最新端点，涵盖 `feed-root/`、`topstory/recommend`、`moments`、`questions/*/answers`、`answers/*`、`comment_v5/`、`ad-style-service/` 及 `commercial_api/` 等接口。
- **商业卡片穿透清洗**：深度剔除 `commercial_card`、`common_card` 商业推广、回答内联推荐卡、评论区首条置顶广告卡，同时对商业统计和打点接口返回安全空 JSON，防止前端解析器异常崩溃。

### 3.4 百度网盘（Baidu Netdisk）开屏秒开与素材透明化
- **开屏本地快速响应**：对 `pan.baidu.com` 的开屏广告拉取请求执行本地 Mock，跳过摇一摇与倒计时；
- **配置与图片安全替换**：
  - 保持 `issuecdn.baidupcs.com` 在 MITM 主机列表中，将广告图片请求重写为 1x1 透明图（`reject-img`），杜绝因 DNS 挂死引发的图片加载长超时；
  - 对 `getsyscfg` / `getconfig` 仅剔除推广配置条目，坚决不盲目返回 `reject-dict`，确保网盘基础同步与文件列表功能完全正常。

### 3.5 海外高安全域（X / YouTube）直通与网络底层保障
- **X (Twitter) 纯净直通**：
  - 彻底移除任何针对 X 的 MITM 解密、JS 注入和 REJECT 规则；
  - 在主配置规则头部以最高优先级配置：
    ```ini
    DOMAIN-SUFFIX,x.com,Twitter
    DOMAIN-SUFFIX,twitter.com,Twitter
    DOMAIN-SUFFIX,twimg.com,Twitter
    DOMAIN-SUFFIX,t.co,Twitter
    ```
    （AllInOne 配置中分流至 `PROXY`），确保原生客户端刷新零阻碍。
- **基础网络与系统服务直连保障**：
  - Outlook / Office 365 邮箱协议端口与域名走 `DIRECT` 并绑定系统 DNS，杜绝邮件同步长轮询断连；
  - Apple 登录、Push、iCloud 等认证与 CDN 域名配置 `server:system` 及 `always-real-ip`，并排除 TUN 虚拟网卡劫持。

---

## 4. 日常维护与开发工作流

### 4.1 环境依赖
- Node.js (推荐 v18+ / v20+)
- 不需要任何第三方 npm 依赖包（纯原生 Node.js 标准库实现）

### 4.2 核心指令
```bash
# 1. 运行架构同步引擎 (将修改单向同步至主配置与聚合模块)
npm run build

# 2. 运行全量自动化测试套件 (验证语法、正则、规则冲突与逻辑净化)
npm test
```

### 4.3 规则/脚本新增与修改标准流程
1. **若修改现有应用净化逻辑**：
   - 优先在 `modules/scripts/[app].js` 中修改，遵循空响应防御与静默无弹窗规范；
   - 在 `tests/verify_all.js` 中补充对应的断言用例；
   - 运行 `npm test` 确保用例通过。
2. **若新增拦截规则或 URL Rewrite**：
   - 在 `scripts/sync_architecture.js` 的 `UNIFIED_URL_REWRITE_BODY`、`enhancedAdRejectRules` 或 `UNIFIED_MITM_HOSTS` 中增补；
   - 运行 `npm run build` 自动重新生成各主配置和聚合模块；
   - 运行 `npm test` 验证全量 116 项测试通过。
3. **提交与上线**：
   - 提交变更并推送至 GitHub `main` 分支；
   - jsDelivr CDN 会自动与 GitHub 同步（链接格式：`https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/...`）。

---

## 5. 常见问题排查与避坑指南 (Troubleshooting)

| 现象 / 故障 | 根本原因 | 标准解决方案 |
| :--- | :--- | :--- |
| **手机浏览网页几分钟后网络突然假死** | 开启了长尾海外去广告规则，或对流媒体启用了大体积缓冲 / 不稳定的 `h2=true`，导致 Network Extension 内存溢出 | 严守抗拥塞原则，保持海外直通，不开启 `h2=true`，非必要不设 `max-size=-1` |
| **X (Twitter) 无法刷新时间线或转圈** | 规则中残留了针对 Twitter 域名的 REJECT 或开启了 MITM 解密，触发证书锁定/签名校验失败 | 确认 `x.com` 相关域名未被 MITM 拦截，且规则走顶级直通代理 |
| **某 App 出现广告位空白灰色色块** | 脚本仅置空了数据字段，未销毁外层空壳容器 | 采用自底向上清理机制，当外层容器子元素为 0 时直接 `delete` 或从数组中剔除父容器 |
| **酷安冷启动依然展示开屏广告** | 本地 304 缓存未失效，客户端拉取本地历史配置渲染 | 确保 `酷安_初始化请求`（http-request）剥离了 `If-None-Match` 和 `If-Modified-Since` |
| **网盘加载图片一直转圈超时** | 误把图片 CDN（如 `issuecdn.baidupcs.com`）直接用 `REJECT` 拦截，导致 TCP 握手超时挂起 | 改用 MITM `reject-img` 重写，本地秒返 1x1 透明图片 |

---

## 6. 后续演进建议 (Roadmap)

1. **持续跟踪阿里与字节 HTTPDNS 动态**：关注是否有新增的 IP 直连绕过域名，定期更新 IP-CIDR 与 Host 映射拦截；
2. **轻量化独立模块维护**：针对无需全量广告模块的用户，保持各独立 `.sgmodule` 与主构建引擎同步；
3. **版本标签发布自动化**：当进行重大功能迭代后，可通过 `git tag` 打标，便于追溯各阶段稳定版本。
