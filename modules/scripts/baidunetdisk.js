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
        if (Array.isArray(obj.data)) {
            obj.data = [];
        } else if (typeof obj.data === "object" && obj.data !== null) {
            obj.data.ad_list = [];
            obj.data.ads = [];
            obj.data.list = [];
            obj.data.records = [];
            delete obj.data.splash;
            delete obj.data.splash_list;
        }
        obj.ad_list = [];
        obj.ads = [];
        obj.ad_info = [];
        obj.list = [];
        obj.card_list = [];
        obj.records = [];
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
            card_list: [],
            entry_list: []
        },
        ad_list: [],
        ads: [],
        list: [],
        card_list: [],
        records: [],
        splash: null,
        splash_list: [],
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
