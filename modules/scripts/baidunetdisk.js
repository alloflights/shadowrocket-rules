/**
 * 百度网盘 (Baidu Netdisk) 深度净化与极速启动脚本 (2026 全链路防漏版)
 *
 * 核心机制：
 * 1. 本地 0.1ms Mock 响应，彻底阻止开屏广告渲染与 5 秒倒计时等待；
 * 2. 深度清洗 /api/getsyscfg 与 /api/getconfig 系统配置下发，置空开屏、弹窗、横幅、福利专区、
 *    短剧信息流及穿山甲(GroMore/Pangle)/百青藤(MobAds)/京东(JAD)/阿里妈妈(Tanx)/优量汇(GDT)聚合瀑布流配置；
 * 3. 严格按不同接口协议返回 errno=0 与合法空数组，杜绝客户端因异常报错回退到本地沙盒广告缓存；
 * 4. 保护 /xpan/file 等正常网盘文件列表与用户 VIP 权益字段不被误删。
 *
 * 兼容 Shadowrocket / Surge / Loon / Quantumult X：纯 ES5/ES2015 语法，零弹窗打扰。
 */

(function baidunetdiskPro() {
    var request = (typeof $request !== "undefined" && $request) ? $request : null;
    var url = (request && request.url) ? String(request.url) : "";
    var lowerUrl = url.toLowerCase();
    var hasResponse = typeof $response !== "undefined" && $response;

    var SDK_CONFIG_KEYS = [
        "splash", "splash_list", "splash_info", "splash_config", "splash_advertise_config",
        "boot_advertise_config", "open_screen_ad", "launch_ad", "gromore_config", "pangle_config",
        "csj_config", "mobads_config", "baidu_mobads_config", "jad_config", "tanx_config",
        "alimama_config", "gdt_config", "ks_config", "sigmob_config", "beizi_config",
        "topon_config", "mintegral_config", "bidding_config", "mediation_config",
        "ad_config", "sdk_ad_config", "commercial_ad_config", "union_ad_config",
        "popup", "pop_window", "popup_config", "dialog_config", "float_layer",
        "floating_window", "float_icon_config", "home_float_icon", "shake_config",
        "vip_guide", "guide_bar_config", "guide_info", "dialog_info", "popup_info",
        "banner_info", "float_info", "privilege_ad", "red_packet"
    ];

    var AD_ARRAY_KEYS = [
        "ad_list", "ads", "ad_info", "card_list", "banner_list", "banners",
        "bchannel_list", "welfare_list", "act_list", "activity_list",
        "popup_list", "dialog_list", "shortseries_list", "promote_list"
    ];

    if (hasResponse && $response.body) {
        try {
            var obj = JSON.parse($response.body);
            obj.errno = 0;
            obj.error_code = 0;

            var isAdUrl = lowerUrl.indexOf("splash") !== -1 ||
                lowerUrl.indexOf("pcs/ad") !== -1 ||
                lowerUrl.indexOf("activityentry") !== -1 ||
                lowerUrl.indexOf("shortseries") !== -1 ||
                lowerUrl.indexOf("advertise") !== -1 ||
                lowerUrl.indexOf("buy/ad") !== -1 ||
                lowerUrl.indexOf("bchannel") !== -1 ||
                lowerUrl.indexOf("welfare/list") !== -1 ||
                lowerUrl.indexOf("cardinfos") !== -1;

            var isSysCfgUrl = lowerUrl.indexOf("getsyscfg") !== -1 || lowerUrl.indexOf("getconfig") !== -1;

            if (isSysCfgUrl) {
                sanitizeSysCfg(obj);
            }

            if (isAdUrl) {
                if (Array.isArray(obj.data)) {
                    obj.data = [];
                } else if (typeof obj.data === "object" && obj.data !== null) {
                    obj.data.ad_list = [];
                    obj.data.ads = [];
                    obj.data.list = [];
                    obj.data.records = [];
                    stripSdkAndAdKeys(obj.data);
                    delete obj.data.config;
                }
            } else {
                // 通用接口只清洗广告和聚合瀑布流配置，绝不抹除正常用户数据与网盘文件列表
                if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
                    stripSdkAndAdKeys(obj.data);
                    for (var a = 0; a < AD_ARRAY_KEYS.length; a++) {
                        var ak = AD_ARRAY_KEYS[a];
                        if (Array.isArray(obj.data[ak])) obj.data[ak] = [];
                    }
                    if (Array.isArray(obj.data.list) && !isFileList(obj.data.list)) {
                        obj.data.list = obj.data.list.filter(function (item) {
                            return !isBaiduAdItem(item);
                        });
                    }
                } else if (Array.isArray(obj.data) && !isFileList(obj.data)) {
                    obj.data = obj.data.filter(function (item) {
                        return !isBaiduAdItem(item);
                    });
                }
            }

            if (obj.config && typeof obj.config === "object") {
                stripSdkAndAdKeys(obj.config);
            }
            stripSdkAndAdKeys(obj);

            obj.ad_list = [];
            obj.ads = [];
            obj.ad_info = [];
            obj.card_list = [];
            obj.splash = null;
            obj.splash_list = [];
            obj.fuse = false;

            $done({ body: JSON.stringify(obj) });
        } catch (e) {
            $done({});
        }
        return;
    }

    if (hasResponse && !$response.body) {
        $done({});
        return;
    }

    // http-request 模式：本地秒级返回合规空数据，客户端免等待直接进入主页
    var mockData = {
        errno: 0,
        error_code: 0,
        request_id: String(Date.now()),
        data: {
            ad_list: [],
            ads: [],
            list: [],
            records: [],
            splash: null,
            splash_list: [],
            splash_info: null,
            card_list: [],
            entry_list: [],
            config: {}
        },
        ad_list: [],
        ads: [],
        ad_info: [],
        list: [],
        card_list: [],
        records: [],
        splash: null,
        splash_list: [],
        config: {},
        fuse: false
    };

    if (lowerUrl.indexOf("/act/") !== -1 || lowerUrl.indexOf("activityentry") !== -1) {
        mockData.data = [];
        mockData.list = [];
    } else if (lowerUrl.indexOf("/feed/cardinfos") !== -1 || lowerUrl.indexOf("/recommend/shortseries/") !== -1) {
        mockData.data = [];
        mockData.list = [];
        mockData.card_list = [];
    }

    $done({
        response: {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify(mockData)
        }
    });

    function stripSdkAndAdKeys(target) {
        if (!target || typeof target !== "object") return;
        for (var i = 0; i < SDK_CONFIG_KEYS.length; i++) {
            delete target[SDK_CONFIG_KEYS[i]];
        }
    }

    function isFileList(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return false;
        for (var i = 0; i < arr.length; i++) {
            var it = arr[i];
            if (it && typeof it === "object" && (it.server_filename !== undefined || it.fs_id !== undefined || it.md5 !== undefined)) {
                return true;
            }
        }
        return false;
    }

    function isBaiduAdItem(item) {
        if (!item || typeof item !== "object") return false;
        if (item.server_filename !== undefined || item.fs_id !== undefined) return false;
        if (
            item.is_ad || item.ad_id || item.ad_info || item.ad_type ||
            item.gromore || item.pangle || item.mobads || item.jad || item.tanx || item.alimama || item.gdt
        ) {
            return true;
        }
        var type = String(item.type || item.card_type || "").toLowerCase();
        if (/(?:ad|advert|splash|banner|popup|welfare|shortseries|promote|commercial|tanx|jad|gdt)/i.test(type)) {
            return true;
        }
        var urlStr = String(item.url || item.jump_url || item.link || item.action_url || item.schema || "").toLowerCase();
        if (/(?:pos\.baidu\.com|cpro\.baidu\.com|mobads\.baidu\.com|afd\.baidu\.com|janapi\.jd\.com|jadyun\.com|jad\.jd\.com|u\.jd\.com|union-click\.jd\.com|tanx\.com|alimama\.com|atanx|s\.click\.taobao\.com|uland\.taobao\.com|jdmobile:\/\/|openapp\.jdmobile:\/\/|tbopen:\/\/|taobao:\/\/)/i.test(urlStr)) {
            return true;
        }
        return false;
    }

    function sanitizeSysCfg(root) {
        if (!root || typeof root !== "object") return;
        var keys = Object.keys(root);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var val = root[k];
            if (/(?:splash|advert|ad_|_ad|adconfig|gromore|pangle|csj|mobads|jad|tanx|alimama|gdt|popup|pop_window|dialog|float|banner|bchannel|welfare|short_?series|card_area|feed_flow|vip_guide|guide_bar|activity_entry|pmall|red_?packet|shake)/i.test(k)) {
                if (val && typeof val === "object" && !Array.isArray(val)) {
                    if (Array.isArray(val.list)) val.list = [];
                    if (Array.isArray(val.cfg_list)) val.cfg_list = [];
                    if (Array.isArray(val.items)) val.items = [];
                    if (Array.isArray(val.data)) val.data = [];
                    if (val.switch !== undefined) val.switch = 0;
                    if (val.enable !== undefined) val.enable = 0;
                    if (val.is_open !== undefined) val.is_open = 0;
                    if (val.show !== undefined) val.show = 0;
                } else if (Array.isArray(val)) {
                    root[k] = [];
                }
            }
        }
    }
})();
