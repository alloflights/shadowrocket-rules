/**
 * 酷安 (Coolapk) 去广告 v3
 *
 * 开屏根因（v2 的 “广告不加载但仍停在开屏页、要点跳过” 问题）：
 *   酷安自营开屏不是第三方 SDK，而是 /v6/main/init 下发的第一张 entityTemplate=imageCard 卡片，
 *   客户端拿到它就会画出带“跳过”按钮的开屏页；v2 只把图片 reject 掉，于是出现“空白开屏 + 跳过”。
 *   v3 直接从 init 中删除 imageCard，并改写配置卡 (entityId 6390) 的 SplashAd.* 参数：
 *     SplashAd.Type = ""        → 不启用任何开屏广告类型
 *     SplashAd.timeout = "0"    → 开屏等待 0 秒
 *     SplashAd.Expires = 9999999999 → 热启动(切回前台)开屏间隔拉满
 *     SplashAd.onResume = "0"   → 关闭切回前台开屏
 *   同时在请求阶段去掉 If-None-Match / If-Modified-Since，避免 304 让客户端继续用旧缓存。
 *
 * 信息流：只依据明确的广告信号（模板名 / 已知广告位 entityId / 广告标记字段）删除卡片，
 * 不做关键词猜测，避免误删正常动态与 Tab。
 *
 * 兼容 Shadowrocket / Surge / Loon / Stash；任何异常都原样放行。
 */
