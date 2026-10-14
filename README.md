# Shadowrocket 规则与去广告模块

iPhone 专用的无感分流配置与去广告模块库，零弹窗、支持国内外主流应用与流媒体净化。

## 推荐配置组合（1 主配置 + 2 核心模块）

### 1. 主分流配置文件（配置 → 添加配置）
* **主力定制分流配置**：`https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Shadowrocket_LazyGroup_Merged.conf`
* **大一统独立配置（备选）**：`https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Shadowrocket_AllInOne_Ultimate.conf`

### 2. 核心功能模块（配置 → 模块 → 右上角 `+`）
* **全量无感去广告总模块**：`https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/adblock-ultimate.sgmodule`
* **抖音无水印提取器**：`https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/douyin-watermark.sgmodule`

## 独立按需模块

| 模块 | 说明 | 链接 |
| :--- | :--- | :--- |
| **酷安净化** | 消除开屏残留与信息流空白广告框 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/coolapk.sgmodule` |
| **X (Twitter) 净化** | 过滤时间线推广推文、评论区与热搜广告 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/twitter.sgmodule` |
| **YouTube 净化** | Protobuf + JSON 双引擎去广告与贴片拦截 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/youtube.sgmodule` |
| **百度网盘净化** | 开屏秒过、隐藏短剧与福利卡片 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/baidunetdisk.sgmodule` |
| **完美世界电竞净化** | 屏蔽开屏广告与社区/赛事推广横幅 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/pwesports.sgmodule` |
| **知乎净化** | 剥离信息流、热榜与回答区商业卡片 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/zhihu.sgmodule` |
| **AI 智能体分流** | OpenAI / Claude / Gemini / Grok / Cursor 分流 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/ai-services.sgmodule` |
| **外链直接跳转** | 自动跳过知乎/掘金/简书/微博/CSDN 外链拦截页 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/direct-link.sgmodule` |
| **Safari 纯净浏览** | 去除网页诱导打开 App 遮罩并自动展开全文 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/safari-clean.sgmodule` |

## 本地构建与校验

```bash
npm run build   # 同步生成主配置与聚合模块
npm test        # 运行语法与规则一致性检查
```
