// 百度网盘净化脚本 (彻底解决开屏白屏转圈与摇一摇跳转残留)
const url = $request.url;

if (url.includes('/pcs/adx') || url.includes('/pcs/ad')) {
    // 返回标准无广告响应结构，使网盘直接跳过开屏视图并注销加速度计监听，杜绝白屏转圈
    $done({
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
    });
} else if (url.includes('/buy/ad/conf') || url.includes('/activityentry') || url.includes('/bchannel/list') || url.includes('/welfare/list')) {
    $done({
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
            errno: 0,
            data: {}
        })
    });
} else {
    $done({});
}
