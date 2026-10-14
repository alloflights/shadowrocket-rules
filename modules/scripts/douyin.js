/**
 * 抖音 (Douyin) App 深度无水印保存与信息流去广告脚本
 *
 * 核心能力：
 * 1. 视频无水印直存：强制将 download_addr 与 download_suffix_logo_addr 指向无水印高清 play_addr，
 *    将 playwm 规范化为 play，清除片尾抖音号水印贴片 (download_suffix_logo_addr / misc_download_addrs)；
 * 2. 解除下载限制与本地合成水印：置 prevent_download=false、allow_download=true，并将 aweme_acl
 *    下载策略的 transcode 设为 1（直接保存原始无水印流，禁止客户端在手机本地二次合成烧录水印）；
 * 3. 图集与实况 (LivePhoto) 无水印直存：将 image_post_info.images 中的 owner_watermark_image、
 *    user_watermark_image、download_image 全部替换为无水印原图 display_image；
 * 4. 信息流与详情页净化：递归剥离商业广告视频 (is_ads / raw_ad_data / aweme_type=34)、带货小黄车、
 *    商品锚点与直播强插卡片。
 *
 * 兼容 Shadowrocket / Surge / Loon / Quantumult X：纯 ES5 语法，零弹窗打扰。
 */

(function douyinPro() {
    var COMMERCE_KEYS = {
        "anchor_info": true,
        "anchors": true,
        "commerce_info": true,
        "commerce_data": true,
        "commerce_config_data": true,
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
        "promoted_other_live": true,
        "raw_ad_data": true,
        "ad_info": true
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

        if (isAweme(value)) {
            processAweme(value);
        }

        var keys = Object.keys(value);
        for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            if (COMMERCE_KEYS[key]) {
                delete value[key];
                continue;
            }
            if (value[key] && typeof value[key] === "object") {
                walk(value[key]);
            }
        }
    }

    function isAweme(item) {
        return !!(item && typeof item === "object" &&
            (item.aweme_id || item.aweme_type !== undefined || item.video || item.image_post_info || item.images));
    }

    function isDouyinAd(item) {
        if (!item || typeof item !== "object") return false;

        if (isEnabled(item.is_ads) || isEnabled(item.is_ad) || isEnabled(item.isAd) ||
            item.raw_ad_data || item.ad_info || item.ad_tag || item.commercial_video_info ||
            item.ad_aweme_source) {
            return true;
        }

        if (Number(item.aweme_type) === 34) return true;
        if (item.cell_room && item.cell_room.raw_ad_data) return true;
        if (item.live_window_show === true || item.promoted_other_live === true) return true;

        if (Array.isArray(item.card_entries)) {
            for (var i = 0; i < item.card_entries.length; i++) {
                var card = item.card_entries[i];
                if (card && (isEnabled(card.is_ad) || isEnabled(card.is_ads) ||
                    card.ad_info || card.raw_ad_data ||
                    (card.type === 1 && (card.ad_id || card.ad_info || card.raw_ad_data)))) {
                    return true;
                }
            }
        }
        return false;
    }

    function processAweme(item) {
        if (!item || typeof item !== "object") return;

        var keys = Object.keys(COMMERCE_KEYS);
        for (var i = 0; i < keys.length; i++) {
            delete item[keys[i]];
        }

        // 1. 解除作者禁止下载限制与客户端本地合成烧录水印策略 (transcode: 1 代表直接保存原流)
        item.prevent_download = false;
        if (item.status && typeof item.status === "object") {
            item.status.reviewed = 1;
            item.status.self_see = false;
        }
        if (item.video_control && typeof item.video_control === "object") {
            item.video_control.allow_download = true;
            item.video_control.prevent_download_type = 0;
            item.video_control.show_progress_bar = 1;
            item.video_control.draft_progress_bar = 1;
            item.video_control.allow_duet = true;
            item.video_control.allow_react = true;
        }
        if (item.aweme_acl && typeof item.aweme_acl === "object") {
            var directSaveAcl = {
                code: 0,
                show_type: 2,
                transcode: 1,
                mute: false
            };
            item.aweme_acl.download_general = directSaveAcl;
            item.aweme_acl.download_mask_panel = directSaveAcl;
            item.aweme_acl.download_share_panel = directSaveAcl;
        }

        // 2. 视频流无水印替换
        if (item.video && typeof item.video === "object") {
            normalizeVideo(item.video);
        }

        // 3. 图文 / 图集 / 实况照片无水印替换
        if (item.image_post_info && typeof item.image_post_info === "object") {
            normalizeImagePost(item.image_post_info);
        }
        if (Array.isArray(item.images)) {
            normalizeImageList(item.images);
        }
    }

    function normalizeVideo(video) {
        normalizeAddress(video.play_addr);
        normalizeAddress(video.play_addr_h264);
        normalizeAddress(video.play_addr_265);
        normalizeAddress(video.play_addr_bytevc1);
        normalizeAddress(video.download_addr);

        // 选择最高画质无水印播放源覆盖 download_addr 与片尾水印 logo 地址
        var bestCleanAddr = video.play_addr;
        if (Array.isArray(video.bit_rate) && video.bit_rate.length > 0) {
            for (var i = 0; i < video.bit_rate.length; i++) {
                if (video.bit_rate[i] && video.bit_rate[i].play_addr) {
                    normalizeAddress(video.bit_rate[i].play_addr);
                }
            }
            if (video.bit_rate[0] && video.bit_rate[0].play_addr &&
                Array.isArray(video.bit_rate[0].play_addr.url_list) &&
                video.bit_rate[0].play_addr.url_list.length > 0) {
                bestCleanAddr = video.bit_rate[0].play_addr;
            }
        }

        if (bestCleanAddr && Array.isArray(bestCleanAddr.url_list) && bestCleanAddr.url_list.length > 0) {
            video.download_addr = cloneAddress(bestCleanAddr);
            video.download_suffix_logo_addr = cloneAddress(bestCleanAddr);
        }

        video.has_watermark = false;
        video.has_download_suffix_logo_addr = false;
        delete video.misc_download_addrs;
    }

    function cloneAddress(addr) {
        if (!addr || typeof addr !== "object") return addr;
        try {
            return JSON.parse(JSON.stringify(addr));
        } catch (e) {
            return addr;
        }
    }

    function normalizeAddress(address) {
        if (!address || typeof address !== "object" || !Array.isArray(address.url_list)) return;
        for (var i = 0; i < address.url_list.length; i++) {
            if (typeof address.url_list[i] === "string") {
                address.url_list[i] = cleanMediaUrl(address.url_list[i]);
            }
        }
    }

    function cleanMediaUrl(rawUrl) {
        return rawUrl
            .replace(/\/playwm(?=\/|\?|$)/g, "/play")
            .replace(/([?&])watermark=\d+/g, "$1watermark=0")
            .replace(/([?&])logo_name=[^&]+/g, "");
    }

    function normalizeImagePost(info) {
        info.without_watermark = true;
        if (Array.isArray(info.images)) {
            normalizeImageList(info.images);
        }
    }

    function normalizeImageList(images) {
        for (var i = 0; i < images.length; i++) {
            var image = images[i];
            if (!image || typeof image !== "object") continue;
            if (image.display_image && typeof image.display_image === "object") {
                normalizeAddress(image.display_image);
            }
            if (image.origin_image && typeof image.origin_image === "object") {
                normalizeAddress(image.origin_image);
            }
            var cleanImg = (image.origin_image && Array.isArray(image.origin_image.url_list) && image.origin_image.url_list.length > 0)
                ? image.origin_image
                : image.display_image;
            if (cleanImg && typeof cleanImg === "object") {
                image.owner_watermark_image = cloneAddress(cleanImg);
                image.user_watermark_image = cloneAddress(cleanImg);
                image.download_image = cloneAddress(cleanImg);
            }
            if (image.video && typeof image.video === "object") {
                normalizeVideo(image.video);
            }
        }
    }

    function isEnabled(value) {
        return value === true || value === 1 || value === "1" || value === "true";
    }
})();
