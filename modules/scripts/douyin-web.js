/**
 * 抖音分享链接与网页版无水印原画直存脚本（App 零侵入安全方案）
 *
 * 适用域名：
 * - www.iesdouyin.com/share/(video|note|slides)/... （抖音 App 复制链接 v.douyin.com 重定向后的真实落地页）
 * - m.douyin.com/share/(video|note|slides)/...
 * - www.douyin.com/(video|note)/...
 *
 * 核心设计：
 * - 绝不触碰抖音 App 内部 amemv.com / snssdk.com 通信，100% 保障 App 评论区、关注流与直播正常；
 * - 自动解析页面内 RENDER_DATA / _ROUTER_DATA / SIGI_STATE，将 playwm? / playwm/ 规范化为无水印 play 流，
 *   并支持通过 video_id (uri) 构造 1080P 无水印直链；
 * - 注入顶部悬浮直存栏，支持一键打开/下载无水印视频，以及展开内嵌高清原图列表（直接长按图片即可存储到相册，
 *   彻底解决 iOS Safari 拦截多窗口 window.open 弹窗导致无法保存多张图集的问题）。
 */

(function douyinWebMedia() {
    if (typeof $response === "undefined" || !$response.body) {
        $done({});
        return;
    }

    try {
        var html = String($response.body);
        var mediaData = extractPageData(html);
        if (!mediaData) {
            $done({});
            return;
        }

        var images = [];
        var videos = [];
        collectMedia(mediaData, images, videos);
        images = unique(images);
        videos = unique(videos);

        if (images.length === 0 && videos.length === 0) {
            $done({});
            return;
        }

        var injection = buildToolbar(images, videos);
        if (/<\/body>/i.test(html)) {
            html = html.replace(/<\/body>/i, injection + "</body>");
        } else {
            html += injection;
        }
        $done({ body: html });
    } catch (e) {
        $done({});
    }

    function extractPageData(source) {
        var match = source.match(/<script[^>]+id=["']RENDER_DATA["'][^>]*>([\s\S]*?)<\/script>/i);
        if (match && match[1]) {
            var raw = decodeMaybe(match[1].trim());
            try { return JSON.parse(raw); } catch (e) {}
        }

        var routerData = extractAssignedObject(source, "window._ROUTER_DATA");
        if (!routerData) routerData = extractAssignedObject(source, "self._ROUTER_DATA");
        if (routerData) return routerData;

        var hydrationIds = ["SIGI_STATE", "__UNIVERSAL_DATA_FOR_REHYDRATION__", "__NEXT_DATA__"];
        for (var i = 0; i < hydrationIds.length; i++) {
            var id = hydrationIds[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            var hydration = source.match(new RegExp("<script[^>]+id=[\"']" + id + "[\"'][^>]*>([\\s\\S]*?)</script>", "i"));
            if (hydration && hydration[1]) {
                try { return JSON.parse(decodeMaybe(hydration[1].trim())); } catch (e3) {}
            }
        }
        return null;
    }

    function decodeMaybe(raw) {
        try { return decodeURIComponent(raw); } catch (e) { return raw; }
    }

    function extractAssignedObject(source, marker) {
        var from = 0;
        while (from < source.length) {
            var markerAt = source.indexOf(marker, from);
            if (markerAt < 0) return null;
            var start = source.indexOf("{", markerAt + marker.length);
            if (start < 0) return null;
            var raw = readBalancedObject(source, start);
            if (raw) {
                try { return JSON.parse(raw); } catch (e) {}
            }
            from = start + 1;
        }
        return null;
    }

    function readBalancedObject(source, start) {
        var depth = 0;
        var quote = "";
        var escaped = false;
        for (var i = start; i < source.length; i++) {
            var ch = source.charAt(i);
            if (quote) {
                if (escaped) {
                    escaped = false;
                } else if (ch === "\\") {
                    escaped = true;
                } else if (ch === quote) {
                    quote = "";
                }
                continue;
            }
            if (ch === "\"" || ch === "'") {
                quote = ch;
            } else if (ch === "{") {
                depth++;
            } else if (ch === "}") {
                depth--;
                if (depth === 0) return source.slice(start, i + 1);
            }
        }
        return null;
    }

    function collectMedia(value, images, videos) {
        if (!value || typeof value !== "object") return;

        if (Array.isArray(value)) {
            for (var i = 0; i < value.length; i++) collectMedia(value[i], images, videos);
            return;
        }

        collectVideoAddress(value.play_addr, videos);
        collectVideoAddress(value.download_addr, videos);
        collectVideoAddress(value.video_play_addr, videos);

        if (Array.isArray(value.images)) {
            for (var j = 0; j < value.images.length; j++) {
                var image = value.images[j];
                if (!image || typeof image !== "object") continue;
                collectAddress(image, images);
                collectAddress(image.display_image, images);
                collectAddress(image.origin_image, images);
                if (image.video && image.video.play_addr) {
                    collectVideoAddress(image.video.play_addr, videos);
                }
            }
        }

        var keys = Object.keys(value);
        for (var k = 0; k < keys.length; k++) {
            var child = value[keys[k]];
            if (child && typeof child === "object") collectMedia(child, images, videos);
        }
    }

    function collectVideoAddress(address, output) {
        if (!address || typeof address !== "object") return;
        collectAddress(address, output);
        if (typeof address.uri === "string" && /^v0[0-9a-z]{10,}$/i.test(address.uri)) {
            output.push("https://aweme.snssdk.com/aweme/v1/play/?video_id=" + encodeURIComponent(address.uri) + "&ratio=1080p&line=0");
        }
    }

    function collectAddress(address, output) {
        if (!address || typeof address !== "object" || !Array.isArray(address.url_list)) return;
        for (var i = 0; i < address.url_list.length; i++) {
            if (typeof address.url_list[i] !== "string") continue;
            var url = address.url_list[i]
                .replace(/\/playwm(?=\/|\?|$)/g, "/play")
                .replace(/([?&])watermark=\d+/g, "$1watermark=0");
            if (/^https?:\/\//i.test(url)) output.push(url);
        }
    }

    function unique(list) {
        var out = [];
        var seen = {};
        for (var i = 0; i < list.length; i++) {
            if (!seen[list[i]]) {
                seen[list[i]] = true;
                out.push(list[i]);
            }
        }
        return out;
    }

    function escapeHtml(value) {
        return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function buildToolbar(images, videos) {
        var imageJson = JSON.stringify(images).replace(/</g, "\\u003c");
        var html = '<div id="douyin-clean-bar" style="position:fixed;top:12px;left:12px;right:12px;z-index:2147483647;background:rgba(18,18,24,.96);padding:14px 16px;border-radius:16px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#fff;box-shadow:0 10px 36px rgba(0,0,0,.6);max-height:85vh;overflow-y:auto">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><b style="color:#25f4ee;font-size:15px">✨ 已提取无水印原画媒体</b><button type="button" onclick="document.getElementById(\'douyin-clean-bar\').remove()" style="color:#aaa;background:none;border:0;font-size:20px;line-height:1;padding:0 4px">×</button></div>';
        html += '<div style="display:flex;gap:10px;flex-wrap:wrap">';

        if (images.length > 0) {
            html += '<button type="button" onclick="var g=document.getElementById(\'douyin-img-drawer\');if(g){g.style.display=g.style.display===\'none\'?\'grid\':\'none\';}window.__douyinOpenImages();" style="flex:1;min-width:140px;background:#fe2c55;color:#fff;border:0;padding:10px 14px;border-radius:10px;font-weight:600;font-size:14px">查看/保存原图（' + images.length + '张）</button>';
        }
        if (videos.length > 0) {
            html += '<a href="' + escapeHtml(videos[0]) + '" target="_blank" rel="noreferrer" download="douyin_clean.mp4" style="flex:1;min-width:140px;background:#25f4ee;color:#000;text-decoration:none;text-align:center;padding:10px 14px;border-radius:10px;font-weight:700;font-size:14px">打开无水印视频源</a>';
        }
        html += '</div>';

        if (images.length > 0) {
            html += '<div id="douyin-img-drawer" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:12px">';
            for (var idx = 0; idx < images.length; idx++) {
                html += '<a href="' + escapeHtml(images[idx]) + '" target="_blank" rel="noreferrer" style="display:block;text-decoration:none"><img src="' + escapeHtml(images[idx]) + '" style="width:100%;height:120px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,.15)" /><div style="color:#ccc;font-size:11px;text-align:center;margin-top:2px">长按图片存储原图 #' + (idx + 1) + '</div></a>';
            }
            html += '</div>';
        }

        html += '<script>window.__douyinOpenImages=function(){var xs=' + imageJson + ';if(xs.length===1){window.open(xs[0],"_blank");}};<\/script></div>';
        return html;
    }
})();
