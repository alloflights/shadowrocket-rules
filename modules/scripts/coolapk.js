/**
 * 酷安 (Coolapk) 深度净化脚本
 * 
 * 核心特性：
 * 1. 拦截开屏广告配置、Tab推广、营销热搜与第三方SDK初始化 (/main/init)
 * 2. 递归剥离嵌套 entities 中的广告卡片与开屏投放对象，杜绝开屏倒计时留存
 * 3. 深度过滤首页全系列版本信息流 (/main/index*) 中的推广卡片、数码好物带货与红包广告
 * 4. 过滤动态列表与频道数据流 (/page/dataList*, /main/dataList*) 中的 sponsorCard 与广告位
 * 5. 清除动态详情页带货商品卡片 (detailSponsorCard / include_goods)
 * 6. 过滤评论区插播商业广告与推广回复
 * 7. 移除个人中心推广横幅
 * 
 * 遵循: Ponytail 极简原则
 * 作者: allofights
 */

(function coolapkPro() {
    const url = $request.url;
    if (typeof $response === "undefined") {
        if (url.includes("splash") || url.includes("launch") || url.includes("openScreen") || url.includes("ad")) {
            $done({
                response: {
                    status: 200,
                    headers: { "Content-Type": "application/json; charset=utf-8" },
                    body: JSON.stringify({ data: [] })
                }
            });
            return;
        }
        $done({});
        return;
    }

    if (!$response.body) {
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
                    if (isCoolapkInitAd(item)) return false;

                    // 递归清理子实体中的广告推广位
                    if (Array.isArray(item.entities)) {
                        item.entities = item.entities.filter(sub => !isCoolapkInitAd(sub));
                    }

                    // 擦除 extraData 中的各类广告 SDK 标记与开屏计时
                    if (item.extraData && typeof item.extraData === "object") {
                        cleanObjectAdKeys(item.extraData);
                    }
                    return true;
                });
            } else if (obj.data && typeof obj.data === "object") {
                cleanObjectAdKeys(obj.data);
            }
            cleanObjectAdKeys(obj);
            if (obj.config && typeof obj.config === "object") {
                cleanObjectAdKeys(obj.config);
            }
        }
        // 2. 首页各版本推荐流 (index / indexV8 / indexV11 / indexV12)
        else if (url.includes("/main/index")) {
            if (Array.isArray(obj.data)) {
                obj.data = filterCoolapkList(obj.data);
            }
        }
        // 3. 通用数据流 (dataList / dataListV8 / dataListV11)
        else if (url.includes("dataList")) {
            if (Array.isArray(obj.data)) {
                obj.data = filterCoolapkList(obj.data);
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
     * 深度过滤数据列表，兼顾子实体
     */
    function filterCoolapkList(list) {
        return list.filter(item => {
            if (!item) return false;
            if (isCoolapkAd(item)) return false;
            if (Array.isArray(item.entities)) {
                item.entities = item.entities.filter(sub => !isCoolapkAd(sub));
                if (item.entities.length === 0 && (item.entityType === "card" || item.entityTemplate === "card")) {
                    return false;
                }
            }
            return true;
        });
    }

    /**
     * 移除对象中包含的全部广告/开屏/SDK键值
     */
    function cleanObjectAdKeys(o) {
        if (!o || typeof o !== "object") return;
        const adKeys = [
            "splash", "splashList", "splash_config", "launch_ad", "launchAd",
            "launch_time", "launchTime", "open_screen", "openScreen", "ad",
            "ads", "adList", "ad_config", "gromore", "gromore_config",
            "pangle", "pangle_config", "gdt", "gdt_config", "mobads",
            "mobads_config", "third_party_ad", "sdk_ad", "sdk_config",
            "startup", "startup_ad", "ad_params", "splash_video", "splash_image"
        ];
        for (let k of adKeys) {
            delete o[k];
        }
    }

    /**
     * 判断是否为初始化阶段的开屏与推广实体
     */
    function isCoolapkInitAd(item) {
        if (!item) return false;
        const adEntityIds = [
            944, 945, 1373, 6390, 8639, 20099, 20131, 21703,
            24455, 28212, 29349, 31114, 32557, 33006, 36839, 39396, 43906
        ];
        if (adEntityIds.includes(item.entityId)) return true;

        const type = String(item.entityType || "").toLowerCase();
        const template = String(item.entityTemplate || "").toLowerCase();
        if (type.includes("splash") || template.includes("splash")) return true;
        if (type.includes("ad") || template.includes("ad") || type.includes("sponsor")) return true;
        if (template === "imagescalecard" || type === "imagescalecard") return true;

        const title = String(item.title || "");
        const subTitle = String(item.subTitle || item.description || "");
        if (title.includes("广告") || title.includes("推广") || title.includes("开屏") || title === "酷品" || title === "好物") return true;
        if (subTitle.includes("广告") || subTitle.includes("推广")) return true;

        const urlStr = String(item.url || item.pic || item.image || item.splashUrl || "").toLowerCase();
        if (urlStr.includes("splash") || urlStr.includes("advert") || urlStr.includes("open_screen")) return true;

        if (item.extraData && typeof item.extraData === "object") {
            const ex = item.extraData;
            if (ex.splash || ex.open_screen || ex.ad || ex.is_ad || ex.is_feed_ad || ex.third_party_ad || ex.sdk_ad) {
                return true;
            }
        }
        return false;
    }

    /**
     * 判断是否为酷安信息流广告卡片
     */
    function isCoolapkAd(item) {
        if (!item) return false;

        const adEntityIds = [
            944, 945, 1373, 6390, 8639, 20099, 20131, 21703,
            24455, 28212, 29349, 31114, 32557, 33006, 36839, 39396, 43906
        ];
        if (adEntityIds.includes(item.entityId)) return true;

        // 赞助模板与商业推广模板
        const template = String(item.entityTemplate || "").toLowerCase();
        const adTemplates = ["sponsorcard", "imagescalecard", "goodscard", "goodsgridcard", "feed_ad", "adcard", "sponsor", "textlinkcard"];
        if (adTemplates.includes(template)) return true;

        // 商业实体类型
        const type = String(item.entityType || "").toLowerCase();
        if (type === "ad" || type === "sponsor") return true;
        if (type === "card" && item.title && (item.title.includes("推广") || item.title.includes("广告"))) return true;

        // 商业带货与广告元数据
        if (item.extraData && typeof item.extraData === "object") {
            const ex = item.extraData;
            if (ex.ad || ex.is_ad || ex.is_feed_ad || ex.sponsor || ex.splash || ex.gromore || ex.pangle || ex.gdt) {
                return true;
            }
        }

        const title = String(item.title || "");
        const subTitle = String(item.subTitle || item.description || "");
        if (title.includes("值得买") || title.includes("红包") || title.includes("精选配件") || title === "酷安热搜" || title.includes("推广") || title.includes("广告") || subTitle.includes("广告") || subTitle.includes("推广") || title.includes("福利")) {
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
