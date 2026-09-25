/**
 * 抖音 (Douyin) 视频无水印原画直存与免限制脚本
 * 功能：
 * 1. 解除创作者下载限制 (allow_download = true, prevent_download_type = 0)
 * 2. 替换下载源为无水印高清播放流 (playwm -> play)
 * 3. 解除图集水印，替换为原始原图
 * 4. 过滤流内广告推荐
 * 遵循: Ponytail 极简原则
 * 作者: allofights
 */

(function douyinClean() {
    if (typeof $response === "undefined" || !$response.body) {
        $done({});
        return;
    }

    try {
        let body = JSON.parse($response.body);

        if (body.aweme_list && Array.isArray(body.aweme_list)) {
            body.aweme_list = body.aweme_list.filter(item => !item.is_ads);
            body.aweme_list.forEach(processAweme);
        }

        if (body.aweme_detail) {
            processAweme(body.aweme_detail);
        }

        if (body.aweme_details && Array.isArray(body.aweme_details)) {
            body.aweme_details.forEach(processAweme);
        }

        if (body.data && Array.isArray(body.data)) {
            body.data.forEach(entry => {
                if (entry.aweme) processAweme(entry.aweme);
            });
        }

        if (body.itemList && Array.isArray(body.itemList)) {
            body.itemList.forEach(processAweme);
        }

        $done({ body: JSON.stringify(body) });
    } catch (e) {
        $done({});
    }

    function processAweme(item) {
        if (!item) return;

        // 解除保存权限限制
        item.prevent_download = false;
        if (item.status) {
            item.status.reviewed = 1;
        }
        if (item.video_control) {
            item.video_control.allow_download = true;
            item.video_control.prevent_download_type = 0;
        }

        // 视频源去水印与原画直存
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

        // 权限面板解除限制
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

        // 图集原图去水印
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
