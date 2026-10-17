# Shadowrocket 规则与去广告模块

iPhone 专用的无感分流配置与去广告模块库。

## 主分流配置

* **主力定制分流配置**：`https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Shadowrocket_LazyGroup_Merged.conf`
* **大一统独立配置（备选）**：`https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/Shadowrocket_AllInOne_Ultimate.conf`

## 全量去广告模块

* **全量无感去广告总模块**：`https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/adblock-ultimate.sgmodule`
  * 拦截 App 开屏与信息流广告、摇一摇跳转及广告联盟请求，内置主流应用深度净化。

## 独立按需模块

| 模块 | 功能 | 链接 |
| :--- | :--- | :--- |
| **AI 智能体分流** | OpenAI / Claude / Gemini / Grok / Cursor 分流 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/ai-services.sgmodule` |
| **外链直接跳转** | 自动跳过知乎/掘金/简书/微博/CSDN 外链拦截页 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/direct-link.sgmodule` |
| **Safari 纯净浏览** | 去除网页诱导打开 App 遮罩并自动展开全文 | `https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/safari-clean.sgmodule` |

## 本地构建与校验

```bash
npm run build   # 同步生成主配置与聚合模块
npm test        # 运行语法与规则一致性检查
```
