/**
 * 百度贴吧 (Tieba) JSON 深度无感净化脚本
 *
 * 核心能力：
 * 1. 开屏广告 (c/f/ad/getSplashAd)：置 error_code=2230209 并清空 data，秒过开屏；
 * 2. 看图模式广告 (tiebaads/commonbatch)：清空 res.ad 数组；
 * 3. 全局配置同步 (c/s/sync)：清空右下角悬浮图标、回帖栏广告、外部 ABTest，
 *    禁用穿山甲(csj)/广点通(gdt)/快手(ks)/百青藤(bqt)/优效/Ubix/华为等第三方 SDK 初始化开关；
 * 4. 吧内列表与详情页 (frs/page, threadlist, pb/page, personalized)：剥离直播强插帖、带货 goods_info 与顶部商业横幅；
 * 5. 100% 静默无感运行：彻底移除全部 $notification.post 报错弹窗，配备完整 try/catch 与空包早退保护。
 */

(function tiebaJsonPro() {
    var request = (typeof $request !== "undefined" && $request) ? $request : null;
    var url = (request && request.url) ? String(request.url) : "";
    var hasResponse = typeof $response !== "undefined" && $response;

    if (!hasResponse || !$response.body) {
        $done({});
        return;
    }

    try {
        var body = JSON.parse($response.body);
        if (!body || typeof body !== "object") {
            $done({});
            return;
        }

        if (url.indexOf("c/f/ad/getSplashAd") !== -1) {
            body.error_code = 2230209;
            body.data = null;
        } else if (url.indexOf("tiebaads/commonbatch") !== -1) {
            if (body.res && Array.isArray(body.res.ad)) {
                body.res.ad = [];
            }
        } else if (url.indexOf("c/f/pb/picpage") !== -1) {
            if (Array.isArray(body.recom_live_list)) {
                body.recom_live_list = [];
            }
        } else if (url.indexOf("c/s/sync") !== -1) {
            if ("floating_icon" in body) {
                body.floating_icon = null;
            }
            if ("advertisement_config" in body) {
                body.advertisement_config = null;
            }
            if (body.cloud_control_data_info &&
                body.cloud_control_data_info.common_config &&
                body.cloud_control_data_info.common_config.external_abtest_switch) {
                body.cloud_control_data_info.common_config.external_abtest_switch = null;
            }
            if (body.config && Array.isArray(body.config.switch)) {
                var blockSdkSwitches = {
                    "platform_csj_init": true,
                    "platform_ks_init": true,
                    "platform_gdt_init": true,
                    "platform_baidu_bqt_init": true,
                    "platform_jy_init": true,
                    "platform_ubix_init": true,
                    "platform_hw_init": true,
                    "ad_baichuan_open": true
                };
                for (var i = 0; i < body.config.switch.length; i++) {
                    var item = body.config.switch[i];
                    if (item && blockSdkSwitches[item.name]) {
                        item.type = "0";
                    }
                }
            }
            if (body.screen_fill_data_result && typeof body.screen_fill_data_result === "object") {
                body.screen_fill_data_result.screen_fill_advertisement_bear_switch = "0";
                body.screen_fill_data_result.screen_fill_advertisement_plj_cpc_switch = "0";
                body.screen_fill_data_result.screen_fill_advertisement_plj_switch = "0";
            }
            if ("ad_stlog_switch" in body) {
                body.ad_stlog_switch = "0";
            }
            if (body.lcs_strategy && typeof body.lcs_strategy === "object") {
                body.lcs_strategy.conn_conf = "1";
            }
        } else if (url.indexOf("c/f/frs/page") !== -1) {
            if (Array.isArray(body.live_fuse_forum)) {
                body.live_fuse_forum = [];
            }
            if (body.activityhead && body.activityhead.is_ad) {
                body.activityhead = {};
            }
            body.thread_list = removeLiveAndAds(body.thread_list);
            if (body.forum && body.forum.banner_list) {
                removeGoodsInfo(body.forum.banner_list.app);
            }
        } else if (url.indexOf("c/f/frs/threadlist") !== -1) {
            body.thread_list = removeLiveAndAds(body.thread_list);
            if (body.banner_list) {
                removeGoodsInfo(body.banner_list.app);
            }
        } else if (url.indexOf("c/f/pb/page") !== -1) {
            if (body.recom_ala_info && body.recom_ala_info.live_id) {
                body.recom_ala_info = null;
            }
            if (Array.isArray(body.post_list)) {
                for (var p = 0; p < body.post_list.length; p++) {
                    if (body.post_list[p] && body.post_list[p].outer_item) {
                        body.post_list[p].outer_item = null;
                    }
                }
            }
            if (body.banner_list) {
                removeGoodsInfo(body.banner_list.app);
                if (body.banner_list.pb_banner_ad && Array.isArray(body.banner_list.pb_banner_ad.goods_info)) {
                    body.banner_list.pb_banner_ad.goods_info = [];
                }
            }
        } else if (url.indexOf("c/f/excellent/personalized") !== -1) {
            if (body.banner_list) {
                removeGoodsInfo(body.banner_list.app);
            }
            body.thread_list = removeLiveAndAds(body.thread_list);
            if (body.live_answer) {
                body.live_answer = null;
            }
        } else if (url.indexOf("c/f/frs/generalTabList") !== -1) {
            removeGoodsInfo(body.app_list);
        }

        $done({ body: JSON.stringify(body) });
    } catch (e) {
        $done({});
    }

    function removeGoodsInfo(app) {
        if (!Array.isArray(app)) return;
        for (var i = 0; i < app.length; i++) {
            if (app[i] && Array.isArray(app[i].goods_info)) {
                app[i].goods_info = [];
            }
        }
    }

    function removeLiveAndAds(threadList) {
        if (!Array.isArray(threadList)) return threadList;
        return threadList.filter(function (item) {
            if (!item || typeof item !== "object") return false;
            if (item.ala_info || item.ad_info || item.is_ad === 1 || item.is_ad === true) {
                return false;
            }
            return true;
        });
    }
})();
