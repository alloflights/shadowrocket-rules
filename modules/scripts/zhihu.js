/**
 * 知乎 (Zhihu) 深度纯净版脚本 (2026 真机抓包对齐版)
 * 
 * 核心特性 (基于 2026-10-02 真实抓包对齐)：
 * 1. 拦截新版开屏与广告样式服务 (ad-style-service/launch_animation & ad-style-service/request)
 * 2. 拦截并过滤新版信息流聚合根接口 (feed-root/sections/query/v2 & feed-root/block)
 * 3. 彻底过滤推荐流伪装广告与营销专栏 (topstory/recommend & v4/topstory/recommend)
 * 4. 移除问题回答列表中的商业卡片 (questions/answers)
 * 5. 拦截商业资源下发 (appcloud2/v3/resource?group_name=commerce)
 * 6. 移除首页悬浮球 (commercial_api/app_float_layer)
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

        // 1. 新版广告样式与开屏动画服务 (2026 抓包捕获)
        if (url.includes("/ad-style-service/")) {
            body = { code: 0, message: "success", data: [] };
        }
        // 2. 旧版开屏广告兜底
        else if (url.includes("/commercial_api/real_time_launch")) {
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
        // 3. 首页悬浮营销球与活动弹窗
        else if (url.includes("/commercial_api/app_float_layer")) {
            body = {};
        }
        // 4. 新版信息流聚合根接口 (2026 抓包捕获：feed-root/sections/query/v2)
        else if (url.includes("/feed-root/")) {
            if (Array.isArray(body.data)) {
                body.data = body.data.filter(item => !isZhihuFeedAd(item));
            }
            if (Array.isArray(body.sections)) {
                body.sections = body.sections.filter(sec => {
                    if (sec.type === "commercial" || sec.section_type === "ad") return false;
                    if (Array.isArray(sec.items)) sec.items = sec.items.filter(item => !isZhihuFeedAd(item));
                    if (Array.isArray(sec.elements)) sec.elements = sec.elements.filter(item => !isZhihuFeedAd(item));
                    return true;
                });
            }
        }
        // 5. 经典首页推荐流过滤 (topstory/recommend)
        else if (url.includes("/topstory/recommend")) {
            if (Array.isArray(body.data)) {
                body.data = body.data.filter(item => !isZhihuFeedAd(item));
            }
        }
        // 6. 问题回答列表过滤 (questions/.../answers 或 questions/.../feeds)
        else if (url.includes("/questions/") || url.includes("/v4/questions/")) {
            body.ad_info = null;
            delete body.ad_info;
            if (Array.isArray(body.data)) {
                body.data = body.data.filter(item => {
                    if (item.type === "feed_advert" || item.type === "commercial" || item.type === "ad") return false;
                    if (item.ad || item.ad_info || item.ad_style) return false;
                    return true;
                });
            }
        }
        // 7. 回答页与专栏文章底部的商业推荐
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
        // 8. 商业资源包下发过滤 (2026 抓包捕获)
        else if (url.includes("/v3/resource") && (url.includes("commerce") || url.includes("group_name=commerce2"))) {
            body = { code: 0, data: {} };
        }
        // 9. 配置中心拦截备用广告路由
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
        if (item.type === "feed_advert" || item.type === "market_card" || item.type === "commercial" || item.type === "banner" || item.type === "ad") {
            return true;
        }

        // 广告样式与投放元数据
        if (item.ad_info || item.ad || item.extra?.is_ad || item.card_type === "slot_event_card" || item.ad_style) {
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
