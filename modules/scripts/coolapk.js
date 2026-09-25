// 酷安净化脚本 (Coolapk Pro)
// 去除酷安App开屏广告、首页推广卡片、信息流广告、商品推荐与评论区推广

const url = $request.url;

if (!$response || !$response.body) {
    $done({});
}

try {
    let obj = JSON.parse($response.body);

    if (url.includes("/main/init")) {
        // 核心初始化接口：开屏广告配置、Tab与热搜
        if (Array.isArray(obj.data)) {
            let filtered = [];
            for (let item of obj.data) {
                // 过滤开屏广告、推广Tab与营销项目
                // 944: 热门搜索, 945: 开屏广告, 6390: 首页营销Tab, 8639/24455/36839: 商业推广
                if ([944, 945, 6390, 8639, 24455, 36839].includes(item?.entityId) ||
                    item?.entityType === "splash" ||
                    item?.entityTemplate === "splash" ||
                    item?.entityType === "ad" ||
                    item?.title?.includes("广告") ||
                    item?.extraData?.ad) {
                    continue;
                }
                if (item?.entityId === 20131 && Array.isArray(item.entities)) {
                    // 发现页顶部推广过滤
                    item.entities = item.entities.filter(i => i?.title !== "酷品");
                }
                filtered.push(item);
            }
            obj.data = filtered;
        }
        // 清除根级可能存在的开屏与广告字段
        delete obj.splash;
        delete obj.splashList;
        delete obj.ad;
        delete obj.ads;
    } else if (url.includes("/main/indexV8")) {
        // 首页推荐流
        if (Array.isArray(obj.data)) {
            obj.data = obj.data.filter(item => {
                if (item?.entityTemplate === "sponsorCard") return false;
                if ([8639, 29349, 33006, 32557].includes(item?.entityId)) return false;
                if (item?.title?.includes("值得买") || item?.title?.includes("红包") || item?.title?.includes("精选配件")) return false;
                if (item?.extraData?.ad || item?.entityType === "ad") return false;
                return true;
            });
        }
    } else if (url.includes("/page/dataList") || url.includes("/main/dataList")) {
        // 数据流与信息流广告
        if (Array.isArray(obj.data)) {
            obj.data = obj.data.filter(item => {
                if (item?.entityTemplate === "sponsorCard" || item?.entityTemplate === "imageScaleCard") return false;
                if (item?.title === "酷安热搜" || item?.title === "精选配件") return false;
                if (item?.extraData?.ad || item?.entityType === "ad") return false;
                return true;
            });
        }
    } else if (url.includes("/feed/detail")) {
        // 动态/帖子详情页
        if (obj.data) {
            if (Array.isArray(obj.data.hotReplyRows)) {
                obj.data.hotReplyRows = obj.data.hotReplyRows.filter(item => item?.id);
            }
            if (Array.isArray(obj.data.topReplyRows)) {
                obj.data.topReplyRows = obj.data.topReplyRows.filter(item => item?.id);
            }
            const sponsorFields = ["detailSponsorCard", "include_goods", "include_goods_ids"];
            for (let f of sponsorFields) {
                if (obj.data[f]) obj.data[f] = [];
            }
        }
    } else if (url.includes("/feed/replyList")) {
        // 评论区
        if (Array.isArray(obj.data)) {
            obj.data = obj.data.filter(item => item?.id);
        }
    } else if (url.includes("/account/profile")) {
        // 个人中心推广横幅
        if (obj.data && Array.isArray(obj.data.entities)) {
            obj.data.entities = obj.data.entities.filter(item => !item?.title?.includes("好物"));
        }
    }

    $done({ body: JSON.stringify(obj) });
} catch (e) {
    $done({});
}
