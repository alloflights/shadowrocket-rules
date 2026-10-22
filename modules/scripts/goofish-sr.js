// Shadowrocket only: preserve MTop envelopes and support serialized data.
(function () {
    var url = (typeof $request !== "undefined" && $request && $request.url) ? String($request.url) : "";
    var body = (typeof $response !== "undefined" && $response) ? $response.body : null;
    if (!body || typeof body !== "string") return $done({});

    var obj;
    try {
        obj = JSON.parse(body);
    } catch (e) {
        return $done({});
    }
    if (!obj || typeof obj !== "object") return $done({});
    if (obj.ret && (!Array.isArray(obj.ret) || !obj.ret.length || !obj.ret.every(function(x) { return /^SUCCESS(?:::|$)/.test(x); }))) return $done({});
    var encoded = typeof obj.data === "string";
    if (encoded) { try { obj.data = JSON.parse(obj.data); } catch (_) { return $done({}); } }
    if (!obj.data || typeof obj.data !== "object") return $done({});
    var d = obj.data;

    function has(api) {
        return url.indexOf("/" + api + "/") !== -1 || url.indexOf("/" + api + "?") !== -1;
    }
    function arr(v) {
        return Array.isArray(v) ? v : null;
    }
    function tplName(section) {
        return section && section.template && section.template.name ? String(section.template.name) : "";
    }

    var HOME_BAD_TEMPLATES = ["fish_home_yunying_card_d3", "idlefish_seafood_market", "fish_home_chat_room"];
    var SEARCH_BAD_TEMPLATES = ["idlefish_search_card_category_select", "idlefish_search_spu_market_publish"];

    var handlers = [
        ["mtop.taobao.idlehome.home.nextfresh", function () {
            delete d.widgetReturnDO;
            delete d.bannerReturnDO;
            if (arr(d.homeTopList)) d.homeTopList = [];
            if (arr(d.sections)) {
                var kept = d.sections.filter(function (s) {
                    if (!s) return false;
                    var biz = s.data && s.data.bizType;
                    if (biz === "AD" || biz === "homepage") return false;
                    return HOME_BAD_TEMPLATES.indexOf(tplName(s)) === -1;
                });
                var items = kept.filter(function (s) {
                    return s.data && s.data.cardTypeValue === "Item";
                });
                // 只有在确实还有商品卡时才做“只留商品”的严格过滤，避免首页被清空
                d.sections = items.length > 0 ? items : kept;
            }
        }],
        ["mtop.taobao.idle.local.home", function () {
            if (arr(d.sections)) {
                d.sections = d.sections.filter(function (s) {
                    return !(s && s.data && s.data.bizType === "AD");
                });
            }
        }],
        ["mtop.taobao.idle.home.whale.modulet", function () {
            if (d.container && typeof d.container === "object") delete d.container.sections;
        }],
        ["mtop.taobao.idlemtopsearch.search", function () {
            if (arr(d.resultList)) {
                d.resultList = d.resultList.filter(function (el) {
                    var ex = el && el.data && el.data.item && el.data.item.main && el.data.item.main.exContent;
                    if (ex && (ex.isAliMaMaAD === true || ex.isAliMaMaAD === "true")) return false;
                    var name = el && el.data && el.data.template && el.data.template.name;
                    return SEARCH_BAD_TEMPLATES.indexOf(name) === -1;
                });
            }
            delete d.resultPrefixBar;
            if (arr(d.topList)) d.topList = [];
        }],
        ["mtop.taobao.idle.user.strategy.list", function () {
            // 悬浮球 / 弹窗 / 浮层策略：保留“发布闲置”球
            if (arr(d.strategies)) {
                d.strategies = d.strategies.filter(function (s) {
                    return s && (s.type === "BIZ_PUBLISH_BALL" || s.bizType === "publish");
                });
                if (d.strategies.length === 0) d.strategies = [{}];
            }
            if (arr(d.popupStrategies)) d.popupStrategies = [];
            if (arr(d.floatStrategies)) d.floatStrategies = [];
        }],
        ["mtop.taobao.idlehome.home.circle.list", function () {
            var keepHead = function (c) { return c && (c.bizCode === "main" || c.bizCode === "recycle"); };
            if (arr(d.circleList)) {
                d.circleList = d.circleList.filter(function (c) { return c && (c.circleId === "1" || c.circleId === "2"); });
            }
            if (arr(d.headList)) d.headList = d.headList.filter(keepHead);
            if (d.next && arr(d.next.headList)) d.next.headList = d.next.headList.filter(keepHead);
        }],
        ["mtop.taobao.idlemtopsearch.search.shade", function () {
            obj.data = {};
        }],
        ["mtop.taobao.idle.playboy.recommend", function () {
            if (arr(d.recommends)) d.recommends = [];
            if (arr(d.items)) d.items = [];
            d.next = false;
        }],
        ["mtop.taobao.idle.item.recommend.list", function () {
            if (arr(d.cardList)) d.cardList = [];
        }],
        ["mtop.taobao.idle.group.myself.banner", function () {
            if (arr(d.bannerList)) d.bannerList = [];
        }],
        ["mtop.taobao.idle.circle.myself.banner", function () {
            if (arr(d.bannerList)) d.bannerList = [];
        }],
        ["mtop.taobao.idle.circle.visited", function () {
            if (arr(d.visitedCircleList)) d.visitedCircleList = [];
        }],
        ["mtop.taobao.idle.fun.follow.often.visit", function () {
            if (arr(d.sections)) d.sections = [];
        }],
        ["mtop.taobao.idle.local.flow.plat.section", function () {
            var inner = d.data;
            if (inner && arr(inner.components)) {
                inner.components = inner.components.filter(function (c) {
                    return !(c && c.key === "fish_home_activity_enter_cardV1");
                });
            }
        }],
        ["mtop.taobao.idlehome.widget.refresh.get", function () {
            if (arr(d.homeTopList)) d.homeTopList = [];
        }],
        ["mtop.idle.user.page.my.adapter", function () {
            // 只去掉“我的”页底部猜你喜欢，不动会员 / 交易 / 工具入口
            if (arr(d.ability)) d.ability = [];
        }]
    ];

    // 更长（更具体）的 API 名优先，例如 search.shade 不会被 search 抢先匹配
    handlers.sort(function (a, b) { return b[0].length - a[0].length; });

    try {
        for (var i = 0; i < handlers.length; i++) {
            if (has(handlers[i][0])) {
                handlers[i][1]();
                if (encoded) obj.data = JSON.stringify(obj.data);
                return $done({ body: JSON.stringify(obj) });
            }
        }
    } catch (e) {}
    $done({});
})();
