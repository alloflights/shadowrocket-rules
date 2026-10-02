/**
 * 抖音 (Douyin) 深度纯净版与原画直存脚本
 * 
 * 核心特性：
 * 1. 拦截并过滤推荐流、同城、关注、搜索流中的商业广告视频、直播卡片与电商带货视频
 * 2. 剥离视频左下角带货小黄车、商品锚点、活动浮窗与营销打点
 * 3. 解除创作者下载限制 (allow_download = true, prevent_download_type = 0)
 * 4. 替换下载源为无水印原画播放流 (playwm -> play)
 * 5. 图集原图解除水印与限制
 * 
 * 遵循: Ponytail 极简原则
 * 作者: allofights
 */

(function douyinPro() {
    if (typeof $response === "undefined" || !$response.body) {
        $done({});
        return;
    }

    try {
        let body = JSON.parse($response.body);

        // 1. 推荐主流与各分流过滤 (aweme_list)
        if (body.aweme_list && Array.isArray(body.aweme_list)) {
            body.aweme_list = body.aweme_list.filter(item => !isDouyinAd(item));
            body.aweme_list.forEach(processAweme);
        }

        // 2. 单个视频详情页 (aweme_detail)
        if (body.aweme_detail) {
            processAweme(body.aweme_detail);
        }

        // 3. 批量视频详情 (aweme_details)
        if (body.aweme_details && Array.isArray(body.aweme_details)) {
            body.aweme_details = body.aweme_details.filter(item => !isDouyinAd(item));
            body.aweme_details.forEach(processAweme);
        }

        // 4. 搜索结果与聚合流 (data / itemList)
        if (body.data && Array.isArray(body.data)) {
            body.data = body.data.filter(entry => {
                if (entry.aweme) {
                    if (isDouyinAd(entry.aweme)) return false;
                    processAweme(entry.aweme);
                }
                return true;
            });
        }

        if (body.itemList && Array.isArray(body.itemList)) {
            body.itemList = body.itemList.filter(item => !isDouyinAd(item));
            body.itemList.forEach(processAweme);
        }

        $done({ body: JSON.stringify(body) });
    } catch (e) {
        $done({});
    }

    /**
     * 判断是否为抖音广告视频或电商带货视频
     */
    function isDouyinAd(item) {
        if (!item) return false;

        // 硬性标记广告
        if (item.is_ads || item.raw_ad_data || item.ad_info || item.ad_tag) return true;

        // 广告视频类型 (aweme_type: 34 为常规广告视频, 2 为直播推广卡片)
        if (item.aweme_type === 34 || item.aweme_type === 2) return true;

        // 商业化与巨量星图推广视频
        if (item.commercial_video_info) return true;
        if (item.cell_room && item.cell_room.raw_ad_data) return true;
        if (item.live_window_show) return true;
        if (item.promoted_other_live) return true;

        // 强行插入的营销电商卡片
        if (item.card_entries && item.card_entries.some(c => c.type === 1)) return true;

        return false;
    }

    /**
     * 深度净化常规视频：剥离小黄车与带货锚点，解除下载限制，替换无水印流
     */
    function processAweme(item) {
        if (!item) return;

        // 1. 彻底移除小黄车、商品带货锚点与优惠券浮窗
        delete item.anchor_info;
        delete item.anchors;
        delete item.commerce_info;
        delete item.commerce_data;
        delete item.interaction_stickers;
        delete item.card_entries;
        delete item.coupon_info;
        delete item.yellow_cart;
        delete item.goods_info;
        delete item.products;
        delete item.ad_order_id;
        delete item.commercial_video_info;

        // 2. 解除保存与下载权限限制
        item.prevent_download = false;
        if (item.status) {
            item.status.reviewed = 1;
        }
        if (item.video_control) {
            item.video_control.allow_download = true;
            item.video_control.prevent_download_type = 0;
            item.video_control.share_type = 0;
        }

        // 3. 视频源去水印与原画直存 (playwm -> play)
        if (item.video) {
            delete item.video.misc_download_addrs;
            if (item.video.play_addr && Array.isArray(item.video.play_addr.url_list)) {
                item.video.play_addr.url_list = item.video.play_addr.url_list.map(u => 
                    typeof u === "string" ? u.replace("/playwm/", "/play/") : u
                );
                item.video.download_addr = item.video.play_addr;
                item.video.download_suffix_logo_addr = item.video.play_addr;
            }
            item.video.has_watermark = false;
        }

        // 4. 权限面板解除限制
        if (item.aweme_acl && item.aweme_acl.download_general) {
            item.aweme_acl.download_general.mute = false;
            if (item.aweme_acl.download_general.extra) {
                delete item.aweme_acl.download_general.extra;
                item.aweme_acl.download_general.code = 0;
                item.aweme_acl.download_general.show_type = 2;
                item.aweme_acl.download_general.transcode = 3;
                item.aweme_acl.download_mask_panel = item.aweme_acl.download_general;
                item.aweme_acl.share_general = item.aweme_acl.download_general;
            }
        }

        // 5. 图集原图去水印
        if (item.image_post_info && Array.isArray(item.image_post_info.images)) {
            item.image_post_info.images.forEach(img => {
                if (img.display_image) {
                    img.owner_watermark_image = img.display_image;
                    img.user_watermark_image = img.display_image;
                }
            });
            item.without_watermark = true;
        }
    }
})();
