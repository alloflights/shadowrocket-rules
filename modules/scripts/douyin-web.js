/**
 * 抖音网页版媒体提取脚本（仅 www.douyin.com）
 *
 * 从页面内公开的 RENDER_DATA / _ROUTER_DATA 提取已有媒体地址：
 * - 图集优先使用接口返回的 url_list；
 * - 视频只把 playwm 路径规范化为 play，不伪造不存在的 URL；
 * - 不触碰抖音 App 的 amemv/snssdk 请求，也不绕过登录、权限或私密内容。
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

    // _ROUTER_DATA 往往包含多层对象，非贪婪正则会在第一个内部 “}” 处截断。
    // 这里按 JSON 字符串状态做括号平衡扫描，不使用 eval，也不执行页面脚本。
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

        collectAddress(value.play_addr, videos);
        collectAddress(value.download_addr, videos);
        collectAddress(value.video_play_addr, videos);

        if (Array.isArray(value.images)) {
            for (var j = 0; j < value.images.length; j++) {
                var image = value.images[j];
                if (!image || typeof image !== "object") continue;
                collectAddress(image, images);
                collectAddress(image.display_image, images);
                collectAddress(image.origin_image, images);
            }
        }

        var keys = Object.keys(value);
        for (var k = 0; k < keys.length; k++) {
            var child = value[keys[k]];
            if (child && typeof child === "object") collectMedia(child, images, videos);
        }
    }

    function collectAddress(address, output) {
        if (!address || typeof address !== "object" || !Array.isArray(address.url_list)) return;
        for (var i = 0; i < address.url_list.length; i++) {
            if (typeof address.url_list[i] !== "string") continue;
            var url = address.url_list[i].replace(/\/playwm(?=\/|$)/g, "/play");
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
        var html = '<div id="douyin-clean-bar" style="position:fixed;top:12px;left:12px;right:12px;z-index:999999;background:rgba(20,20,25,.94);padding:14px 18px;border-radius:18px;font-family:-apple-system,sans-serif;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,.5)">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><b style="color:#00e5ff">已提取公开媒体地址</b><button type="button" onclick="document.getElementById(\'douyin-clean-bar\').remove()" style="color:#aaa;background:none;border:0;font-size:16px">×</button></div>';
        html += '<div style="display:flex;gap:10px;flex-wrap:wrap">';

        if (images.length > 0) {
            html += '<button type="button" onclick="window.__douyinOpenImages()" style="flex:1;min-width:150px;background:#fe2c55;color:#fff;border:0;padding:10px 14px;border-radius:10px;font-weight:600">查看/保存原图（' + images.length + '张）</button>';
        }
        if (videos.length > 0) {
            html += '<a href="' + escapeHtml(videos[0]) + '" target="_blank" rel="noreferrer" download="douyin.mp4" style="flex:1;min-width:150px;background:#25f4ee;color:#000;text-decoration:none;text-align:center;padding:10px 14px;border-radius:10px;font-weight:700">打开视频源</a>';
        }
        html += '</div><script>window.__douyinOpenImages=function(){var xs=' + imageJson + ';for(var i=0;i<xs.length;i++){window.open(xs[i],"_blank");}};<\/script></div>';
        return html;
    }
})();
