/**
 * 抖音网页版 Safari 无水印原图与原画提取脚本
 * 机制：仅在 Safari 浏览器中拦截 www.douyin.com 页面，解析 HTML 内的无水印原图(图集)与无水印视频播放流，
 *       注入极简浮窗一键下载。
 * 优势：绝对不解密 amemv.com 与 snssdk.com，对手机抖音 App 零侵入、零污染，评论区 100% 正常！
 * 作者: allofights
 */

(function douyinWebMedia() {
    if (typeof $response === "undefined" || !$response.body) {
        $done({});
        return;
    }

    try {
        let html = $response.body;

        // 提取 RENDER_DATA 或 _ROUTER_DATA
        let match = html.match(/<script id="RENDER_DATA"[^>]*>([\s\S]*?)<\/script>/) ||
                    html.match(/window\._ROUTER_DATA\s*=\s*(\{[\s\S]*?\});<\/script>/);

        let mediaData = null;
        if (match && match[1]) {
            try {
                let rawJson = decodeURIComponent(match[1].trim());
                mediaData = JSON.parse(rawJson);
            } catch (e) {
                try {
                    mediaData = JSON.parse(match[1].trim());
                } catch (e2) {}
            }
        }

        // 递归检索 images 或 video play_addr
        let unwatermarkedImages = [];
        let unwatermarkedVideo = null;

        function findMedia(obj) {
            if (!obj || typeof obj !== "object") return;
            // 图集原图
            if (Array.isArray(obj.images)) {
                obj.images.forEach(img => {
                    if (img.url_list && img.url_list[0]) {
                        unwatermarkedImages.push(img.url_list[0]);
                    }
                });
            }
            // 视频流
            if (obj.play_addr && Array.isArray(obj.play_addr.url_list)) {
                let vUrl = obj.play_addr.url_list[0];
                if (typeof vUrl === "string") {
                    unwatermarkedVideo = vUrl.replace("/playwm/", "/play/");
                }
            }
            for (let k in obj) {
                if (typeof obj[k] === "object") findMedia(obj[k]);
            }
        }

        if (mediaData) {
            findMedia(mediaData);
        }

        // 注入移动端极简提取工具条 (仅在 Safari 显示)
        if (unwatermarkedImages.length > 0 || unwatermarkedVideo) {
            let injectHtml = `
            <div id="douyin-clean-bar" style="position:fixed;top:12px;left:12px;right:12px;z-index:999999;background:rgba(20,20,25,0.92);backdrop-filter:blur(20px);padding:14px 18px;border-radius:18px;box-shadow:0 8px 32px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.15);font-family:-apple-system,sans-serif;color:#fff;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <span style="font-weight:700;font-size:15px;color:#00e5ff;">✨ 已就绪：无水印原画提取</span>
                    <span style="font-size:12px;color:#aaa;" onclick="document.getElementById('douyin-clean-bar').remove()">关闭 ✕</span>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
            `;

            if (unwatermarkedImages.length > 0) {
                injectHtml += `
                    <button onclick="window.__openAllImages()" style="flex:1;min-width:140px;background:#fe2c55;color:#fff;border:none;padding:10px 14px;border-radius:10px;font-weight:600;font-size:13px;cursor:pointer;">
                        🖼️ 查看并直存原图 (${unwatermarkedImages.length}张)
                    </button>
                `;
            }

            if (unwatermarkedVideo) {
                injectHtml += `
                    <a href="${unwatermarkedVideo}" target="_blank" download="douyin.mp4" style="flex:1;min-width:140px;background:#25f4ee;color:#000;text-decoration:none;text-align:center;padding:10px 14px;border-radius:10px;font-weight:700;font-size:13px;display:inline-block;">
                        🎬 直存 1080P/4K 无水印视频
                    </a>
                `;
            }

            injectHtml += `
                </div>
                <script>
                    window.__openAllImages = function() {
                        const imgs = ${JSON.stringify(unwatermarkedImages)};
                        imgs.forEach(url => window.open(url, '_blank'));
                    };
                </script>
            </div>
            `;

            html = html.replace("</body>", injectHtml + "</body>");
            $done({ body: html });
            return;
        }

        $done({});
    } catch (e) {
        $done({});
    }
})();
