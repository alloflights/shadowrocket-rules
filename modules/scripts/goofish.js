/**
 * 闲鱼 (Goofish / Xianyu) 深度无感净化脚本
 *
 * 核心能力：
 * 1. 开屏秒过 (idlecommerce.splash / idle.local.splash) — 本地 0.1ms Mock 响应，清空 adMap 彻底杜绝开屏广告；
 * 2. 广告上报拦截 (idleadv.app.launch.report / scene.restore / ad.expose) — 阻断数据追踪并模拟调用成功；
 * 3. 悬浮球与弹窗净化 (strategy.list) — 精准过滤 POPUP / FLOAT_LAYER / BANNER，保留用户发布闲置球 (BIZ_PUBLISH_BALL)；
 * 4. 首页Tab追踪清理 (idlehome.home.circle.list) — 剥离全量商业追踪参数与广告埋点；
 * 5. 推荐流与搜索广告剥离 (homeRecommendFeed / search) — 过滤赞助卡片、推广商品与运营横幅；
 * 6. 100% 静默无感运行：零 $notification.post 弹窗打扰，完整 try/catch 容错。
 *
 * @author allofights
 * @version 1.0.1
 */

(function goofishClean() {
    var request = (typeof $request !== "undefined" && $request) ? $request : null;
    var url = (request && request.url) ? String(request.url) : "";
    var isRequest = typeof $response === "undefined" || !$response;

    // ==================== HTTP-REQUEST 请求阶段拦截与本地 Mock ====================
    if (isRequest) {
        // 1. 开屏广告请求拦截并快速返回空 adMap，防止 App 挂起或回退本地缓存
        if (/mtop\.taobao\.idle(commerce)?\.(splash|home\.welcome)/i.test(url)) {
            $done({
                response: {
                    status: 200,
                    headers: { "Content-Type": "application/json; charset=utf-8" },
                    body: JSON.stringify({
                        api: "mtop.taobao.idlecommerce.splash.async.ads",
                        data: { adMap: {}, splashList: [] },
                        ret: ["SUCCESS::调用成功"],
                        v: "1.0"
                    })
                }
            });
            return;
        }

        // 2. 广告曝光与启动上报静默拦截
        if (/mtop\.idle\.(ad|idleadv)\.(app\.launch\.report|scene\.restore|expose)/i.test(url)) {
            $done({
                response: {
                    status: 200,
                    headers: { "Content-Type": "application/json; charset=utf-8" },
                    body: JSON.stringify({
                        api: "mtop.idle.idleadv.app.launch.report",
                        data: { attributeSuccess: "false", trackParams: { stageMatch: "false" } },
                        ret: ["SUCCESS::调用成功"],
                        v: "1.0"
                    })
                }
            });
            return;
        }

        $done({});
        return;
    }

    // ==================== HTTP-RESPONSE 响应体深度净化 ====================
    if (!$response || !$response.body) {
        $done({});
        return;
    }

    try {
        var body = JSON.parse($response.body);
        if (!body || typeof body !== "object") {
            $done({});
            return;
        }

        var data = body.data;
        var isStringData = false;
        if (typeof data === "string") {
            try {
                data = JSON.parse(data);
                isStringData = true;
            } catch (e) {
                $done({});
                return;
            }
        }
        if (!data || typeof data !== "object") {
            $done({ body: $response.body });
            return;
        }

        var targetData = (data.data && typeof data.data === "object") ? data.data : data;

        // 1. 开屏广告兜底清理 (若穿透了 request 阶段)
        if (/splash/i.test(url)) {
            if (targetData.adMap) targetData.adMap = {};
            if (data.adMap) data.adMap = {};
            if (Array.isArray(targetData.splashList)) targetData.splashList = [];
            if (Array.isArray(data.splashList)) data.splashList = [];
        }

        // 2. 悬浮球 / 运营弹窗策略净化
        if (/mtop\.taobao\.idle\.user\.strategy/i.test(url)) {
            cleanStrategyList(targetData);
            if (targetData !== data) cleanStrategyList(data);
        }

        // 3. 首页 Tab 广告追踪参数剥离
        if (/idlehome\.home\.circle/i.test(url)) {
            cleanCircleTrackParams(targetData);
            if (targetData !== data) cleanCircleTrackParams(data);
        }

        // 4. 首页推荐流广告过滤
        if (/mtop\.taobao\.idle\.home\.(recommend|feed)|homeRecommendFeed|homeFeed/i.test(url)) {
            filterFeedItems(targetData);
            if (targetData !== data) filterFeedItems(data);
        }

        // 5. 搜索结果广告过滤
        if (/mtop\.taobao\.idle\.search/i.test(url)) {
            filterFeedItems(targetData);
            if (targetData !== data) filterFeedItems(data);
        }

        // 6. 通用横幅与营销浮窗字段清空
        cleanCommonAdFields(targetData);
        if (targetData !== data) cleanCommonAdFields(data);

        // 回写数据
        if (isStringData) {
            body.data = JSON.stringify(data);
        } else {
            body.data = data;
        }
        $done({ body: JSON.stringify(body) });

    } catch (e) {
        $done({});
    }

    // ==================== 核心过滤算法 ====================

    function cleanStrategyList(d) {
        if (!d) return;
        if (Array.isArray(d.strategies)) {
            var adTypes = ["FLOAT_LAYER", "POPUP", "MODAL", "BANNER", "WINDOW"];
            d.strategies = d.strategies.filter(function (strategy) {
                if (!strategy) return false;
                // 重点保护用户核心功能：发布闲置球
                if (strategy.type === "BIZ_PUBLISH_BALL" || strategy.bizType === "publish") {
                    return true;
                }
                if (adTypes.indexOf(strategy.type) !== -1) {
                    return false;
                }
                return true;
            });
            if (d.strategies.length === 0) {
                d.strategies = [{}];
            }
        }
        if (d.popupStrategies) d.popupStrategies = [];
        if (d.floatStrategies) d.floatStrategies = [];
    }

    function cleanCircleTrackParams(d) {
        if (!d || !Array.isArray(d.circleList)) return;
        d.circleList.forEach(function (circle) {
            if (circle && circle.trackParams && circle.trackParams.args) {
                var args = circle.trackParams.args;
                var adKeys = [
                    "idleAdsPositionId", "idleAdsMaterialId", "idleAdsTaskId",
                    "idleAdsOriginTaskId", "idleAdsLoginUserId", "idleAdsIdleCrowdId",
                    "idleAdsMaterialTemplateId", "idleAdsSubNamespace", "idleAdsNamespace",
                    "idleAdsCrowdId", "idleAdsRequestTraceId"
                ];
                for (var i = 0; i < adKeys.length; i++) {
                    delete args[adKeys[i]];
                }
            }
        });
    }

    function filterFeedItems(d) {
        if (!d) return;
        var listKeys = ["items", "resultList", "list", "cardList", "feeds"];
        for (var k = 0; k < listKeys.length; k++) {
            var key = listKeys[k];
            if (Array.isArray(d[key])) {
                d[key] = d[key].filter(function (item) {
                    if (!item || typeof item !== "object") return true;
                    // 广告与推广标记
                    if (item.adSign || item.isAd || item.ad_type || item.adTag) return false;
                    if (item.cardType === "ad" || item.cardType === "AD") return false;
                    if (item.type === "ad" || item.type === "AD" || item.type === "banner_ad") return false;
                    if (item.promotionType || item.promotionTag) return false;
                    // 运营横幅
                    if (item.cardType === "banner" && item.trackParams) return false;
                    return true;
                });
            }
        }
        // 递归检查嵌套 modules
        if (d.modules && typeof d.modules === "object") {
            var mods = Array.isArray(d.modules) ? d.modules : Object.values(d.modules);
            for (var m = 0; m < mods.length; m++) {
                if (mods[m] && typeof mods[m] === "object") {
                    filterFeedItems(mods[m]);
                }
            }
        }
    }

    function cleanCommonAdFields(d) {
        if (!d) return;
        var adKeys = [
            "bannerList", "bannerInfo", "banner", "banners",
            "popupInfo", "popup", "popupList",
            "floatInfo", "floatWindow", "floatList",
            "adInfo", "adList", "ads",
            "marketingBanner", "operationInfo", "operationList"
        ];
        for (var i = 0; i < adKeys.length; i++) {
            var key = adKeys[i];
            if (d[key] !== undefined) {
                if (Array.isArray(d[key])) {
                    d[key] = [];
                } else if (typeof d[key] === "object" && d[key] !== null) {
                    d[key] = {};
                } else {
                    d[key] = null;
                }
            }
        }
    }
})();
