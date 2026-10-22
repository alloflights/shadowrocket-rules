# Shadowrocket / Loon 分流与去广告

适用于 iPhone 的分流配置与去广告模块，提供国内外应用分流、常见 App 去广告及浏览体验优化。

## 功能概览

- **智能分流**：国内应用直连，海外应用按规则使用代理；支持 AI、流媒体、社交等独立策略组。
- **Apple 服务直连**：小火箭版的 Apple Music、iCloud、App Store、系统推送等 Apple 服务统一直连。
- **应用去广告**：覆盖闲鱼、淘宝、京东、拼多多、知乎、微博、B 站、小红书等常见应用的部分开屏、信息流和弹窗广告。
- **浏览与保存增强**：提供外链直跳、网页去打扰，以及部分应用的图片、视频保存优化。
- **灵活选择**：可以使用全量去广告，也可以按需启用单 App 模块。

> 本项目不提供代理节点，需自行准备节点或订阅。Shadowrocket 与 Loon 请使用各自对应的配置和模块，功能覆盖可能不同。

## Shadowrocket 部署

### 1. 导入分流配置

在小火箭的「配置」页面，从 URL 下载以下配置，**二选一**：

| 配置 | 适用方式 | 地址 |
| :--- | :--- | :--- |
| **懒人策略组版（推荐）** | 可分别选择 AI、流媒体、社交等服务的线路 | [导入地址](https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Shadowrocket_LazyGroup_Merged.conf) |
| **大一统精简版** | 只区分代理和直连，设置更简单 | [导入地址](https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Shadowrocket_AllInOne_Ultimate.conf) |

导入并选用配置后，添加自己的节点订阅，选择可用节点或策略组，使用「配置」模式连接。

### 2. 添加去广告模块

主配置只负责分流，去广告需要另行添加模块。进入「配置 → 模块 → +」，复制对应链接添加并启用：

| 模块 | 适用方式 | 地址 |
| :--- | :--- | :--- |
| **全量去广告（推荐）** | 常见应用一起净化 | [模块地址](https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/adblock-ultimate.sgmodule) |
| **轻量去广告** | 仅需基础广告拦截 | [模块地址](https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/adblock.sgmodule) |

以上模块选择一个即可。只想净化个别应用时，可改用[单 App 模块](./modules/)，不要与全量模块重复开启。

抖音、TikTok、微信等独立模块按需添加，未包含在全量模块内。TikTok 地区模块四选一；`douyin-web` 与 `douyin-watermark` 二选一。BoxJS 仅在明确需要时启用。

### 3. 安装并信任证书

全量及多数单 App 去广告模块需要开启 HTTPS 解密：

1. 打开当前配置的详情，进入「HTTPS 解密」。
2. 生成并安装本设备的 CA 证书，按系统提示完成描述文件安装。
3. 前往 iPhone「设置 → 通用 → 关于本机 → 证书信任设置」，信任刚安装的证书。
4. 返回小火箭开启 HTTPS 解密，重新连接。

轻量去广告模块不需要安装证书。仅安装并信任自己生成、来源明确的证书。

## Loon 部署

1. 在「配置 → 从 URL 下载配置」中导入 [Loon 懒人配置](https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Loon_LazyGroup.conf)。
2. 在「订阅节点」中添加自己的订阅，选择可用线路。
3. 保持配置预设的插件组合：默认启用可莉插件与自研补充插件。
4. 如改用自研全量去广告插件，先关闭可莉插件和自研补充插件，避免重复开启。
5. 前往「配置 → MitM」生成并安装证书，在系统「证书信任设置」中信任，然后开启 MitM；使用 YouTube 插件时同时开启「MitM over HTTP/2」。

可莉插件请在 Loon 内下载和更新。

## 日常更新与注意事项

- **更新**：同步更新正在使用的主配置、模块或插件及远程脚本，再重新连接。更新前建议备份自己的配置和节点设置。
- **避免叠加**：全量模块与同源单 App 模块不要重复开启；使用其他项目的去广告模块时，也请留意重复或冲突。
- **缓存广告**：旧开屏仍出现时，可先在应用内清理缓存并重开应用。清理前注意备份草稿等本地数据，不必直接卸载重装。
- **功能异常**：可暂时停用对应模块排查。贴吧出现登录异常时，可尝试关闭 HTTPS 解密中的「通过 HTTP/2 进行中间人攻击」选项。
- **效果范围**：广告拦截和媒体保存效果会随 App 版本变化，不能保证清除所有广告或水印；部分净化选项可能影响购物等功能，请按需开启。
- **隐私保护**：不要公开自己的节点订阅、Cookie、脚本数据或 BoxJS 面板。

## 致谢

感谢以下项目提供的规则、插件与参考：

- [可莉 / luestr/ProxyResource](https://github.com/luestr/ProxyResource) · [插件主页](https://hub.kelee.one)
- [fmz200/wool_scripts](https://github.com/fmz200/wool_scripts)
- [ack20a/sr-ad-plugins](https://github.com/ack20a/sr-ad-plugins)
- [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script)
- [TG-Twilight/AWAvenue-Ads-Rule](https://github.com/TG-Twilight/AWAvenue-Ads-Rule)
