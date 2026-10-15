/**
 * 知乎 (Zhihu) 深度纯净版脚本 (2026 真机抓包全量对齐 + 京东JAD/阿里妈妈Tanx/MCN带货专杀版)
 *
 * 核心特性：
 * 1. 拦截新版开屏与广告样式服务 (ad-style-service/launch_animation & ad-style-service/request)
 * 2. 拦截并过滤新版信息流聚合根接口 (feed-root/sections/query/v2, feed-root/section/*)
 * 3. 彻底过滤推荐流伪装广告、common_card 商业卡、字符串型 extra/brief 广告与京东/Tanx DSP 投放卡 (topstory/recommend)
 * 4. 深度过滤动态/关注推荐流广告 (moments/recommend, moments)
 * 5. 过滤知乎热榜 (topstory/hot-lists) 商业推广卡片与品牌置顶
 * 6. 移除问题回答列表与回答流中的商业卡片、MCN 京东/淘宝带货商品卡 (attachment / mcn_link_cards) 与底部营销词
 * 7. 拦截独立 MCN/电商带货接口 (/mcn/, /bazaar/, /ecommerce/, /fringe/)，清空正文中内嵌的 MCNLinkCard HTML 节点
 * 8. 净化评论区顶部/底部广告插件与推广评论 (comment_v5) 及搜索预置推广词 (search/preset_words, search_v3)
 * 9. 拦截商业资源下发 (appcloud2/v3/resource) 与备用广告 IP 开关 (v3/config)
 *
 * 兼容 Shadowrocket / Surge / Loon / Quantumult X：纯 ES5/ES2015 语法，零弹窗打扰。
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
        else if (url.indexOf("/commercial_api/") !== -1) {
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
                    if (sec.type === "commercial" || sec.section_type === "ad" || sec.section_type === "commercial" || sec.is_ad) {
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
            body.data = [];
            body.paging = null;
        }
        else if (url.indexOf("/articles/") !== -1 && url.indexOf("/recommendation") !== -1) {
            stripTopLevelAdMeta(body);
            if (Array.isArray(body.data)) {
                body.data = [];
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
        else if (url.indexOf("/v3/resource") !== -1 && (url.indexOf("commerce") !== -1 || url.indexOf("group_name=commerce2") !== -1)) {
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
        delete root.roundtable_info;
        delete root.activity_info;
        delete root.ad_plugin;
        delete root.ad_plugin_infos;
        delete root.mcn_info;
        delete root.mcn_link_cards;
        delete root.ecommerce_info;
        if (root.query_info && (root.query_info.is_ad || root.query_info.commercial_info || root.query_info.type === "commercial")) {
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
            "link_cards", "link_card_list", "ad_track", "promotion_extra", "ad_plugin",
            "ad_plugin_infos", "attachment", "relevant_query", "goods_card", "km_card",
            "ecommerce_info", "commercial_report_info", "ad_eid", "third_sdk_info",
            "conversion_tracks"
        ];
        for (var i = 0; i < adFields.length; i++) {
            delete item[adFields[i]];
        }

        if (typeof item.content === "string" && item.content.indexOf("MCNLinkCard") !== -1) {
            item.content = stripMcnHtmlCards(item.content);
        }

        if (item.target && typeof item.target === "object") {
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
    function isZhihuFeedAd(item) {
        if (!item || typeof item !== "object") return false;

        // 1. 显式广告类型与卡片类型
        var itemType = String(item.type || "").toLowerCase();
        if (
            itemType === "feed_advert" ||
            itemType === "market_card" ||
            itemType === "commercial" ||
            itemType === "banner" ||
            itemType === "ad" ||
            itemType === "commercial_card" ||
            itemType === "advert" ||
            itemType === "promotion" ||
            itemType === "promotion_card" ||
            itemType === "zvideo_ad" ||
            itemType === "pin_ad" ||
            itemType === "drama_card" ||
            itemType === "ecom_card" ||
            itemType === "km_card" ||
            itemType === "slot_event_card" ||
            itemType === "sdk_ad" ||
            itemType === "third_party_ad"
        ) {
            return true;
        }

        // 2. slot 卡片类型 (知乎核心广告位)
        var cardType = String(item.card_type || item.style_type || "").toLowerCase();
        if (
            cardType === "slot_event_card" ||
            cardType === "slot_video_event_card" ||
            cardType === "feed_ad" ||
            cardType === "commercial_card" ||
            cardType === "market_card" ||
            cardType === "ad" ||
            cardType === "advert" ||
            cardType === "sdk_ad" ||
            cardType.indexOf("ad_") === 0 ||
            cardType.indexOf("commercial") !== -1 ||
            cardType.indexOf("slot_event") !== -1
        ) {
            return true;
        }

        var cardId = String(item.card_id || item.id || "");
        if (/^(?:ad_|commercial_|advert_|promo_|tanx_|jad_|gdt_)/i.test(cardId)) {
            return true;
        }

        // 3. 投放元数据与特征字段 (含第三方广告 SDK 注入字段)
        if (
            item.ad ||
            item.ad_info ||
            item.ad_style ||
            item.adjson ||
            item.ad_list ||
            item.commercial_info ||
            item.promotion_extra ||
            item.ad_source ||
            item.ad_eid ||
            item.third_sdk_info ||
            item.conversion_tracks ||
            item.click_tracks ||
            item.show_tracks ||
            item.view_tracks ||
            item.is_ad === true ||
            item.is_ad === 1 ||
            item.is_commercial === true
        ) {
            return true;
        }

        // 4. extra 字段广告标记 (兼容对象与序列化 JSON 字符串两种形态)
        if (item.extra) {
            var extraObj = null;
            if (typeof item.extra === "object") {
                extraObj = item.extra;
            } else if (typeof item.extra === "string") {
                if (/"(?:is_ad|is_commercial|commercial_card|ad_track|ad_id|ad_source|slot_event_card|cpm|cpc|tanx|alimama|jad|gdt|pangle|pos_id|slot_id|rit_id|creative_id)"\s*:\s*(?:true|1|"[1-9a-zA-Z])/i.test(item.extra) ||
                    /"type"\s*:\s*"(?:ad|advert|commercial|market_card|promotion|slot_event_card|sdk_ad)"/i.test(item.extra) ||
                    hasJdOrTanxCommercialLink(item.extra)) {
                    return true;
                }
                if (item.extra.charAt(0) === "{") {
                    try {
                        extraObj = JSON.parse(item.extra);
                    } catch (e) {}
                }
            }
            if (extraObj && typeof extraObj === "object") {
                if (
                    extraObj.is_ad ||
                    extraObj.type === "commercial" ||
                    extraObj.type === "ad" ||
                    extraObj.type === "advert" ||
                    extraObj.type === "market_card" ||
                    extraObj.banner ||
                    extraObj.is_commercial ||
                    extraObj.commercial_card ||
                    extraObj.ad_id ||
                    extraObj.ad_track ||
                    extraObj.tanx ||
                    extraObj.alimama ||
                    extraObj.jad ||
                    extraObj.gdt ||
                    extraObj.pos_id ||
                    extraObj.slot_id
                ) {
                    return true;
                }
            }
        }

        // 5. brief 字段广告标记 (新版推荐流常用序列化 JSON 字符串)
        if (item.brief) {
            var briefStr = typeof item.brief === "string" ? item.brief : JSON.stringify(item.brief);
            if (
                /"(?:source|type|sub_type|card_type)"\s*:\s*"(?:ad|advert|commercial|promotion|market_card|slot_event_card|brand_ad|cpm|cpc|tanx|jad|gdt|sdk_ad)"/i.test(briefStr) ||
                /"(?:is_ad|is_commercial|ad_id|ad_track|pos_id|slot_id|creative_id)"\s*:\s*(?:true|1|"[1-9a-zA-Z])/i.test(briefStr) ||
                hasJdOrTanxCommercialLink(briefStr)
            ) {
                return true;
            }
        }

        // 6. 新版 common_card 渲染树广告识别（含京东/Tanx外链与深层跳转）
        if (item.common_card && typeof item.common_card === "object") {
            var cc = item.common_card;
            var ccStyle = String(cc.card_style || cc.style || "").toLowerCase();
            if (ccStyle === "commercial" || ccStyle === "ad" || ccStyle === "advert" || ccStyle === "promotion") {
                return true;
            }
            if (cc.ad_info || cc.commercial_info || cc.promotion_extra || cc.is_ad || cc.ad_track || cc.conversion_tracks) {
                return true;
            }
            if (cc.footline && hasCommercialFootline(cc.footline)) {
                return true;
            }
            if (cc.bar && hasCommercialFootline(cc.bar)) {
                return true;
            }
            try {
                var ccRaw = JSON.stringify(cc);
                if (hasJdOrTanxCommercialLink(ccRaw) || /"(?:text|tag|label|content)"\s*:\s*"(?:广告|商业推广|赞助|品牌特约|推广)"/.test(ccRaw)) {
                    return true;
                }
            } catch (e) {}
        }

        // 7. target 对象商业标记
        if (item.target && typeof item.target === "object") {
            var targetType = String(item.target.type || "").toLowerCase();
            if (
                targetType === "advert" ||
                targetType === "commercial" ||
                targetType === "ad" ||
                targetType === "market_card" ||
                targetType === "promotion" ||
                targetType === "ecom" ||
                targetType === "sdk_ad" ||
                item.target.is_ad ||
                item.target.is_commercial ||
                item.target.ad_info ||
                item.target.commercial_info ||
                item.target.ad_eid ||
                item.target.third_sdk_info
            ) {
                return true;
            }
            var targetLabel = String(item.target.label || item.target.tag || "");
            if (targetLabel === "广告" || targetLabel === "商业推广" || targetLabel === "推广" || targetLabel === "赞助") {
                return true;
            }
            if (hasJdOrTanxCommercialLink(item.target.url) ||
                hasJdOrTanxCommercialLink(item.target.jump_url) ||
                hasJdOrTanxCommercialLink(item.target.deep_url) ||
                hasJdOrTanxCommercialLink(item.target.link)) {
                return true;
            }
        }

        // 8. 商业专栏/外链导流 & 京东/Tanx 深度跳转链接拦截
        if (item.fields && item.fields.header && item.fields.header.url) {
            if (/commercial|market|advert|promotion/i.test(item.fields.header.url) || hasJdOrTanxCommercialLink(item.fields.header.url)) {
                return true;
            }
        }
        var itemLinks = [item.url, item.jump_url, item.deep_url, item.landing_url, item.click_url, item.action_url];
        for (var l = 0; l < itemLinks.length; l++) {
            if (typeof itemLinks[l] === "string" && (
                /(?:commercial_api|ad-style-service|advert|zhihu\.com\/commercial)/i.test(itemLinks[l]) ||
                hasJdOrTanxCommercialLink(itemLinks[l])
            )) {
                return true;
            }
        }

        // 9. 常见商业营销号/广告作者
        if (item.author && (item.author.name === "知乎广告" || item.author.name === "广告" || item.author.is_ad)) {
            return true;
        }
        if (item.brand_info && item.brand_info.name && !item.question && !item.title && !item.excerpt) {
            return true;
        }

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
