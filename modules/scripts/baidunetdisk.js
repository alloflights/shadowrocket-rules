/**
 * 百度网盘 (Baidu Netdisk) 深度净化与极速启动脚本
 * 
 * 核心机制：
 * 1. 本地 0.1ms Mock 响应，彻底阻止开屏广告渲染与 5 秒倒计时等待
 * 2. 严格按不同接口协议返回 errno=0 与合法空数组，杜绝客户端因异常报错回退到本地沙盒广告缓存
 * 3. 清理短剧、信息流推广卡片、横幅及活动弹窗
 * 
 * 遵循: Ponytail 极简原则
 * 作者: allofights
 */

const url = $request.url;

if (typeof $response !== "undefined" && $response.body) {
    try {
        let obj = JSON.parse($response.body);
        obj.errno = 0;
        obj.error_code = 0;

        const isAdUrl = url.includes("splash") || url.includes("pcs/ad") || url.includes("activityentry") || url.includes("shortseries");
        if (isAdUrl) {
            if (Array.isArray(obj.data)) {
                obj.data = [];
            } else if (typeof obj.data === "object" && obj.data !== null) {
                obj.data.ad_list = [];
                obj.data.ads = [];
                obj.data.list = [];
                obj.data.records = [];
                delete obj.data.splash;
                delete obj.data.splash_list;
                delete obj.data.splash_info;
                delete obj.data.gromore_config;
                delete obj.data.pangle_config;
                delete obj.data.mobads_config;
                delete obj.data.config;
            }
        } else {
            // 通用接口只清洗广告和聚合瀑布流配置，绝不抹除正常用户数据与网盘文件列表
            if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
                delete obj.data.splash;
                delete obj.data.splash_list;
                delete obj.data.splash_info;
                delete obj.data.gromore_config;
                delete obj.data.pangle_config;
                delete obj.data.mobads_config;
                if (Array.isArray(obj.data.ad_list)) obj.data.ad_list = [];
                if (Array.isArray(obj.data.ads)) obj.data.ads = [];
                if (Array.isArray(obj.data.card_list)) obj.data.card_list = [];
            }
        }

        if (obj.config && typeof obj.config === "object") {
            delete obj.config.splash_config;
            delete obj.config.gromore_config;
            delete obj.config.pangle_config;
            delete obj.config.mobads_config;
            delete obj.config.ad_config;
        }
        delete obj.gromore_config;
        delete obj.pangle_config;
        delete obj.mobads_config;
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
} else {
    // http-request 模式：本地秒级返回合规空数据，客户端免等待直接进入主页
    let mockData = {
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

    if (url.includes("/act/") || url.includes("activityentry")) {
        mockData.data = [];
        mockData.list = [];
    } else if (url.includes("/feed/cardinfos") || url.includes("/recommend/shortseries/")) {
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
}