(function () {
    var url = (typeof $request !== "undefined" && $request && $request.url) ? String($request.url) : "";
    var isResponse = typeof $response !== "undefined" && $response !== null && $response !== undefined;

    // ---------- 请求阶段：init 去缓存校验头 ----------
    if (!isResponse) {
        try {
            if (/\/v6\/main\/init/i.test(url) && $request.headers) {
                var headers = {};
                var changed = false;
                Object.keys($request.headers).forEach(function (k) {
                    var lk = k.toLowerCase();
                    if (lk === "if-none-match" || lk === "if-modified-since") {
                        changed = true;
                        return;
                    }
                    headers[k] = $request.headers[k];
                });
                return $done(changed ? { headers: headers } : {});
            }
        } catch (e) {}
        return $done({});
    }

    var body = $response.body;
    if (!body || typeof body !== "string") return $done({});

    var obj;
    try {
        obj = JSON.parse(body);
    } catch (e) {
        return $done({});
    }
    if (!obj || typeof obj !== "object") return $done({});

    var AD_TEMPLATES = /^(?:sponsorCard|sponsorCardV\d+|feedSponsorCard|detailSponsorCard|replySponsorCard|hotSponsorCard|adCard|feedAd|nativeAd|sdkAd|goodsCard|goodsGridCard|goodsListCard|coolowCard)$/i;
    // 社区长期验证的首页 / 列表广告位
    var AD_ENTITY_IDS = { 8639: 1, 29349: 1, 33006: 1, 32557: 1, 13635: 1 };
    var AD_TITLES = /^(?:酷安热搜|精选配件|酷品好物|赞助|广告)$/;
    var AD_FLAGS = ["is_ad", "isAd", "is_feed_ad", "isFeedAd", "ad_id", "adId", "raw_ad_data", "sdk_ad"];

    function truthy(v) {
        return v === true || v === 1 || (typeof v === "string" && v !== "" && v !== "0" && v !== "false");
    }

    function isAdItem(item) {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;
        if (item.entityTemplate === "configCard") return false;
        if (AD_TEMPLATES.test(String(item.entityTemplate || ""))) return true;
        if (String(item.entityType || "").toLowerCase() === "ad") return true;
        if (AD_ENTITY_IDS[Number(item.entityId)]) return true;
        var title = String(item.title || "").trim();
        if (AD_TITLES.test(title)) return true;
        if (/值得买|红包/.test(title) && String(item.entityType || "") === "card") return true;
        if (item.tag === "广告" || item.label === "广告" || item.tag === "赞助" || item.label === "赞助") return true;
        for (var i = 0; i < AD_FLAGS.length; i++) {
            if (truthy(item[AD_FLAGS[i]])) return true;
        }
        return false;
    }

    function filterList(list) {
        if (!Array.isArray(list)) return list;
        var out = [];
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            if (isAdItem(item)) continue;
            // 卡片里嵌套的广告子项
            if (item && typeof item === "object" && Array.isArray(item.entities) && item.entityTemplate !== "configCard") {
                var before = item.entities.length;
                item.entities = item.entities.filter(function (e) { return !isAdItem(e); });
                if (before > 0 && item.entities.length === 0 && String(item.entityType || "") === "card") continue;
            }
            out.push(item);
        }
        return out;
    }

    function patchSplashMap(map, force) {
        if (!map || typeof map !== "object") return false;
        var has = force;
        Object.keys(map).forEach(function (k) {
            if (k.indexOf("SplashAd.") === 0) has = true;
        });
        if (!has) return false;
        map["SplashAd.Type"] = "";
        map["SplashAd.timeout"] = "0";
        map["SplashAd.Timeout"] = "0";
        map["SplashAd.Expires"] = 9999999999;
        map["SplashAd.onResume"] = "0";
        return true;
    }

    function patchInit(data) {
        if (!Array.isArray(data)) return data;
        var out = [];
        for (var i = 0; i < data.length; i++) {
            var item = data[i];
            if (!item || typeof item !== "object") {
                out.push(item);
                continue;
            }
            // 自营开屏卡：客户端取第一张 imageCard 作为开屏
            if (item.entityTemplate === "imageCard") continue;
            var isConfig = String(item.entityId) === "6390";
            if (item.extraDataArr && typeof item.extraDataArr === "object" && !Array.isArray(item.extraDataArr)) {
                patchSplashMap(item.extraDataArr, isConfig);
            }
            if (typeof item.extraData === "string" && item.extraData.indexOf("{") === 0) {
                try {
                    var extra = JSON.parse(item.extraData);
                    if (patchSplashMap(extra, isConfig)) item.extraData = JSON.stringify(extra);
                } catch (e) {}
            }
            out.push(item);
        }
        return out;
    }

    function clearFields(target, fields) {
        if (!target || typeof target !== "object") return;
        for (var i = 0; i < fields.length; i++) {
            if (Object.prototype.hasOwnProperty.call(target, fields[i])) target[fields[i]] = [];
        }
    }

    function filterReplies(list) {
        if (!Array.isArray(list)) return list;
        return list.filter(function (r) {
            return r && typeof r === "object" && r.id && !isAdItem(r);
        });
    }

    try {
        if (/\/v6\/main\/init/i.test(url)) {
            obj.data = patchInit(obj.data);
        } else if (/\/v6\/feed\/detail/i.test(url)) {
            var d = obj.data;
            if (d && typeof d === "object") {
                clearFields(d, ["detailSponsorCard", "hotSponsorCard", "feedSponsorCard", "sponsorCard", "include_goods", "include_goods_ids", "goodsList"]);
                d.hotReplyRows = filterReplies(d.hotReplyRows);
                d.topReplyRows = filterReplies(d.topReplyRows);
                d.replyRows = filterReplies(d.replyRows);
            }
        } else if (/\/v6\/feed\/replyList/i.test(url)) {
            obj.data = filterReplies(obj.data);
        } else if (/\/v6\/search\?.*type=hotSearch/i.test(url)) {
            obj.data = [];
        } else if (Array.isArray(obj.data)) {
            // /main/indexV8、/page/dataList、/main/dataList、/feed/* 列表等
            obj.data = filterList(obj.data);
        }
        $done({ body: JSON.stringify(obj) });
    } catch (e) {
        $done({});
    }
})();
