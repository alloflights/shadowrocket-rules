/**
 * 完美世界电竞 (Perfect World Esports) 深度净化脚本
 * 
 * 核心特性：
 * 1. 彻底拦截自建与第三方开屏广告 (/app/splash, /api/splash, /app/startup, /app/launch)
 * 2. 深度过滤首页、赛事、社区与资讯内置信息流广告卡片及推广文章
 * 3. 移除轮播商业广告横幅 (Banner) 与商城导流弹窗，保留纯净赛事日程
 * 
 * 遵循: Ponytail 极简原则
 * 作者: allofights
 */

(function pwesportsPurify() {
    const url = $request.url;

    // 1. 若为 http-request 拦截模式 (开屏广告与广告拉取接口本地 0.1ms 秒级 Mock)
    if (typeof $response === "undefined") {
        if (url.includes("splash") || url.includes("startup") || url.includes("launch") || url.includes("advert") || url.includes("open_screen") || url.includes("boot_ad") || url.includes("/ad/") || url.includes("ad.pwesports.cn") || url.includes("advert.pwesports.cn")) {
            $done({
                response: {
                    status: 200,
                    headers: { "Content-Type": "application/json; charset=utf-8" },
                    body: JSON.stringify({
                        code: 0,
                        status: 0,
                        errno: 0,
                        error_code: 0,
                        msg: "ok",
                        message: "ok",
                        data: {
                            splash: null,
                            splash_list: [],
                            splash_info: null,
                            list: [],
                            banners: [],
                            items: [],
                            ad: null,
                            ads: [],
                            ad_list: [],
                            ad_info: [],
                            config: {}
                        }
                    })
                }
            });
            return;
        }
        $done({});
        return;
    }

    // 2. http-response 响应流解析与过滤
    if (!$response.body) {
        $done({});
        return;
    }

    try {
        let obj = JSON.parse($response.body);

        // 开屏与启动页接口
        if (url.includes("splash") || url.includes("startup") || url.includes("launch") || url.includes("open_screen") || url.includes("boot_ad") || url.includes("advert") || url.includes("/ad/")) {
            if (obj.data) {
                if (Array.isArray(obj.data)) {
                    obj.data = [];
                } else if (typeof obj.data === "object") {
                    obj.data.splash = null;
                    obj.data.splash_list = [];
                    obj.data.splash_info = null;
                    obj.data.ad = null;
                    obj.data.ads = [];
                    obj.data.ad_list = [];
                    obj.data.ad_info = [];
                    obj.data.list = [];
                    obj.data.banners = [];
                    obj.data.items = [];
                    delete obj.data.gromore_config;
                    delete obj.data.pangle_config;
                    delete obj.data.mobads_config;
                }
            }
            delete obj.splash;
            delete obj.ad;
            delete obj.ads;
            delete obj.gromore_config;
            delete obj.pangle_config;
        }
        // 首页、信息流、资讯、社区与轮播 Banner 接口
        else {
            if (Array.isArray(obj.data)) {
                obj.data = obj.data.filter(item => !isPwesportsAd(item));
            } else if (obj.data && typeof obj.data === "object") {
                const listFields = ["list", "feeds", "articles", "banners", "recommend", "rows", "items", "posts", "cards", "data_list", "activities"];
                for (let f of listFields) {
                    if (Array.isArray(obj.data[f])) {
                        obj.data[f] = obj.data[f].filter(item => !isPwesportsAd(item));
                    }
                }
                delete obj.data.ad;
                delete obj.data.ads;
                delete obj.data.ad_list;
                delete obj.data.banner_ad;
                delete obj.data.popup;
                delete obj.data.pop_window;
                delete obj.data.dialog;
                delete obj.data.floating_layer;
                delete obj.data.notice;
            }
        }

        $done({ body: JSON.stringify(obj) });
    } catch (e) {
        $done({});
    }

    /**
     * 判定是否为完美世界电竞广告或商业推广
     */
    function isPwesportsAd(item) {
        if (!item) return false;

        if (item.is_ad || item.is_advert || item.is_sponsor || item.is_commercial || item.is_promote || item.ad_type || item.ad_id || item.advert_id || item.advertisement) {
            return true;
        }

        const type = String(item.type || item.entity_type || item.card_type || item.style || "").toLowerCase();
        if (type.includes("ad") || type.includes("advert") || type.includes("banner_ad") || type.includes("sponsor") || type.includes("promote")) {
            return true;
        }

        const tag = String(item.tag || item.label || item.corner_mark || item.badge || item.sub_title || "").toLowerCase();
        if (tag.includes("广告") || tag.includes("推广") || tag.includes("商单") || tag.includes("赞助") || tag.includes("特惠") || tag.includes("福利") || tag.includes("抽奖")) {
            return true;
        }

        const title = String(item.title || item.name || "").toLowerCase();
        if (title.includes("广告") || title.includes("推广")) {
            return true;
        }

        if (item.extra && typeof item.extra === "object") {
            if (item.extra.ad || item.extra.is_ad || item.extra.commercial) {
                return true;
            }
        }

        // 外链商业推广与非官方商城跳转
        if (item.jump_url || item.target_url || item.url || item.link) {
            const u = String(item.jump_url || item.target_url || item.url || item.link).toLowerCase();
            if (u.includes("union") || u.includes("ad_id") || u.includes("cps=") || u.includes("channel=ad") || u.includes("commercial")) {
                return true;
            }
        }

        return false;
    }
})();
