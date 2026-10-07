/**
 * 酷安 (Coolapk) 深度净化脚本
 *
 * 目标：
 * 1. 对开屏/唤醒接口返回 200 + 空结构，避免客户端回退到沙盒离线广告；
 * 2. 递归清理 /main/init、/main/index*、dataList* 及相关页面里的商业卡片；
 * 3. 清除 GDT、JAD、GroMore、Pangle 等 SDK 配置，及摇一摇/七鲜/商业 DeepLink；
 * 4. 保留普通帖子、评论、资讯和正常跳转，避免把整个业务响应替换为空字典。
 *
 * 兼容 Shadowrocket/Scripting runtime：只使用 ES5/ES2015 基础语法，不依赖 Node API。
 */

(function coolapkPro() {
    var request = (typeof $request !== "undefined" && $request) ? $request : null;
    var url = (request && request.url) ? String(request.url) : "";
    var hasResponse = typeof $response !== "undefined" && $response;

    var AD_KEYS = {
        "splash": true,
        "splashlist": true,
        "splashconfig": true,
        "launchad": true,
        "launchtime": true,
        "openscreen": true,
        "startupad": true,
        "bootad": true,
        "ad": true,
        "ads": true,
        "adlist": true,
        "adconfig": true,
        "advertisement": true,
        "advertising": true,
        "popup": true,
        "popups": true,
        "popwindow": true,
        "popupwindow": true,
        "interstitial": true,
        "interstitialad": true,
        "floatinglayer": true,
        "floatingwindow": true,
        "floatingad": true,
        "gdt": true,
        "gdtconfig": true,
        "gdtdata": true,
        "jad": true,
        "jadconfig": true,
        "jaddata": true,
        "gromore": true,
        "gromoreconfig": true,
        "gromoredata": true,
        "pangle": true,
        "pangleconfig": true,
        "pangledata": true,
        "mobads": true,
        "mobadsconfig": true,
        "thirdpartyad": true,
        "sdkad": true,
        "sdkconfig": true,
        "adparams": true,
        "addata": true,
        "adcontainer": true,
        "adslot": true,
        "adslots": true,
        "promocard": true,
        "promotioncard": true,
        "sponsorcard": true,
        "commercialcard": true,
        "commercialdata": true,
        "goodscard": true,
        "goodsgridcard": true,
        "splashvideo": true,
        "splashimage": true,
        "shakeconfig": true,
        "shaketoload": true,
        "shaketojump": true,
        "shakeaction": true,
        "adinfo": true,
        "adtag": true,
        "admetadata": true,
        "feedad": true,
        "marketingcard": true,
        "giftbox": true,
        "gift_box": true,
        "redpacket": true,
        "red_packet": true,
        "activitypopup": true,
        "marketingpopup": true,
        "gdttoken": true,
        "gdtslot": true,
        "biddingslot": true,
        "tencentad": true,
        "adnet": true,
        "tanx": true,
        "tanxconfig": true,
        "tanxdata": true,
        "tanxad": true,
        "alimama": true,
        "alimamaconfig": true,
        "alimamadata": true,
        "alimamaad": true,
        "alimm": true
    };


    // 请求阶段只 Mock 明确的开屏/广告接口；不要对 /main/init 等核心业务接口做 Socket REJECT。
    if (!hasResponse) {
        if (isSplashOrAdRequest(url)) {
            $done({
                response: {
                    status: 200,
                    headers: { "Content-Type": "application/json; charset=utf-8" },
                    body: JSON.stringify({
                        code: 0,
                        status: 0,
                        splash: null,
                        data: [],
                        ads: [],
                        ad_list: []
                    })
                }
            });
        } else {
            $done({});
        }
        return;
    }

    if (!$response.body) {
        $done({});
        return;
    }

    try {
        var obj = JSON.parse($response.body);
        var lowerUrl = url.toLowerCase();

        // 先按接口形态处理数组字段，随后再做一次全树清洗，覆盖新版本嵌套字段。
        if (lowerUrl.indexOf("/main/init") !== -1) {
            if (Array.isArray(obj.data)) obj.data = filterCoolapkList(obj.data);
            if (obj.config && typeof obj.config === "object") scrubObject(obj.config);
        } else if (lowerUrl.indexOf("/main/index") !== -1 || lowerUrl.indexOf("datalist") !== -1 || lowerUrl.indexOf("/feed/index") !== -1 || lowerUrl.indexOf("/feed/list") !== -1 || lowerUrl.indexOf("/feed/stream") !== -1) {
            if (Array.isArray(obj.data)) obj.data = filterCoolapkList(obj.data);
        } else if (lowerUrl.indexOf("/feed/detail") !== -1) {
            if (obj.data && typeof obj.data === "object") {
                clearArrayField(obj.data, "detailSponsorCard");
                clearArrayField(obj.data, "include_goods");
                clearArrayField(obj.data, "include_goods_ids");
                clearArrayField(obj.data, "goodsList");
                clearArrayField(obj.data, "goodsRows");
                if (Array.isArray(obj.data.hotReplyRows)) {
                    obj.data.hotReplyRows = obj.data.hotReplyRows.filter(function (item) {
                        return !isCoolapkReplyAd(item);
                    });
                }
                if (Array.isArray(obj.data.topReplyRows)) {
                    obj.data.topReplyRows = obj.data.topReplyRows.filter(function (item) {
                        return !isCoolapkReplyAd(item);
                    });
                }
            }
        } else if (lowerUrl.indexOf("/feed/replylist") !== -1) {
            if (Array.isArray(obj.data)) {
                obj.data = obj.data.filter(function (item) {
                    return !isCoolapkReplyAd(item);
                });
            }
        } else if (lowerUrl.indexOf("/account/profile") !== -1) {
            if (obj.data && Array.isArray(obj.data.entities)) {
                obj.data.entities = obj.data.entities.filter(function (item) {
                    return !isCoolapkAd(item);
                });
            }
        }

        // 深度递归：覆盖 popup/pop_window/interstitial/floating_layer、extraData.gdt/jad
        // 以及新版本可能改名的嵌套广告对象。
        scrubObject(obj);
        $done({ body: JSON.stringify(obj) });
    } catch (e) {
        // 对非 JSON、压缩异常或服务端错误响应保持原响应，不制造空字典/NSNull。
        $done({});
    }

    function isSplashOrAdRequest(target) {
        var path = String(target || "").toLowerCase().split("?")[0];
        return /\/(?:splash|launch(?:[_-]?ad)?|openscreen|open-screen|open_screen|startup(?:[_-]?ad)?|boot[_-]?ad)(?:\/|$)/i.test(path) ||
            /\/(?:ad|ads|advert|advertise|gdt|jad)(?:\/|$)/i.test(path) ||
            /(?:splash|open[_-]?screen|launch[_-]?ad|startup[_-]?ad|boot[_-]?ad)=/i.test(String(target || ""));
    }

    function clearArrayField(object, field) {
        if (object && Object.prototype.hasOwnProperty.call(object, field)) object[field] = [];
    }

    function filterCoolapkList(list) {
        return list.filter(function (item) {
            return item && !isCoolapkAd(item);
        }).map(function (item) {
            scrubObject(item);
            return item;
        });
    }

    // 递归删除广告专用 key，并在数组中删除完整的广告节点。
    function scrubObject(object) {
        if (!object || typeof object !== "object") return object;

        if (Array.isArray(object)) {
            var filtered = [];
            for (var i = 0; i < object.length; i++) {
                if (!object[i] || isCoolapkAd(object[i])) continue;
                scrubObject(object[i]);
                filtered.push(object[i]);
            }
            object.length = 0;
            for (var j = 0; j < filtered.length; j++) object.push(filtered[j]);
            return object;
        }

        var keys = Object.keys(object);
        for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            var value = object[key];
            var normalizedKey = key.toLowerCase().replace(/[\-_]/g, "");

            if (AD_KEYS[normalizedKey]) {
                delete object[key];
                continue;
            }

            if (isLinkKey(normalizedKey) && typeof value === "string" && isCommercialLink(value)) {
                delete object[key];
                continue;
            }

            if (Array.isArray(value)) {
                var kept = [];
                for (var a = 0; a < value.length; a++) {
                    if (!value[a] || isCoolapkAd(value[a])) continue;
                    scrubObject(value[a]);
                    kept.push(value[a]);
                }
                object[key] = kept;
            } else if (value && typeof value === "object") {
                // 只删除当前字段确实是商业卡片的对象，然后继续清理普通容器。
                // 不能因为普通容器的子节点里出现 gdt/jad 元数据就误删整个父对象。
                var hasEntityShape = value.entityId !== undefined || value.entityType !== undefined ||
                    value.entityTemplate !== undefined || value.is_ad === true || value.isAd === true;
                if (hasEntityShape && isCoolapkAd(value)) {
                    delete object[key];
                    continue;
                }
                scrubObject(value);
            }
        }
        return object;
    }

    function isLinkKey(normalizedKey) {
        return normalizedKey === "url" || normalizedKey === "link" || normalizedKey === "jumpurl" ||
            normalizedKey === "deeplink" || normalizedKey === "landingpage" || normalizedKey === "landingurl" ||
            normalizedKey === "openurl" || normalizedKey === "redirecturl" || normalizedKey === "clickurl" ||
            normalizedKey === "adurl" || normalizedKey === "schema" || normalizedKey === "targeturl" ||
            normalizedKey === "appscheme" || normalizedKey === "appurl" || normalizedKey === "openapp" ||
            normalizedKey === "intent" || normalizedKey === "downloadurl" || normalizedKey === "promourl" ||
            normalizedKey === "actionurl" || normalizedKey === "actionlink";
    }

    function isCommercialLink(value) {
        var link = String(value || "").toLowerCase();
        for (var i = 0; i < 2; i++) {
            try {
                var decoded = decodeURIComponent(link);
                if (decoded === link) break;
                link = decoded;
            } catch (e) {
                break;
            }
        }
        return /(?:gdt\.qq\.com|adnet\.qq\.com|gdtimg\.com|ugdtimg\.com|pgdt\.gtimg\.cn|qzs\.qq\.com|qzs\.gdtimg\.com|e\.qq\.com|ad\.qq\.com|tmead(?:quic)?\.y\.qq\.com|ad(?:stats)?\.tencentmusic\.com|jad\.jd\.com|jadyun\.com|dsp-x\.jd\.com|(?:^|[./])ad\.jd\.com|jd\.com\/(?:[^?#]+\/)?(?:ad|ads|union|promotion)(?:[/?&#]|$)|7fresh\.com|qixian\.com|pangolin-sdk|pangle|gromore|mobads\.baidu\.com|adukwai|kuaishouzt|sigmob|toponad|mintegral|tanx\.com|alimama\.(?:com|cn|net)|atanx\d?\.alicdn\.com|alimama\.alicdn\.com|alimm\.com|strip\.taobaocdn\.com)/i.test(link) ||
            /^(?:jdmobile|jdapp|openapp\.jdmobile|jdpay|gdt|tbopen|taobao|tmall|pinduoduo|alipays|snssdk1128|kwai|vipshop|meituan|dianping):/i.test(link);
    }

    function isCoolapkAd(item) {
        if (!item || typeof item !== "object") return false;

        var adEntityIds = [944, 945, 1373, 6390, 8639, 20099, 20131, 21703,
            24455, 28212, 29349, 31114, 32557, 33006, 36839, 39396, 43906];
        if (adEntityIds.indexOf(Number(item.entityId)) !== -1) return true;

        var type = String(item.entityType || "").toLowerCase();
        var template = String(item.entityTemplate || "").toLowerCase();
        if (/(?:splash|advert|adcard|feed_ad|sponsor|popup|interstitial|floating|imagescalecard|goodscard|goodsgridcard|commercial|marketing|promocard)/i.test(type + " " + template)) return true;

        // 标签/来源判定
        if (item.tag === "广告" || item.label === "广告" || item.tag === "赞助" || item.label === "赞助" ||
            item.tag === "推广" || item.source_type === "ad" || item.sourceType === "ad") return true;

        var hasChildren = (Array.isArray(item.entities) && item.entities.length > 0) ||
            (Array.isArray(item.rows) && item.rows.length > 0) ||
            (Array.isArray(item.items) && item.items.length > 0);

        // 明确的 SDK/广告元数据或客户端唤醒对象
        var flags = ["is_ad", "isAd", "is_feed_ad", "isFeedAd", "advertisement", "raw_ad_data", "ad_info", "ad_tag",
            "ad_id", "adId", "ad_type", "adType", "sponsor", "gdt", "adnet", "jad", "gromore", "pangle",
            "mobads", "sigmob", "topon", "mintegral", "tanx", "tanx_ad", "tanxAd", "alimama", "alimama_ad", "alimamaAd", "alimm",
            "popup", "pop_window", "interstitial", "floating_layer"];
        for (var i = 0; i < flags.length; i++) {
            var fVal = item[flags[i]];
            if (isEnabled(fVal) || (fVal && typeof fVal === "object" && Object.keys(fVal).length > 0)) {
                if (!hasChildren) return true;
            }
        }

        var text = [item.title, item.subTitle, item.subtitle, item.description, item.buttonText,
            item.actionText, item.label, item.tag].filter(Boolean).join(" ");
        var hasStrongCommercialText = /广告|开屏|赞助|七鲜|优量汇|广点通|京媒|穿山甲|阿里妈妈|tanx|摇一摇|摇动|点击了解更多|自动关闭/i.test(text);
        var hasWeakCommercialText = /推广|带货|好物|礼盒/i.test(text);
        var hasCommercialLink = false;
        var linkKeys = ["url", "link", "jump_url", "jumpUrl", "deepLink", "deeplink",
            "landing_page", "landing_url", "open_url", "redirect_url", "redirectUrl",
            "click_url", "clickUrl", "ad_url", "adUrl", "schema", "appScheme", "appUrl",
            "openApp", "intent", "downloadUrl", "promoUrl", "actionUrl", "actionLink"];
        for (var l = 0; l < linkKeys.length; l++) {
            if (typeof item[linkKeys[l]] === "string" && isCommercialLink(item[linkKeys[l]])) {
                hasCommercialLink = true;
                break;
            }
        }

        var extra = item.extraData;
        var hasSdkAdMeta = false;
        if (extra && typeof extra === "object") {
            var extraKeys = ["gdt", "gdt_ad", "gdt_token", "gdtdata", "adnet", "jad", "jad_ad", "jaddata",
                "gromore", "pangle", "mobads", "baidu_ad", "tencent_ad", "kuaishou", "sigmob", "topon",
                "mintegral", "tanx", "tanx_ad", "tanxdata", "alimama", "alimama_ad", "alimamadata", "alimm",
                "popup", "pop_window", "popwindow", "interstitial", "floating_layer",
                "floating_window", "shake", "shaketojump", "shake_config", "ad", "ads", "ad_id",
                "ad_type", "ad_source", "ad_tag", "pos_id", "posId", "slot_id", "ad_slot", "is_ad"];
            for (var e = 0; e < extraKeys.length; e++) {
                var eVal = extra[extraKeys[e]];
                if (eVal && (typeof eVal !== "object" || Object.keys(eVal).length > 0)) {
                    hasSdkAdMeta = true;
                    break;
                }
            }
        }

        var isCardLike = template === "card" || type === "card" || type === "feed" || item.entityId !== undefined;
        var isAdLikeType = /(?:ad|advert|sponsor|popup|interstitial|floating|goods|promo|commercial)/i.test(type + " " + template);

        // 如果单条Feed卡片带有SDK广告元数据（无子节点容器），直接判定为广告整卡剔除
        if (hasSdkAdMeta && !hasChildren) return true;

        if (isCardLike) {
            if (hasStrongCommercialText || hasCommercialLink) return true;
            // “推广/礼盒/好物”本身可能出现在普通帖子正文；只有卡片类型或 SDK 广告元数据同时出现时才删除。
            if (hasWeakCommercialText && (isAdLikeType || hasSdkAdMeta)) return true;
            if (hasSdkAdMeta && isAdLikeType) return true;
        }
        if (String(item.title || "") === "酷安热搜") return true;
        return false;
    }

    function isEnabled(value) {
        return value === true || value === 1 || value === "1" || value === "true";
    }

    function isCoolapkReplyAd(item) {
        if (!item || !item.id) return true;
        return isCoolapkAd(item) || item.entityType === "ad" || item.entityTemplate === "reply_ad" ||
            (item.extraData && (item.extraData.ad || item.extraData.gdt || item.extraData.jad || item.extraData.adnet || item.extraData.tanx || item.extraData.alimama));
    }
})();
