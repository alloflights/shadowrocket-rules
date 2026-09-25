// 百度网盘急速开屏净化脚本 (本地 0.1ms Mock 响应，彻底阻止开屏占位页与摇一摇监听实例化)
const url = $request.url;

if (typeof $response !== 'undefined' && $response.body) {
    try {
        let obj = JSON.parse($response.body);
        obj.errno = 0;
        obj.error_code = 0;
        if (Array.isArray(obj.data)) {
            obj.data = [];
        } else if (typeof obj.data === 'object' && obj.data !== null) {
            obj.data.ad_list = [];
            obj.data.ads = [];
            obj.data.list = [];
            obj.data.records = [];
        }
        obj.ad_list = [];
        obj.ads = [];
        obj.ad_info = [];
        obj.list = [];
        obj.records = [];
        obj.splash = {};
        obj.fuse = false;
        $done({ body: JSON.stringify(obj) });
    } catch (e) {
        $done({});
    }
} else {
    // http-request 模式：本地秒级返回合规空数据，客户端免等待直接进入主页
    $done({
        response: {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                errno: 0,
                error_code: 0,
                request_id: Date.now(),
                ad_list: [],
                ads: [],
                data: [],
                list: [],
                records: [],
                splash: {},
                fuse: false
            })
        }
    });
}
