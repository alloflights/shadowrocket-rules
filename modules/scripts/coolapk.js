/**
 * 酷安 (Coolapk) 深度净化脚本
 * 
 * 核心特性：
 * 1. 拦截开屏广告配置、Tab推广与营销热搜 (/main/init)
 * 2. 深度过滤首页全系列版本信息流 (/main/index*) 中的推广卡片、数码好物带货与红包广告
 * 3. 过滤动态列表与频道数据流 (/page/dataList*, /main/dataList*) 中的 sponsorCard 与广告位
 * 4. 清除动态详情页带货商品卡片 (detailSponsorCard / include_goods)
 * 5. 过滤评论区插播商业广告与推广回复
 * 6. 移除个人中心推广横幅
 * 
 * 遵循: Ponytail 极简原则
 * 作者: allofights
 */

(function coolapkPro() {
    const url = $request.url;
    if (typeof $response === "undefined" || !$response.body) {
        $done({});
        return;
    }

    try {
        let obj = JSON.parse($response.body);

        // 1. 初始化接口（开屏、热搜、营销配置与第三方SDK分发）
        if (url.includes("/main/init")) {
            if (Array.isArray(obj.data)) {
                obj.data = obj.data.filter(item => {
                    if (!item) return false;
                    if ([944, 945, 6390, 8639, 24455, 36839].includes(item?.entityId)) return false;
                    const type = (item.entityType || "").toLowerCase();
                    const template = (item.entityTemplate || "").toLowerCase();
                    if (type.includes("splash") || template.includes("splash")) return false;
                    if (type.includes("ad") || template.includes("ad") || type.includes("sponsor")) return false;
                    if (item.title && (item.title.includes("广告") || item.title.includes("推广"))) return false;
                    if (item.extraData && (item.extraData.ad || item.extraData.splash)) return false;
                    if (item.entityId === 20131 && Array.isArray(item.entities)) {
                        item.entities = item.entities.filter(i => i?.title !== "酷品" && i?.title !== "好物");
                    }
                    return true;
                });
            } else if (obj.data && typeof obj.data === "object") {
                delete obj.data.splash;
                delete obj.data.splashList;
                delete obj.data.ad;
                delete obj.data.ads;
                delete obj.data.adList;
            }
            delete obj.splash;
            delete obj.splashList;
            delete obj.ad;
            delete obj.ads;
            delete obj.adList;
            if (obj.config) {
                delete obj.config.splash;
            }
        }
        // 2. 首页各版本推荐流 (index / indexV8 / indexV11 / indexV12)
        else if (url.includes("/main/index")) {
            if (Array.isArray(obj.data)) {
                obj.data = obj.data.filter(item => !isCoolapkAd(item));
            }
        }
        // 3. 通用数据流 (dataList / dataListV8 / dataListV11)
        else if (url.includes("dataList")) {
            if (Array.isArray(obj.data)) {
                obj.data = obj.data.filter(item => !isCoolapkAd(item));
            }
        }
        // 4. 动态/图文详情页
        else if (url.includes("/feed/detail")) {
            if (obj.data) {
                if (Array.isArray(obj.data.hotReplyRows)) {
                    obj.data.hotReplyRows = obj.data.hotReplyRows.filter(item => !isCoolapkReplyAd(item));
                }
                if (Array.isArray(obj.data.topReplyRows)) {
                    obj.data.topReplyRows = obj.data.topReplyRows.filter(item => !isCoolapkReplyAd(item));
                }
                const sponsorFields = ["detailSponsorCard", "include_goods", "include_goods_ids", "goodsList", "goodsRows"];
                for (let f of sponsorFields) {
                    if (obj.data[f]) obj.data[f] = [];
                }
            }
        }
        // 5. 评论区列表
        else if (url.includes("/feed/replyList")) {
            if (Array.isArray(obj.data)) {
                obj.data = obj.data.filter(item => !isCoolapkReplyAd(item));
            }
        }
        // 6. 个人中心
        else if (url.includes("/account/profile")) {
            if (obj.data && Array.isArray(obj.data.entities)) {
                obj.data.entities = obj.data.entities.filter(item => !item?.title?.includes("好物") && !item?.title?.includes("推广"));
            }
        }

        $done({ body: JSON.stringify(obj) });
    } catch (e) {
        $done({});
    }

    /**
     * 判断是否为酷安信息流广告卡片
     */
    function isCoolapkAd(item) {
        if (!item) return false;

        // 赞助模板与大图营销
        if (item.entityTemplate === "sponsorCard" || item.entityTemplate === "imageScaleCard" || item.entityTemplate === "goodsCard" || item.entityTemplate === "goodsGridCard") {
            return true;
        }

        // 商业实体类型
        if (item.entityType === "ad" || item.entityType === "card" && item.title?.includes("推广")) {
            return true;
        }

        // 命中已知商业推广 ID
        if ([8639, 29349, 33006, 32557, 43906].includes(item.entityId)) {
            return true;
        }

        // 商业带货与广告元数据
        if (item.extraData?.ad || item.extraData?.is_ad || item.extraData?.is_feed_ad) {
            return true;
        }

        if (item.title?.includes("值得买") || item.title?.includes("红包") || item.title?.includes("精选配件") || item.title === "酷安热搜") {
            return true;
        }

        return false;
    }

    /**
     * 判断是否为评论区推广
     */
    function isCoolapkReplyAd(item) {
        if (!item || !item.id) return true;
        if (item.entityType === "ad" || item.extraData?.ad) return true;
        return false;
    }
})();
