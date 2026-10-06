/**
 * 抖音 API 响应净化与媒体地址规范化脚本
 *
 * 设计边界：
 * - 只处理已经被 Shadowrocket 解密并交给脚本的 JSON 响应；不会绕过账号权限、私密内容或服务端水印。
 * - 去水印仅把接口已经返回的 playwm 播放地址规范化为 play 地址；如果服务端没有提供可用源，脚本不会伪造地址。
 * - 不修改 prevent_download、aweme_acl 或审核状态；下载权限仍由服务端和客户端策略决定。
 * - 递归清除明确标记的广告/带货对象，避免用 DOMAIN-KEYWORD 等宽规则误伤正常直播与视频流。
 *
 * 兼容 Shadowrocket/Scripting runtime：不依赖 Node API，使用 ES5 语法。
 */

(function douyinPro() {
    var COMMERCE_KEYS = {
        "anchor_info": true,
        "anchors": true,
        "commerce_info": true,
        "commerce_data": true,
        "interaction_stickers": true,
        "card_entries": true,
        "coupon_info": true,
        "yellow_cart": true,
        "goods_info": true,
        "products": true,
        "product_info": true,
        "product_info_list": true,
        "shop_info": true,
        "ecommerce_info": true,
        "ad_order_id": true,
        "commercial_video_info": true,
        "live_window_show": true,
        "promoted_other_live": true
    };

    if (typeof $response === "undefined" || !$response.body) {
        $done({});
        return;
    }

    try {
        var body = JSON.parse($response.body);
        walk(body);
        $done({ body: JSON.stringify(body) });
    } catch (e) {
        // 非 JSON、二进制或压缩响应保持原样，不制造空响应。
        $done({});
    }



    function walk(value) {
        if (!value || typeof value !== "object") return;

        if (Array.isArray(value)) {
            var kept = [];
            for (var i = 0; i < value.length; i++) {
                var item = value[i];
                if (!item || isDouyinAd(item)) continue;
                walk(item);
                kept.push(item);
            }
            value.length = 0;
            for (var j = 0; j < kept.length; j++) value.push(kept[j]);
            return;
        }

        if (isAweme(value)) processAweme(value);

        var keys = Object.keys(value);
        for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            if (COMMERCE_KEYS[key]) {
                delete value[key];
                continue;
            }
            if (value[key] && typeof value[key] === "object") walk(value[key]);
        }
    }

    function isAweme(item) {
        return !!(item && typeof item === "object" &&
            (item.aweme_id || item.aweme_type !== undefined || item.video || item.image_post_info));
    }

    function isDouyinAd(item) {
        if (!item || typeof item !== "object") return false;

        // 明确的广告/商业化标记。
        if (isEnabled(item.is_ads) || isEnabled(item.is_ad) || isEnabled(item.isAd) ||
            item.raw_ad_data || item.ad_info || item.ad_tag || item.commercial_video_info) {
            return true;
        }

        // 抖音广告视频类型；不要把所有直播卡片都当广告删除。
        if (Number(item.aweme_type) === 34) return true;
        if (item.cell_room && item.cell_room.raw_ad_data) return true;
        if (item.live_window_show === true || item.promoted_other_live === true) return true;

        if (Array.isArray(item.card_entries)) {
            for (var i = 0; i < item.card_entries.length; i++) {
                var card = item.card_entries[i];
                if (card && (isEnabled(card.is_ad) || isEnabled(card.is_ads) ||
                    card.ad_info || card.raw_ad_data ||
                    (card.type === 1 && (card.ad_id || card.ad_info || card.raw_ad_data)))) return true;
            }
        }
        return false;
    }

    function processAweme(item) {
        if (!item || typeof item !== "object") return;

        // 保留正常视频主体，只移除商业挂件和营销浮层。
        var keys = Object.keys(COMMERCE_KEYS);
        for (var i = 0; i < keys.length; i++) delete item[keys[i]];

        // 不伪造下载权限或审核状态，只使用服务端已经下发的公开媒体地址。

        if (item.video && typeof item.video === "object") {
            normalizeVideo(item.video);
        }
        if (item.image_post_info && typeof item.image_post_info === "object") {
            normalizeImagePost(item.image_post_info);
        }
    }

    function normalizeVideo(video) {
        var play = video.play_addr;
        var download = video.download_addr;

        normalizeAddress(play);
        normalizeAddress(download);

        // 仅在服务端没有给 download_addr 时复用已下发的 play_addr；
        // 不覆盖服务端的下载权限、签名或质量选择，也不伪造“无水印”状态。
        if (play && Array.isArray(play.url_list) && play.url_list.length > 0 &&
            (!download || !Array.isArray(download.url_list) || download.url_list.length === 0)) {
            video.download_addr = play;
        }

        if (Array.isArray(video.bit_rate)) {
            for (var i = 0; i < video.bit_rate.length; i++) {
                if (video.bit_rate[i] && video.bit_rate[i].play_addr) {
                    normalizeAddress(video.bit_rate[i].play_addr);
                }
            }
        }
    }

    function normalizeAddress(address) {
        if (!address || typeof address !== "object" || !Array.isArray(address.url_list)) return;
        for (var i = 0; i < address.url_list.length; i++) {
            if (typeof address.url_list[i] === "string") {
                address.url_list[i] = address.url_list[i].replace(/\/playwm(?=\/|$)/g, "/play");
            }
        }
    }

    function isEnabled(value) {
        return value === true || value === 1 || value === "1" || value === "true";
    }

    function normalizeImagePost(info) {
        if (!Array.isArray(info.images)) return;
        for (var i = 0; i < info.images.length; i++) {
            var image = info.images[i];
            if (!image || typeof image !== "object") continue;
            if (image.display_image && typeof image.display_image === "object") {
                normalizeAddress(image.display_image);
            }
            if (image.origin_image && typeof image.origin_image === "object") {
                normalizeAddress(image.origin_image);
            }
        }
    }
})();
