/** Shadowrocket only: preserve question navigation and normal hot-list cards.
 * Explicit ad/SDK/MCN cards remain filtered; generic trackers and layout slots
 * are NOT evidence that a question or answer is an advertisement.
 * Regression fixtures are synthetic, not a claim of device-capture validation.
 */

(function zhihuPro() {
    var request = (typeof $request !== "undefined" && $request) ? $request : null;
    var rawUrl = (request && request.url) ? String(request.url) : "";
    var url = rawUrl.split(/[?#]/)[0];
    var hasResponse = typeof $response !== "undefined" && $response;

    if (!hasResponse || !$response.body) {
        $done({});
        return;
    }

    try {
        var body = JSON.parse($response.body);

        // 1. 新版广告样式、MCN带货卡接口与边缘广告服务直接返回合规空结构
        if (
            url.indexOf("/ad-style-service/") !== -1 ||
            url.indexOf("/mcn/") !== -1 ||
            url.indexOf("/bazaar/") !== -1 ||
            url.indexOf("/ecommerce/") !== -1 ||
            url.indexOf("/fringe/") !== -1
        ) {
            body = { code: 0, message: "success", data: [] };
        }
        // 2. 开屏广告与商业启动兜底
        else if (url.indexOf("/commercial_api/real_time_launch") !== -1 || url.indexOf("/commercial_api/launch_v2") !== -1) {
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
            if (Array.isArray(body.ads)) body.ads = [];
            if (body.data && typeof body.data === "object") body.data = {};
        }
        // 3. 首页悬浮营销球、活动浮窗、横幅及其他 commercial_api 接口
        else if (/\/commercial_api\/(?:banners_v3|app_float_layer|feed_float_layer)(?:\/|$)/.test(url)) {
            body = {};
        }
        // 4. 新版信息流聚合根接口 (feed-root/sections/query/v2 & feed-root/section/*)
        else if (url.indexOf("/feed-root/") !== -1) {
            stripTopLevelAdMeta(body);
            if (Array.isArray(body.data)) {
                body.data = filterAndCleanZhihuList(body.data);
            }
            if (Array.isArray(body.items)) {
                body.items = filterAndCleanZhihuList(body.items);
            }
            if (Array.isArray(body.sections)) {
                body.sections = body.sections.filter(function (sec) {
                    if (!sec || typeof sec !== "object") return false;
                    if (sec.type === "commercial" || sec.section_type === "ad" || sec.section_type === "commercial" || flag(sec.is_ad)) {
                        return false;
                    }
                    if (Array.isArray(sec.items)) {
                        sec.items = filterAndCleanZhihuList(sec.items);
                    }
                    if (Array.isArray(sec.elements)) {
                        sec.elements = filterAndCleanZhihuList(sec.elements);
                    }
                    if (Array.isArray(sec.data)) {
                        sec.data = filterAndCleanZhihuList(sec.data);
                    }
                    return true;
                });
            }
        }
        // 5. 动态/关注推荐流 (moments/recommend, moments)
        else if (url.indexOf("/moments") !== -1) {
            stripTopLevelAdMeta(body);
            if (Array.isArray(body.data)) {
                body.data = filterAndCleanZhihuList(body.data);
            }
            if (Array.isArray(body.list)) {
                body.list = filterAndCleanZhihuList(body.list);
            }
        }
        // 6. 经典与V4首页推荐流过滤 (topstory/recommend)
        else if (url.indexOf("/topstory/recommend") !== -1) {
            stripTopLevelAdMeta(body);
            if (Array.isArray(body.data)) {
                body.data = filterAndCleanZhihuList(body.data);
            }
        }
        // 7. 知乎热榜 (topstory/hot-lists)
        else if (url.indexOf("/topstory/hot-lists") !== -1) {
            stripTopLevelAdMeta(body);
            if (Array.isArray(body.data)) {
                body.data = filterAndCleanZhihuList(body.data);
            }
        }
        // 8. 回答页与专栏文章底部的商业推荐
        else if (url.indexOf("/answers/") !== -1 && url.indexOf("/recommendations") !== -1) {
            if (Array.isArray(body.data)) body.data = filterAndCleanZhihuList(body.data);
        }
        else if (url.indexOf("/articles/") !== -1 && url.indexOf("/recommendation") !== -1) {
            stripTopLevelAdMeta(body);
            if (Array.isArray(body.data)) {
                body.data = filterAndCleanZhihuList(body.data);
            }
        }
        // 9. 评论区净化 (comment_v5 / v4/comments) —— 须置于 /answers/ 与 /articles/ 分支之前
        else if (url.indexOf("/comment_v5/") !== -1 || url.indexOf("/comments") !== -1) {
            stripTopLevelAdMeta(body);
            delete body.ad_plugin;
            delete body.ad_plugin_infos;
            if (body.header && isZhihuFeedAd(body.header)) {
                delete body.header;
            }
            if (body.footer && isZhihuFeedAd(body.footer)) {
                delete body.footer;
            }
            if (Array.isArray(body.data)) {
                body.data = filterAndCleanZhihuList(body.data);
            }
        }
        // 10. 问题回答列表、回答流与单篇回答/文章详情 (questions/.../answers, questions/.../feeds, next-data, next-render, v4/answers/\d+)
        else if (
            url.indexOf("/questions/") !== -1 ||
            url.indexOf("/v4/questions/") !== -1 ||
            url.indexOf("/next-data") !== -1 ||
            url.indexOf("/next-render") !== -1 ||
            url.indexOf("/prague/") !== -1 ||
            url.indexOf("/answers/") !== -1 ||
            url.indexOf("/articles/") !== -1
        ) {
            stripTopLevelAdMeta(body);
            if (Array.isArray(body.data)) {
                body.data = filterAndCleanZhihuList(body.data);
            } else {
                cleanZhihuNormalItem(body);
                if (body.data && typeof body.data === "object") cleanZhihuNormalItem(body.data);
            }
        }
        // 11. 搜索预置推广词与搜索结果流广告
        else if (url.indexOf("/search/preset_words") !== -1) {
            if (body.preset_words && Array.isArray(body.preset_words.words)) {
                body.preset_words.words = [];
            }
            if (Array.isArray(body.data)) {
                body.data = [];
            }
        }
        else if (url.indexOf("/search") !== -1) {
            stripTopLevelAdMeta(body);
            if (Array.isArray(body.data)) {
                body.data = filterAndCleanZhihuList(body.data);
            }
            if (Array.isArray(body.more_tabs)) {
                body.more_tabs = body.more_tabs.filter(function (tab) {
                    return !isZhihuFeedAd(tab);
                });
            }
        }
        // 12. 商业资源包下发过滤
        else if (url.indexOf("/v3/resource") !== -1 && (/[?&]group_name=commerce(?:2)?(?:&|$)/.test(rawUrl))) {
            body = { code: 0, data: {} };
        }
        // 13. 配置中心拦截备用广告路由、第三方SDK(JAD/Tanx/GDT/Pangle)配置与商业开关
        else if (url.indexOf("/v3/config") !== -1) {
            if (body.config && typeof body.config === "object") {
                if (body.config.zhcnh_thread_sync && body.config.zhcnh_thread_sync.ZHBackUpIP_Switch_Open) {
                    body.config.zhcnh_thread_sync.ZHBackUpIP_Switch_Open = "0";
                }
                if (body.config.commercial_switch) {
                    body.config.commercial_switch = "0";
                }
                var cfgKeys = Object.keys(body.config);
                for (var c = 0; c < cfgKeys.length; c++) {
                    var ck = cfgKeys[c];
                    if (/(?:ad_sdk|commercial|tanx|alimama|jad|gdt|pangle|gromore|launch_ad|splash)/i.test(ck)) {
                        delete body.config[ck];
                    }
                }
            }
        }

        $done({ body: JSON.stringify(body) });
    } catch (e) {
        $done({});
    }

    function stripTopLevelAdMeta(root) {
        if (!root || typeof root !== "object") return;
        delete root.ad_info;
        delete root.commercial_info;
        delete root.brand_info;
        delete root.ad_track;
        delete root.za_ad;
        delete root.ZaAd;
        delete root.promotion_extra;
        delete root.ad_plugin;
        delete root.ad_plugin_infos;
        delete root.mcn_info;
        delete root.mcn_link_cards;
        delete root.ecommerce_info;
        if (root.query_info && (flag(root.query_info.is_ad) || nonempty(root.query_info.commercial_info) || root.query_info.type === "commercial")) {
            delete root.query_info;
        }
    }

    function filterAndCleanZhihuList(list) {
        if (!Array.isArray(list)) return list;
        var res = [];
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            if (isZhihuFeedAd(item)) continue;
            cleanZhihuNormalItem(item);
            res.push(item);
        }
        return res;
    }

    /**
     * 清理正常回答/文章/动态内部挂载的商业带货商品卡 (attachment / mcn_link_cards)、
     * 回答正文内嵌 MCNLinkCard HTML 节点、底部营销搜索引导词 (relevant_query) 与广告元数据
     */
    function cleanZhihuNormalItem(item) {
        if (!item || typeof item !== "object") return;
        var adFields = [
            "ad_info", "commercial_info", "brand_info", "mcn_info", "mcn_link_cards",
            "ad_track", "promotion_extra", "ad_plugin",
            "ad_plugin_infos", "relevant_query", "goods_card", "km_card",
            "ecommerce_info", "commercial_report_info", "ad_eid", "third_sdk_info",
            "conversion_tracks"
        ];
        for (var i = 0; i < adFields.length; i++) {
            delete item[adFields[i]];
        }

        cleanAttachments(item);
        if (typeof item.content === "string" && /MCNLinkCard|ADLinkCard/.test(item.content)) {
            item.content = stripMcnHtmlCards(item.content);
        }

        if (item.target && typeof item.target === "object") {
            cleanAttachments(item.target);
            for (var j = 0; j < adFields.length; j++) {
                delete item.target[adFields[j]];
            }
            if (typeof item.target.content === "string" && (
                item.target.content.indexOf("MCNLinkCard") !== -1 ||
                item.target.content.indexOf("ADLinkCard") !== -1
            )) {
                item.target.content = stripMcnHtmlCards(item.target.content);
            }
            if (item.target.label_info && isZhihuLabelAd(item.target.label_info)) {
                delete item.target.label_info;
            }
        }
        if (item.label_info && isZhihuLabelAd(item.label_info)) {
            delete item.label_info;
        }
    }

    function stripMcnHtmlCards(html) {
        return String(html || "")
            .replace(/<a\b[^>]*\bclass="[^"]*(?:MCNLinkCard|ADLinkCard|RichText-MCNLinkCardContainer)[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "")
            .replace(/<div\b[^>]*\bclass="[^"]*(?:RichText-ADLinkCardContainer|RichText-MCNLinkCardContainer|MCNLinkCard)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
    }

    function isZhihuLabelAd(labelInfo) {
        if (!labelInfo || typeof labelInfo !== "object") return false;
        var text = String(labelInfo.text || labelInfo.type || "");
        return /广告|推广|商业|赞助|商品|好物|营销/i.test(text);
    }

    /**
     * 判断是否为知乎商业广告、京东(JAD/京东联盟)或阿里妈妈(Tanx/淘宝联盟)推广卡片
     */
    function flag(v) { return v === true || v === 1 || v === "1" || v === "true"; }
    function nonempty(v) {
        if (v === null || v === undefined || v === false || v === 0 || v === "0" || v === "false" || v === "") return false;
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === "object") return Object.keys(v).length > 0;
        return true;
    }
    function adType(v) {
        return /^(?:feed_advert|market_card|commercial|ad|commercial_card|advert|promotion|promotion_card|zvideo_ad|pin_ad|ecom_card|km_card|slot_event_card|slot_video_event_card|sdk_ad|third_party_ad|brand_ad|cpm|cpc|tanx|jad|gdt|mcn_link_card)$/i.test(String(v || ""));
    }
    function markers(o) {
        if (!o || typeof o !== "object") return false;
        if (flag(o.is_ad) || flag(o.is_commercial)) return true;
        if ([o.type, o.card_type, o.style_type, o.card_style, o.style, o.sub_type].some(adType)) return true;
        return ["ad", "ad_info", "ad_style", "adjson", "ad_list", "commercial_info", "promotion_extra", "ad_source", "ad_eid", "third_sdk_info", "ad_id", "creative_id"].some(function(k) { return nonempty(o[k]); });
    }
    function parsedMarkers(v) {
        if (typeof v === "string") { try { v = JSON.parse(v); } catch (_) { return false; } }
        return markers(v);
    }
    function cleanAttachments(item) {
        ["attachment", "link_cards", "link_card_list"].forEach(function (k) {
            if (Array.isArray(item[k])) item[k] = item[k].filter(function(x) { return !isZhihuFeedAd(x); });
            else if (item[k] && typeof item[k] === "object" && isZhihuFeedAd(item[k])) delete item[k];
        });
    }
    function isZhihuFeedAd(item) {
        if (!item || typeof item !== "object") return false;
        if (markers(item) || parsedMarkers(item.extra) || parsedMarkers(item.brief)) return true;
        if (/^(?:ad_|commercial_|advert_|promo_|tanx_|jad_|gdt_)/i.test(String(item.card_id || item.id || ""))) return true;
        if (item.common_card && (markers(item.common_card) || hasCommercialFootline(item.common_card.footline) || hasCommercialFootline(item.common_card.bar))) return true;
        if (item.target && (markers(item.target) || /^(?:广告|商业推广|推广|赞助)$/.test(String(item.target.label || item.target.tag || "")))) return true;
        var links = [item.url, item.jump_url, item.deep_url, item.landing_url, item.click_url, item.action_url];
        if (item.target) links = links.concat([item.target.url, item.target.jump_url, item.target.deep_url, item.target.link]);
        if (item.fields && item.fields.header) links.push(item.fields.header.url);
        if (item.common_card) links = links.concat([item.common_card.action_url, item.common_card.jump_url]);
        if (links.some(function (s) { return typeof s === "string" && (/\/(?:commercial_api|ad-style-service)\//i.test(s) || hasJdOrTanxCommercialLink(s)); })) return true;
        if (item.author && (item.author.name === "知乎广告" || flag(item.author.is_ad))) return true;
        return false;
    }

    function hasJdOrTanxCommercialLink(rawStr) {
        if (!rawStr || typeof rawStr !== "string") return false;
        var s = rawStr.toLowerCase();
        for (var i = 0; i < 2; i++) {
            if (s.indexOf("%") === -1) break;
            try {
                var dec = decodeURIComponent(s);
                if (dec === s) break;
                s = dec;
            } catch (e) {
                break;
            }
        }
        return /(?:janapi\.jd\.com|jadyun\.com|jad\.jd\.com|dsp-x\.jd\.com|ccc-x\.jd\.com|img-x\.jd\.com|x\.jd\.com|ad\.jd\.com|jzt\.jd\.com|c-nfa\.jd\.com|u\.jd\.com|union-click\.jd\.com|click\.union\.jd\.com|tanx\.com|alimama\.(?:com|cn|net)|atanx\d?\.alicdn\.com|alimm\.com|s\.click\.taobao\.com|uland\.taobao\.com|simba\.taobao\.com|gdt\.qq\.com|adnet\.qq\.com|e\.qq\.com|pangle|gromore|csjplatform)/i.test(s) ||
            /(?:openapp\.jdmobile|jdmobile|jdapp|tbopen|taobao|tmall|alipays|pinduoduo|pddopen):\/\//i.test(s);
    }

    function hasCommercialFootline(node) {
        if (!node || typeof node !== "object") return false;
        try {
            var raw = JSON.stringify(node);
            return /"(?:text|tag|label|content)"\s*:\s*"(?:广告|商业推广|赞助|品牌特约|推广)"/.test(raw);
        } catch (e) {
            return false;
        }
    }
})();
