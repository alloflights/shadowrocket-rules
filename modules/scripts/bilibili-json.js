/**
 * 哔哩哔哩 (Bilibili) JSON 深度无感净化脚本
 *
 * 核心能力：
 * 1. 开屏广告接口 (x/v2/splash/list, show, brand/list, event/list2) 秒级抹平 show 字段并置最大过期时间，杜绝开屏停留；
 * 2. 底栏与顶栏净化 (resource/show/tab/v2)：移除顶部游戏中心、底部会员购与冗余发布按钮，自动重排 pos 序号；
 * 3. 推荐流深度净化 (x/v2/feed/index)：精准剥离 banner 广告、创作推广、大视频广告、游戏推广、带货与直播广告卡片；
 * 4. 100% 静默无感运行：零 $notification.post 弹窗打扰，完整 try/catch 容错与空响应早退保护。
 */

(function bilibiliJsonPro() {
    var request = (typeof $request !== "undefined" && $request) ? $request : null;
    var url = (request && request.url) ? String(request.url) : "";
    var hasResponse = typeof $response !== "undefined" && $response;

    if (!hasResponse || !$response.body) {
        $done({});
        return;
    }

    try {
        var body = JSON.parse($response.body);
        if (!body || typeof body !== "object" || !body.data) {
            $done({});
            return;
        }

        // 1. 开屏广告净化 (x/v2/splash/*)
        if (url.indexOf("x/v2/splash") !== -1) {
            if (body.data.show) {
                delete body.data.show;
            }
            if (Array.isArray(body.data.list)) {
                for (var s = 0; s < body.data.list.length; s++) {
                    var splashItem = body.data.list[s];
                    if (splashItem && typeof splashItem === "object") {
                        splashItem.duration = 0;
                        splashItem.begin_time = 2240150400;
                        splashItem.end_time = 2240150400;
                    }
                }
            }
        }
        // 2. 顶栏与底栏 Tab 净化 (resource/show/tab/v2)
        else if (url.indexOf("resource/show/tab/v2") !== -1) {
            if (Array.isArray(body.data.top)) {
                body.data.top = body.data.top.filter(function (item) {
                    return item && item.name !== "游戏中心" && item.tab_id !== "游戏中心Top";
                });
                fixPos(body.data.top);
            }
            if (Array.isArray(body.data.bottom)) {
                body.data.bottom = body.data.bottom.filter(function (item) {
                    if (!item) return false;
                    if (item.name === "发布" || item.name === "会员购" || item.tab_id === "会员购Bottom") {
                        return false;
                    }
                    return true;
                });
                fixPos(body.data.bottom);
            }
        }
        // 3. 首页推荐流净化 (x/v2/feed/index)
        else if (url.indexOf("x/v2/feed/index") !== -1) {
            if (Array.isArray(body.data.items)) {
                var adGotoSet = {
                    "ad_web_s": true,
                    "ad_av": true,
                    "ad_web_gif": true,
                    "ad_player": true,
                    "ad_inline_3d": true,
                    "ad_inline_eggs": true,
                    "ad_inline_av": true,
                    "ad_inline_live": true,
                    "ad_ogv": true,
                    "ad_drm": true
                };
                body.data.items = body.data.items.filter(function (item) {
                    if (!item || typeof item !== "object") return false;
                    var cardType = String(item.card_type || "");
                    var cardGoto = String(item.card_goto || "");

                    if (item.ad_info || item.ad_type) return false;

                    if (cardType.indexOf("banner") !== -1 && cardGoto === "banner" && Array.isArray(item.banner_item)) {
                        item.banner_item = item.banner_item.filter(function (b) {
                            return b && b.type !== "ad" && !b.is_ad;
                        });
                        if (item.banner_item.length === 0) return false;
                    }

                    if ((cardType === "cm_v2" || cardType === "cm_v1" || cardType === "cm_double_v9" || cardType === "cm_double_v7") &&
                        (adGotoSet[cardGoto] || cardGoto.indexOf("ad_") === 0)) {
                        return false;
                    }

                    if (cardGoto.indexOf("ad_") === 0 || cardType.indexOf("cm_") === 0) {
                        return false;
                    }

                    if (cardType === "small_cover_v10" && cardGoto === "game") {
                        return false;
                    }

                    return true;
                });
            }
        }

        $done({ body: JSON.stringify(body) });
    } catch (e) {
        $done({});
    }

    function fixPos(arr) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] && typeof arr[i] === "object") {
                arr[i].pos = i + 1;
            }
        }
    }
})();
