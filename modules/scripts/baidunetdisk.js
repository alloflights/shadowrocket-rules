// 百度网盘净化脚本 (彻底解决开屏白屏转圈与摇一摇跳转残留)
const url = $request.url;

if (typeof $response !== 'undefined' && $response.body) {
    // http-response 模式：解析真实服务器返回并将广告数组清空，保留合法协议外壳
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
        obj.splash = {};
        obj.fuse = false;
        $done({ body: JSON.stringify(obj) });
    } catch (e) {
        $done({});
    }
} else {
    // http-request 模式：Shadowrocket / Surge 标准 Mock 语法
    $done({
        response: {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
                errno: 0,
                error_code: 0,
                request_id: Date.now(),
                ad_list: [],
                ads: [],
                data: []
            })
        }
    });
}
