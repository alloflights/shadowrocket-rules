/**
 * 知乎 (Zhihu) 深度纯净版脚本
 * 
 * 核心特性：
 * 1. 拦截开屏硬广与开屏落地页配置 (real_time_launch_v2)
 * 2. 彻底过滤首页推荐流中的伪装广告卡片、商业合作问答与带货专栏 (topstory/recommend)
 * 3. 移除问题回答列表中的商业广告卡片与置顶营销 (questions/answers)
 * 4. 清除回答与专栏文章底部的推广卡片 (recommendations)
 * 5. 移除首页悬浮营销球与活动弹窗 (app_float_layer)
 * 
 * 遵循: Ponytail 极简原则
 * 作者: allofights
 */

(function zhihuPro() {
    const url = $request.url;
    if (typeof $response === "undefined" || !$response.body) {
        $done({});
        return;
    }

    try {
        let body = JSON.parse($response.body);

        // 1. 开屏广告拦截
        if (url.includes("/commercial_api/real_time_launch_v2")) {
            if (body.launch) {
                try {
                    let launch = JSON.parse(body.launch);
                    launch.ads = [];
                    body.launch = JSON.stringify(launch);
                } catch (err) {
                    body.launch = "{}";
                }
            }
        }
        // 2. 首页悬浮营销图标与活动弹层
        else if (url.includes("/commercial_api/app_float_layer")) {
            body = {};
        }
        // 3. 首页推荐流广告过滤 (topstory/recommend)
        else if (url.includes("/topstory/recommend")) {
            if (Array.isArray(body.data)) {
                body.data = body.data.filter(item => !isZhihuFeedAd(item));
            }
        }
        // 4. 问题回答列表过滤 (questions/.../answers 或 questions/.../feeds)
        else if (url.includes("/questions/") || url.includes("/v4/questions/")) {
            body.ad_info = null;
            delete body.ad_info;
            if (Array.isArray(body.data)) {
                body.data = body.data.filter(item => {
                    if (item.type === "feed_advert" || item.type === "commercial") return false;
                    if (item.ad || item.ad_info) return false;
                    return true;
                });
            }
        }
        // 5. 回答页与专栏文章底部的商业推荐
        else if (url.includes("/answers/") && url.includes("/recommendations")) {
            body.data = [];
            body.paging = null;
        }
        else if (url.includes("/articles/") && url.includes("/recommendation")) {
            body.ad_info = null;
            delete body.ad_info;
            if (Array.isArray(body.data)) {
                body.data = [];
            }
        }
        // 6. 配置中心拦截备用广告路由
        else if (url.includes("/v3/config")) {
            if (body.config?.zhcnh_thread_sync?.ZHBackUpIP_Switch_Open) {
                body.config.zhcnh_thread_sync.ZHBackUpIP_Switch_Open = "0";
            }
        }

        $done({ body: JSON.stringify(body) });
    } catch (e) {
        $done({});
    }

    /**
     * 判断是否为知乎推荐流商业广告
     */
    function isZhihuFeedAd(item) {
        if (!item) return false;

        // 显式广告类型
        if (item.type === "feed_advert" || item.type === "market_card" || item.type === "commercial" || item.type === "banner") {
            return true;
        }

        // 带有广告标志或投放元数据
        if (item.ad_info || item.ad || item.extra?.is_ad || item.card_type === "slot_event_card") {
            return true;
        }

        // 目标对象标记为商业广告
        if (item.target?.type === "advert") {
            return true;
        }

        // 商业合作伪装帖
        if (item.fields?.header?.url?.includes("commercial") || item.fields?.header?.url?.includes("market")) {
            return true;
        }

        return false;
    }
})();
