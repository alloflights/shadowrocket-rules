/**
 * 知乎 (Zhihu) 深度纯净版脚本 (2026 真机抓包对齐版)
 * 
 * 核心特性 (基于 2026-10 真实抓包对齐)：
 * 1. 拦截新版开屏与广告样式服务 (ad-style-service/launch_animation & ad-style-service/request)
 * 2. 拦截并过滤新版信息流聚合根接口 (feed-root/sections/query/v2, feed-root/section/*)
 * 3. 彻底过滤推荐流伪装广告与营销专栏 (topstory/recommend & v4/topstory/recommend)
 * 4. 深度过滤动态/关注推荐流广告 (moments/recommend, moments)
 * 5. 过滤知乎热榜 (topstory/hot-lists) 商业推广卡片
 * 6. 移除问题回答列表中的商业卡片 (questions/answers, v4/questions)
 * 7. 拦截商业资源下发 (appcloud2/v3/resource?group_name=commerce)
 * 8. 移除首页悬浮球与活动浮窗 (commercial_api/app_float_layer)
 * 
 * 遵循: Ponytail 极简原则
 * 作者: allofights
 */

(function zhihuPro() {
    var request = (typeof $request !== "undefined" && $request) ? $request : null;
    var url = (request && request.url) ? String(request.url) : "";
    var hasResponse = typeof $response !== "undefined" && $response;

    if (!hasResponse || !$response.body) {
        $done({});
        return;
    }

    try {
        var body = JSON.parse($response.body);

        // 1. 新版广告样式与开屏动画服务 (2026 抓包捕获)
        if (url.indexOf("/ad-style-service/") !== -1) {
            body = { code: 0, message: "success", data: [] };
        }
        // 2. 开屏广告与商业启动兜底
        else if (url.indexOf("/commercial_api/real_time_launch") !== -1) {
            if (body.launch) {
                try {
                    var launch = JSON.parse(body.launch);
                    launch.ads = [];
                    body.launch = JSON.stringify(launch);
                } catch (err) {
                    body.launch = "{}";
                }
            } else {
                body = { launch: "{}" };
            }
        }
        // 3. 首页悬浮营销球与活动弹窗
        else if (url.indexOf("/commercial_api/app_float_layer") !== -1) {
            body = {};
        }
        // 4. 新版信息流聚合根接口 (feed-root/sections/query/v2 & feed-root/section/*)
        else if (url.indexOf("/feed-root/") !== -1) {
            if (Array.isArray(body.data)) {
                body.data = body.data.filter(function(item) {
                    return !isZhihuFeedAd(item);
                });
            }
            if (Array.isArray(body.items)) {
                body.items = body.items.filter(function(item) {
                    return !isZhihuFeedAd(item);
                });
            }
            if (Array.isArray(body.sections)) {
                body.sections = body.sections.filter(function(sec) {
                    if (sec.type === "commercial" || sec.section_type === "ad") return false;
                    if (Array.isArray(sec.items)) {
                        sec.items = sec.items.filter(function(item) {
                            return !isZhihuFeedAd(item);
                        });
                    }
                    if (Array.isArray(sec.elements)) {
                        sec.elements = sec.elements.filter(function(item) {
                            return !isZhihuFeedAd(item);
                        });
                    }
                    return true;
                });
            }
        }
        // 5. 动态/关注推荐流 (moments/recommend, moments)
        else if (url.indexOf("/moments") !== -1) {
            if (Array.isArray(body.data)) {
                body.data = body.data.filter(function(item) {
                    return !isZhihuFeedAd(item);
                });
            }
        }
        // 6. 经典与V4首页推荐流过滤 (topstory/recommend)
        else if (url.indexOf("/topstory/recommend") !== -1) {
            if (Array.isArray(body.data)) {
                body.data = body.data.filter(function(item) {
                    return !isZhihuFeedAd(item);
                });
            }
        }
        // 7. 知乎热榜 (topstory/hot-lists)
        else if (url.indexOf("/topstory/hot-lists") !== -1) {
            if (Array.isArray(body.data)) {
                body.data = body.data.filter(function(item) {
                    return !isZhihuFeedAd(item);
                });
            }
        }
        // 8. 问题回答列表过滤 (questions/.../answers 或 questions/.../feeds)
        else if (url.indexOf("/questions/") !== -1 || url.indexOf("/v4/questions/") !== -1) {
            body.ad_info = null;
            delete body.ad_info;
            if (Array.isArray(body.data)) {
                body.data = body.data.filter(function(item) {
                    return !isZhihuFeedAd(item);
                });
            }
        }
        // 9. 回答页与专栏文章底部的商业推荐
        else if (url.indexOf("/answers/") !== -1 && url.indexOf("/recommendations") !== -1) {
            body.data = [];
            body.paging = null;
        }
        else if (url.indexOf("/articles/") !== -1 && url.indexOf("/recommendation") !== -1) {
            body.ad_info = null;
            delete body.ad_info;
            if (Array.isArray(body.data)) {
                body.data = [];
            }
        }
        // 10. 商业资源包下发过滤
        else if (url.indexOf("/v3/resource") !== -1 && (url.indexOf("commerce") !== -1 || url.indexOf("group_name=commerce2") !== -1)) {
            body = { code: 0, data: {} };
        }
        // 11. 配置中心拦截备用广告路由
        else if (url.indexOf("/v3/config") !== -1) {
            if (body.config && body.config.zhcnh_thread_sync && body.config.zhcnh_thread_sync.ZHBackUpIP_Switch_Open) {
                body.config.zhcnh_thread_sync.ZHBackUpIP_Switch_Open = "0";
            }
        }

        $done({ body: JSON.stringify(body) });
    } catch (e) {
        $done({});
    }

    /**
     * 判断是否为知乎商业广告或营销推广卡片
     */
    function isZhihuFeedAd(item) {
        if (!item || typeof item !== "object") return false;

        // 显式广告类型与卡片类型
        if (item.type === "feed_advert" || item.type === "market_card" || item.type === "commercial" ||
            item.type === "banner" || item.type === "ad" || item.type === "commercial_card" || item.type === "advert") {
            return true;
        }

        // slot 卡片类型 (知乎核心广告位)
        if (item.card_type === "slot_event_card" || item.card_type === "slot_video_event_card" ||
            item.card_type === "feed_ad" || item.card_type === "commercial_card") {
            return true;
        }

        // 投放元数据与特征字段
        if (item.ad || item.ad_info || item.ad_style || item.adjson || item.ad_list || item.commercial_info) {
            return true;
        }

        // extra 字段广告标记
        if (item.extra && typeof item.extra === "object") {
            if (item.extra.is_ad || item.extra.type === "commercial" || item.extra.type === "ad" ||
                item.extra.banner || item.extra.is_commercial || item.extra.commercial_card) {
                return true;
            }
        }

        // target 对象商业标记
        if (item.target && typeof item.target === "object") {
            if (item.target.type === "advert" || item.target.type === "commercial" || item.target.is_ad) {
                return true;
            }
        }

        // 商业专栏/外链导流
        if (item.fields && item.fields.header && item.fields.header.url) {
            if (/commercial|market/i.test(item.fields.header.url)) return true;
        }

        // 常见商业营销号/广告作者
        if (item.author && (item.author.name === "知乎广告" || item.author.name === "广告")) {
            return true;
        }

        return false;
    }
})();
