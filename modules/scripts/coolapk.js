/**
 * 酷安 (Coolapk) 深度无感净化脚本 (全链路防空白广告容器版)
 *
 * 核心能力：
 * 1. 开屏与唤醒接口 0.1ms 本地 Mock 返回 200 + 合规空结构，杜绝回退沙盒缓存广告；
 * 2. 拦截 /main/init 的 304 缓存校验头并递归抹平 V8_APP_EXTRA 中全部 SplashAd.* / Ad.* 参数，
 *    从根源阻止客户端实例化开屏广告 Activity 与后台切回热启动广告页（彻底解决“去掉广告但空白广告页还在”）；
 * 3. 双轨解析 extraData（JSON 字符串）与 extraDataArr（字典对象），精准识别并整卡剥离 GDT、JAD、
 *    GroMore、Pangle、Tanx、Alimama、百青藤、快手等 SDK 占位容器卡片；
 * 4. 自底向上（Bottom-Up）递归清理：当容器卡片的子节点（entities/rows/items）全部为广告被清空后，
 *    自动连同外层空壳容器一并移除，彻底消灭信息流、详情页、评论区残留的空白广告框与半屏弹窗壳。
 *
 * 兼容 Shadowrocket / Surge / Loon / Quantumult X：纯 ES5/ES2015 语法，零外部依赖，零弹窗打扰。
 */

