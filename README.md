# Shadowrocket 分流 + 去广告

iPhone 用 Shadowrocket 配置：国内直连低延迟、海外精确分流、App 开屏与信息流去广告，不碰 Apple 原生服务。

## 使用方式：分流配置 + 去广告模块（两部分独立）

**1. 分流配置（二选一，纯分流，不含任何去广告）**

| 配置 | 说明 | 订阅地址 |
| :--- | :--- | :--- |
| **懒人策略组版（推荐）** | AI 专线、流媒体、社交、地区自动测速等策略组 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Shadowrocket_LazyGroup_Merged.conf` |
| **大一统精简版** | 规则相同，只有 PROXY / DIRECT 两种出口 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Shadowrocket_AllInOne_Ultimate.conf` |

**2. 去广告模块（配置 → 模块 → 右上角 + 添加）**

| 模块 | 地址 |
| :--- | :--- |
| **全量去广告（推荐，已含下面所有单 App 模块）** | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/adblock-ultimate.sgmodule` |
| 仅广告联盟拦截（纯分流层，无需证书，零额外延迟） | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/adblock.sgmodule` |

全量去广告需要 HTTPS 解密：配置文件 ⓘ → HTTPS 解密 → 生成并安装 CA 证书 → 系统设置 → 通用 → 关于本机 → 证书信任设置 中信任证书。

> 从 v2 升级后，请把 **酷安、闲鱼** 各删除重装一次（或清除缓存）：它们会缓存旧的开屏素材 / 调度结果。
> 全量模块与单 App 模块不要同时开启（内容重复）。

## 单 App / 其它模块（只想净化个别 App 时用，与全量模块二选一）

| 模块 | 地址 |
| :--- | :--- |
| 酷安 / 闲鱼 / 知乎 / 微博 / B站 / 小红书 / 贴吧 / 百度网盘 / 高德 / 网易云 / 喜马拉雅 / 起点 / 虎扑 / 航旅纵横 / 肯德基 / 麦当劳 / 完美电竞 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/<coolapk\|goofish\|zhihu\|weibo\|bilibili\|xiaohongshu\|tieba\|baidunetdisk\|amap\|netease\|ximalaya\|qidian\|hupu\|umetrip\|kfc\|mcdonald\|pwesports>.sgmodule` |
| 外链直跳 / Safari 网页去打扰 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/direct-link.sgmodule`、`https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/safari-clean.sgmodule` |
| AI 服务分流 / 海外常用分流（给使用其它分流配置的用户） | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/ai-services.sgmodule`、`https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/overseas-top500.sgmodule` |

抖音、TikTok、微信、BoxJs 等模块为独立维护的静态模块，见 `modules/`。

## 目录结构

```
src/
  meta.js          版本号、CDN 地址
  profile.js       [General] / [Proxy Group] / [Host]
  rules/00,20-99   分流规则分段（进主配置）
  rules/10-adblock 广告联盟拦截（进去广告模块）
  apps/*.js        每个 App 的去广告规则 / 重写 / 脚本 / MITM（进全量模块和单 App 模块）
modules/scripts/   脚本
scripts/build.js   生成两个分流配置与全部模块
tests/             校验与脚本行为测试
```

```bash
npm run build   # 修改 src/ 后重新生成
npm test        # 产物同步、正则、MITM 安全边界、脚本行为
```