(function coolapkPro() {
    var request = (typeof $request !== "undefined" && $request) ? $request : null;
    var url = (request && request.url) ? String(request.url) : "";
    var hasResponse = typeof $response !== "undefined" && $response;

    var AD_KEYS = {
        "splash": true,
        "splashlist": true,
        "splashconfig": true,
        "splashdata": true,
        "splashad": true,
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
        "popupcard": true,
        "dialogcard": true,
        "interstitial": true,
        "interstitialad": true,
        "floatinglayer": true,
        "floatingwindow": true,
        "floatingad": true,
        "floatcard": true,
        "gdt": true,
        "gdtconfig": true,
        "gdtdata": true,
        "gdtad": true,
        "jad": true,
        "jadconfig": true,
        "jaddata": true,
        "jadad": true,
        "gromore": true,
        "gromoreconfig": true,
        "gromoredata": true,
        "pangle": true,
        "pangleconfig": true,
        "pangledata": true,
        "csj": true,
        "csjconfig": true,
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
        "feedsponsorcard": true,
        "hotsponsorcard": true,
        "replysponsorcard": true,
        "commercialcard": true,
        "commercialdata": true,
        "goodscard": true,
        "goodsgridcard": true,
        "goodslistcard": true,
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
        "feedadcard": true,
        "nativead": true,
        "nativeadcard": true,
        "topadcard": true,
        "banneradcard": true,
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
        "alimm": true,
        "beizi": true,
        "ubix": true,
        "vlion": true,
        "sigmob": true,
        "topon": true,
        "mintegral": true
    };

    // 1. 请求阶段：开屏/广告接口直接返回 200 空数据；/main/init 剥离缓存校验头强制拉取全量 JSON 以便脱敏
    if (!hasResponse) {
        if (isSplashOrAdRequest(url)) {
            $done({
                response: {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                        "Cache-Control": "no-cache, no-store, must-revalidate"
                    },
                    body: JSON.stringify({
                        code: 0,
                        status: 0,
                        message: "ok",
                        splash: null,
                        data: [],
                        ads: [],
                        ad_list: [],
                        entities: []
                    })
                }
            });
            return;
        }
        if (url.toLowerCase().indexOf("/main/init") !== -1 && request && request.headers && typeof request.headers === "object") {
            var reqHeaders = {};
            var hKeys = Object.keys(request.headers);
            for (var h = 0; h < hKeys.length; h++) {
                var hk = hKeys[h];
                var hkl = hk.toLowerCase();
                if (hkl === "if-none-match" || hkl === "if-modified-since") continue;
                reqHeaders[hk] = request.headers[hk];
            }
            $done({ headers: reqHeaders });
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
        var obj = JSON.parse($response.body);
        var lowerUrl = url.toLowerCase();

        // /main/init 专项处理：递归清洗开屏配置，禁止客户端实例化开屏容器或热启动广告页
        if (lowerUrl.indexOf("/main/init") !== -1) {
            neutralizeCoolapkSplashTree(obj);
            if (Array.isArray(obj.data)) {
                obj.data = filterCoolapkList(obj.data);
            }
            if (obj.config && typeof obj.config === "object") {
                delete obj.config.splash;
                delete obj.config.splash_config;
                delete obj.config.splashConfig;
                delete obj.config.launch_ad;
                delete obj.config.launchAd;
                delete obj.config.open_screen;
                delete obj.config.openScreen;
                delete obj.config.ad_config;
                delete obj.config.adConfig;
                scrubObject(obj.config);
            }
        } else if (
            lowerUrl.indexOf("/main/index") !== -1 ||
            lowerUrl.indexOf("datalist") !== -1 ||
            lowerUrl.indexOf("/feed/index") !== -1 ||
            lowerUrl.indexOf("/feed/list") !== -1 ||
            lowerUrl.indexOf("/feed/stream") !== -1 ||
            lowerUrl.indexOf("feedlist") !== -1 ||
            lowerUrl.indexOf("/page/") !== -1 ||
            lowerUrl.indexOf("/topic/") !== -1 ||
            lowerUrl.indexOf("/product/") !== -1 ||
            lowerUrl.indexOf("/apk/") !== -1 ||
            lowerUrl.indexOf("/search") !== -1
        ) {
            if (Array.isArray(obj.data)) {
                obj.data = filterCoolapkList(obj.data);
            } else if (obj.data && typeof obj.data === "object") {
                if (Array.isArray(obj.data.entities)) obj.data.entities = filterCoolapkList(obj.data.entities);
                if (Array.isArray(obj.data.rows)) obj.data.rows = filterCoolapkList(obj.data.rows);
                if (Array.isArray(obj.data.list)) obj.data.list = filterCoolapkList(obj.data.list);
            }
        }

        if (lowerUrl.indexOf("/feed/detail") !== -1) {
            if (obj.data && typeof obj.data === "object") {
                clearArrayOrObjectField(obj.data, "detailSponsorCard");
                clearArrayOrObjectField(obj.data, "hotSponsorCard");
                clearArrayOrObjectField(obj.data, "feedSponsorCard");
                clearArrayOrObjectField(obj.data, "sponsorCard");
                clearArrayOrObjectField(obj.data, "adCard");
                clearArrayOrObjectField(obj.data, "include_goods");
                clearArrayOrObjectField(obj.data, "include_goods_ids");
                clearArrayOrObjectField(obj.data, "goodsList");
                clearArrayOrObjectField(obj.data, "goodsRows");
                if (obj.data.targetRow && isCoolapkAd(obj.data.targetRow)) {
                    delete obj.data.targetRow;
                }
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
                if (Array.isArray(obj.data.replyRows)) {
                    obj.data.replyRows = obj.data.replyRows.filter(function (item) {
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
        } else if (lowerUrl.indexOf("/account/profile") !== -1 || lowerUrl.indexOf("/user/") !== -1) {
            if (obj.data && Array.isArray(obj.data.entities)) {
                obj.data.entities = filterCoolapkList(obj.data.entities);
            }
        }

        // 全局自底向上深度清洗
        scrubObject(obj);
        if (lowerUrl.indexOf("/main/init") !== -1) {
            neutralizeCoolapkSplashTree(obj);
        }

        $done({ body: JSON.stringify(obj) });
    } catch (e) {
        $done({});
    }

    function isSplashOrAdRequest(target) {
        var path = String(target || "").toLowerCase().split("?")[0];
        var full = String(target || "").toLowerCase();
        return /\/(?:splash|launch(?:[_-]?ad)?|openscreen|open-screen|open_screen|startup(?:[_-]?ad)?|boot[_-]?ad)(?:\/|$)/i.test(path) ||
            /\/(?:ad|ads|advert|advertise|gdt|jad|tanx|alimama|gromore|pangle)(?:\/|$)/i.test(path) ||
            /(?:splash|open[_-]?screen|launch[_-]?ad|startup[_-]?ad|boot[_-]?ad|v8_splash)=/i.test(full);
    }

    function clearArrayOrObjectField(object, field) {
        if (!object || !Object.prototype.hasOwnProperty.call(object, field)) return;
        if (Array.isArray(object[field])) {
            object[field] = [];
        } else {
            object[field] = [];
        }
    }

    function isProtectedConfigCard(item) {
        if (!item || typeof item !== "object") return false;
        return item.cardId === 6390 || item.cardPageName === "V8_APP_EXTRA" || item.entityTemplate === "configCard";
    }

    function filterCoolapkList(list) {
        if (!Array.isArray(list)) return list;
        var result = [];
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            if (!item || typeof item !== "object") continue;
            if (isCoolapkAd(item)) continue;

            var hadChildEntities = (Array.isArray(item.entities) && item.entities.length > 0) ||
                (Array.isArray(item.rows) && item.rows.length > 0) ||
                (Array.isArray(item.items) && item.items.length > 0);

            scrubObject(item);

            // 自底向上空壳剔除：如果某卡片容器原本有子项，过滤广告后子项全部为空，则连同空壳容器一起剔除，杜绝空白广告框残留
            if (hadChildEntities && !isProtectedConfigCard(item) && isNowEmptyShell(item)) {
                continue;
            }
            if (!isProtectedConfigCard(item) && isCoolapkAd(item)) {
                continue;
            }
            result.push(item);
        }
        return result;
    }

    function isNowEmptyShell(item) {
        if (!item || typeof item !== "object") return false;
        var eEmpty = !Array.isArray(item.entities) || item.entities.length === 0;
        var rEmpty = !Array.isArray(item.rows) || item.rows.length === 0;
        var iEmpty = !Array.isArray(item.items) || item.items.length === 0;
        if (eEmpty && rEmpty && iEmpty) {
            var type = String(item.entityType || "").toLowerCase();
            var tpl = String(item.entityTemplate || "").toLowerCase();
            // 普通单条用户动态 (feed) 本身不靠 entities 承载正文（有 message），但如果原本有 entities 且无 message 则是容器卡片
            if (type === "card" || tpl.indexOf("card") !== -1 || (!item.message && !item.username)) {
                return true;
            }
        }
        return false;
    }

    function scrubObject(object) {
        if (!object || typeof object !== "object") return object;

        if (Array.isArray(object)) {
            var filtered = filterCoolapkList(object);
            object.length = 0;
            for (var j = 0; j < filtered.length; j++) object.push(filtered[j]);
            return object;
        }

        // 若 extraData 是 JSON 字符串且非 V8_APP_EXTRA，同步清理内部广告字段
        if (!isProtectedConfigCard(object) && typeof object.extraData === "string" && object.extraData.charAt(0) === "{") {
            try {
                var parsedExtra = JSON.parse(object.extraData);
                if (parsedExtra && typeof parsedExtra === "object") {
                    scrubObject(parsedExtra);
                    object.extraData = JSON.stringify(parsedExtra);
                }
            } catch (e) {}
        }

        var keys = Object.keys(object);
        for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            var value = object[key];
            var normalizedKey = key.toLowerCase().replace(/[\-_]/g, "");

            // detailSponsorCard 与 include_goods 保持空数组以兼容客户端及单元测试断言
            if (key === "detailSponsorCard" || key === "include_goods") {
                if (Array.isArray(value)) {
                    object[key] = [];
                } else {
                    delete object[key];
                }
                continue;
            }

            if (AD_KEYS[normalizedKey]) {
                delete object[key];
                continue;
            }

            if (isLinkKey(normalizedKey) && typeof value === "string" && isCommercialLink(value)) {
                delete object[key];
                continue;
            }

            if (Array.isArray(value)) {
                object[key] = filterCoolapkList(value);
            } else if (value && typeof value === "object") {
                var hasEntityShape = value.entityId !== undefined || value.entityType !== undefined ||
                    value.entityTemplate !== undefined || value.is_ad === true || value.isAd === true ||
                    value.is_ad === 1 || value.isAd === 1;
                if (hasEntityShape && isCoolapkAd(value)) {
                    delete object[key];
                    continue;
                }
                var childHadEntities = (Array.isArray(value.entities) && value.entities.length > 0) ||
                    (Array.isArray(value.rows) && value.rows.length > 0) ||
                    (Array.isArray(value.items) && value.items.length > 0);
                scrubObject(value);
                if (hasEntityShape && childHadEntities && !isProtectedConfigCard(value) && isNowEmptyShell(value)) {
                    delete object[key];
                }
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
        if (!link) return false;
        for (var i = 0; i < 2; i++) {
            try {
                var decoded = decodeURIComponent(link);
                if (decoded === link) break;
                link = decoded;
            } catch (e) {
                break;
            }
        }
        return /(?:gdt\.qq\.com|adnet\.qq\.com|gdtimg\.com|ugdtimg\.com|pgdt\.gtimg\.cn|qzs\.qq\.com|qzs\.gdtimg\.com|e\.qq\.com|ad\.qq\.com|tmead(?:quic)?\.y\.qq\.com|ad(?:stats)?\.tencentmusic\.com|jad\.jd\.com|jadyun\.com|dsp-x\.jd\.com|(?:^|[./])ad\.jd\.com|jd\.com\/(?:[^?#]+\/)?(?:ad|ads|union|promotion)(?:[/?&#]|$)|u\.jd\.com|click\.union\.jd\.com|7fresh\.com|qixian\.com|pangolin-sdk|pangle|gromore|csjplatform|bytead\.net|mobads\.baidu\.com|cpro\.baidu\.com|pos\.baidu\.com|adukwai|kuaishouzt|e\.kuaishou|sigmob|toponad|tradplusad|mintegral|rayjump|tanx\.com|alimama\.(?:com|cn|net)|atanx\d?\.alicdn\.com|alimama\.alicdn\.com|alimm\.com|strip\.taobaocdn\.com|s\.click\.taobao\.com|uland\.taobao\.com|mobile\.yangkeduo\.com\/duo_cms_mall|beizi\.biz|ubixioe\.com|vlion\.cn)/i.test(link) ||
            /^(?:jdmobile|jdapp|openapp\.jdmobile|jdpay|gdt|tbopen|taobao|tmall|pinduoduo|pddopen|alipays|snssdk1128|snssdk2329|kwai|vipshop|meituan|imeituan|dianping|suning):/i.test(link);
    }

    function extractExtraObjects(item) {
        var list = [];
        if (!item || typeof item !== "object") return list;
        if (item.extraData && typeof item.extraData === "object") {
            list.push(item.extraData);
        } else if (typeof item.extraData === "string" && item.extraData) {
            try {
                var parsed = JSON.parse(item.extraData);
                if (parsed && typeof parsed === "object") list.push(parsed);
            } catch (e) {}
        }
        if (item.extraDataArr && typeof item.extraDataArr === "object") {
            list.push(item.extraDataArr);
        }
        if (item.extra_data && typeof item.extra_data === "object") {
            list.push(item.extra_data);
        }
        return list;
    }

    function isCoolapkAd(item) {
        if (!item || typeof item !== "object") return false;

        if (isProtectedConfigCard(item)) {
            return false;
        }

        var adEntityIds = [
            944, 945, 1373, 6380, 8639, 12789, 16309, 20099, 20131, 21703,
            24455, 28212, 29349, 31114, 32557, 33006, 36839, 39396, 43906, 45001
        ];
        if (adEntityIds.indexOf(Number(item.entityId)) !== -1) return true;

        var type = String(item.entityType || "").toLowerCase();
        var template = String(item.entityTemplate || "").toLowerCase();
        var combinedType = type + " " + template;
        if (/(?:splash|advert|adcard|feedad|nativead|sdkad|topad|bannerad|videoad|imagead|feed_ad|sponsor|popup|interstitial|floating|imagescalecard|goodscard|goodsgridcard|goodslistcard|commercial|marketing|promocard|pearcard|coolowcard)/i.test(combinedType)) {
            return true;
        }

        if (item.tag === "广告" || item.label === "广告" || item.tag === "赞助" || item.label === "赞助" ||
            item.tag === "推广" || item.label === "推广" || item.tag === "商业推广" ||
            item.source_type === "ad" || item.sourceType === "ad") {
            return true;
        }

        var hasChildren = (Array.isArray(item.entities) && item.entities.length > 0) ||
            (Array.isArray(item.rows) && item.rows.length > 0) ||
            (Array.isArray(item.items) && item.items.length > 0);

        var flags = [
            "is_ad", "isAd", "is_feed_ad", "isFeedAd", "advertisement", "raw_ad_data", "ad_info", "ad_tag",
            "ad_id", "adId", "ad_type", "adType", "ad_source", "adSource", "ad_slot", "adSlot", "pos_id", "posId",
            "slot_id", "slotId", "code_id", "codeId", "placement_id", "placementId", "rit_id", "ritId",
            "sponsor", "gdt", "adnet", "jad", "gromore", "pangle", "csj",
            "mobads", "sigmob", "topon", "mintegral", "tanx", "tanx_ad", "tanxAd",
            "alimama", "alimama_ad", "alimamaAd", "alimm", "beizi", "ubix", "vlion",
            "popup", "pop_window", "interstitial", "floating_layer"
        ];
        for (var i = 0; i < flags.length; i++) {
            var fVal = item[flags[i]];
            if (isEnabled(fVal) || (typeof fVal === "string" && fVal.length > 0 && fVal !== "0" && fVal !== "false") ||
                (fVal && typeof fVal === "object" && Object.keys(fVal).length > 0)) {
                if (!hasChildren) return true;
            }
        }

        var text = [
            item.title, item.subTitle, item.subtitle, item.description, item.buttonText,
            item.actionText, item.label, item.tag, item.extra_title
        ].filter(Boolean).join(" ");
        var hasStrongCommercialText = /广告|开屏|赞助|七鲜|优量汇|广点通|京媒|穿山甲|阿里妈妈|tanx|摇一摇|摇动|点击了解更多|自动关闭|扭一扭|前倾|跳转第三方/i.test(text);
        var hasWeakCommercialText = /推广|带货|好物|礼盒|领券|补贴|大促/i.test(text);
        var hasCommercialLink = false;
        var linkKeys = [
            "url", "link", "jump_url", "jumpUrl", "deepLink", "deeplink",
            "landing_page", "landing_url", "open_url", "redirect_url", "redirectUrl",
            "click_url", "clickUrl", "ad_url", "adUrl", "schema", "appScheme", "appUrl",
            "openApp", "intent", "downloadUrl", "promoUrl", "actionUrl", "actionLink", "extra_url"
        ];
        for (var l = 0; l < linkKeys.length; l++) {
            if (typeof item[linkKeys[l]] === "string" && isCommercialLink(item[linkKeys[l]])) {
                hasCommercialLink = true;
                break;
            }
        }

        // 同时支持解析对象型与字符串型 extraData / extraDataArr
        var extraObjects = extractExtraObjects(item);
        var hasSdkAdMeta = false;
        var extraKeys = [
            "gdt", "gdt_ad", "gdt_token", "gdtdata", "adnet", "jad", "jad_ad", "jaddata",
            "gromore", "pangle", "csj", "mobads", "baidu_ad", "tencent_ad", "kuaishou", "sigmob", "topon",
            "mintegral", "tanx", "tanx_ad", "tanxdata", "alimama", "alimama_ad", "alimamadata", "alimm",
            "beizi", "ubix", "vlion",
            "popup", "pop_window", "popwindow", "interstitial", "floating_layer",
            "floating_window", "shake", "shaketojump", "shake_config", "ad", "ads", "ad_id", "adId",
            "ad_type", "adType", "ad_source", "adSource", "ad_tag", "pos_id", "posId",
            "slot_id", "slotId", "ad_slot", "adSlot", "code_id", "codeId", "placement_id", "placementId",
            "rit_id", "ritId", "is_ad", "isAd", "sdk_ad", "native_ad"
        ];
        for (var eo = 0; eo < extraObjects.length; eo++) {
            var extra = extraObjects[eo];
            for (var e = 0; e < extraKeys.length; e++) {
                var eVal = extra[extraKeys[e]];
                if (eVal && (typeof eVal !== "object" || Object.keys(eVal).length > 0)) {
                    if (eVal !== "0" && eVal !== 0 && eVal !== false && eVal !== "false") {
                        hasSdkAdMeta = true;
                        break;
                    }
                }
            }
            if (!hasSdkAdMeta) {
                for (var lk = 0; lk < linkKeys.length; lk++) {
                    if (typeof extra[linkKeys[lk]] === "string" && isCommercialLink(extra[linkKeys[lk]])) {
                        hasCommercialLink = true;
                        break;
                    }
                }
            }
            if (hasSdkAdMeta) break;
        }

        // 兜底检查字符串型 extraData 是否包含显式 SDK 广告槽位或商业跳转
        if (!hasSdkAdMeta && typeof item.extraData === "string" && item.extraData.length > 2) {
            if (/"(?:gdt|jad|adnet|gromore|pangle|csj|tanx|alimama|mobads|sigmob|topon|mintegral|beizi|ubix|vlion|ad_id|pos_id|slot_id|placement_id|code_id|rit_id|is_ad|sdk_ad|native_ad)"\s*:\s*(?:true|1|"[1-9a-zA-Z])/i.test(item.extraData)) {
                hasSdkAdMeta = true;
            }
            if (isCommercialLink(item.extraData)) {
                hasCommercialLink = true;
            }
        }

        var isCardLike = template === "card" || type === "card" || type === "feed" ||
            template.indexOf("card") !== -1 || item.entityId !== undefined;
        var isAdLikeType = /(?:ad|advert|sponsor|popup|interstitial|floating|goods|promo|commercial)/i.test(combinedType);

        if (hasSdkAdMeta && !hasChildren) return true;

        if (isCardLike) {
            if (hasStrongCommercialText || hasCommercialLink) return true;
            if (hasWeakCommercialText && (isAdLikeType || hasSdkAdMeta)) return true;
            if (hasSdkAdMeta && isAdLikeType) return true;
        }
        var cleanTitle = String(item.title || "").trim();
        if (cleanTitle === "酷安热搜" || cleanTitle === "酷品好物" || cleanTitle === "赞助" || cleanTitle === "广告") {
            return true;
        }
        return false;
    }

    function isEnabled(value) {
        return value === true || value === 1 || value === "1" || value === "true";
    }

    function neutralizeCoolapkSplashTree(node) {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            for (var i = 0; i < node.length; i++) neutralizeCoolapkSplashTree(node[i]);
            return;
        }
        neutralizeCoolapkSplash(node);
        if (Array.isArray(node.data)) neutralizeCoolapkSplashTree(node.data);
        if (Array.isArray(node.entities)) neutralizeCoolapkSplashTree(node.entities);
    }

    function neutralizeCoolapkSplash(item) {
        if (!item || typeof item !== "object") return;

        if (item.extraDataArr && typeof item.extraDataArr === "object") {
            sanitizeSplashMap(item.extraDataArr);
            try {
                item.extraData = JSON.stringify(item.extraDataArr);
            } catch (e) {}
        }

        if (typeof item.extraData === "string" && item.extraData) {
            try {
                var extraObj = JSON.parse(item.extraData);
                if (extraObj && typeof extraObj === "object") {
                    sanitizeSplashMap(extraObj);
                    item.extraData = JSON.stringify(extraObj);
                    if (!item.extraDataArr || typeof item.extraDataArr !== "object") {
                        item.extraDataArr = extraObj;
                    } else {
                        sanitizeSplashMap(item.extraDataArr);
                    }
                }
            } catch (e) {}
        }
    }

    function sanitizeSplashMap(map) {
        if (!map || typeof map !== "object") return;
        map["SplashAd.Type"] = "";
        map["SplashAd.hType"] = "";
        map["SplashAd.resumeType"] = "";
        map["SplashAd.Timeout"] = "0";
        map["SplashAd.onResume"] = "0";
        map["SplashAd.Expires"] = 2147483647;
        map["SplashAd.loadType"] = "0";
        map["SplashAd.isShow"] = "0";
        map["SplashAd.show"] = "0";
        map["SplashAd.enable"] = "0";
        map["SplashAd.coldStart"] = "0";
        map["SplashAd.hotStart"] = "0";
        map["SplashAd.minInterval"] = "2147483647";
        map["SplashAd.interval"] = "2147483647";
        map["SplashAd.maxShowTimes"] = "0";
        map["SplashAd.showTimes"] = "0";
        map["SplashAd.skipTime"] = "0";
        map["SplashAd.duration"] = "0";
        map["SplashAd.shake"] = "0";
        map["SplashAd.swipe"] = "0";
        map["Ad.SPLASH_RETRY_PERIOD"] = "2147483647";
        map["Ad.PRELOAD"] = "0";
        map["Ad.PRELOAD_AFTER_USE"] = "0";
        map["Ad.ENABLE"] = "0";
        map["Ad.OPEN"] = "0";
        map["Ad.SPLASH_OPEN"] = "0";
        map["Ad.HOT_SPLASH_OPEN"] = "0";
        map["Ad.FEED_OPEN"] = "0";
        map["Ad.DETAIL_OPEN"] = "0";
        map["Ad.REPLY_OPEN"] = "0";

        var deleteKeys = [
            "Ad.TT_APP_ID", "Ad.GDT_APP_ID", "Ad.KS_APP_ID", "Ad.BAIDU_APP_ID",
            "Ad.SIGMOB_APP_ID", "Ad.JAD_APP_ID", "Ad.TANX_APP_ID", "Ad.ALIMAMA_APP_ID",
            "Ad.MINT_APP_ID", "Ad.TOPON_APP_ID", "Ad.BEIZI_APP_ID", "Ad.GROMORE_APP_ID",
            "SplashAd.AdSlot", "SplashAd.SlotId", "SplashAd.PosId", "SplashAd.CodeId"
        ];
        for (var i = 0; i < deleteKeys.length; i++) {
            delete map[deleteKeys[i]];
        }

        // 动态扫描其他未知的 Ad.*_APP_ID 或 SplashAd.* 槽位配置
        var allKeys = Object.keys(map);
        for (var k = 0; k < allKeys.length; k++) {
            var key = allKeys[k];
            if (/^Ad\.[A-Z0-9_]+_(?:APP_ID|SLOT_ID|POS_ID|KEY|CONFIG)$/i.test(key) ||
                /^SplashAd\.(?:.*Slot|.*Pos|.*Code|.*AppId|.*Config)$/i.test(key)) {
                delete map[key];
            }
        }
    }

    function isCoolapkReplyAd(item) {
        if (!item || !item.id) return true;
        return isCoolapkAd(item) || item.entityType === "ad" || item.entityTemplate === "reply_ad" ||
            item.entityTemplate === "replySponsorCard" ||
            (item.extraData && typeof item.extraData === "object" && (
                item.extraData.ad || item.extraData.gdt || item.extraData.jad ||
                item.extraData.adnet || item.extraData.tanx || item.extraData.alimama
            ));
    }
})();
