/**
 * 起点读书 (Qidian) 深度无感净化脚本
 *
 * 核心能力：
 * 1. 开屏广告 (v4/client/getsplashscreen)：清空 List 并强制关闭 EnableGDT 优量汇开关；
 * 2. 阻止强制跳精选页 (v2/deeplink/geturl)：置空 ActionUrl，启动默认停留书架；
 * 3. 移除活动 Tab、每日导读弹窗、书架右下角悬浮广告与青少年模式弹窗；
 * 4. 强制关闭 WolfEye 私有 TCP 协议回退（强制走 HTTPS），开启搜索用户功能；
 * 5. 100% 静默无感运行：彻底移除全部 $notification.post 报错弹窗，配备完整 try/catch 与空包早退保护。
 */

(function qidianPro() {
    var request = (typeof $request !== "undefined" && $request) ? $request : null;
    var url = (request && request.url) ? String(request.url) : "";
    var method = (request && request.method) ? String(request.method).toUpperCase() : "GET";
    var hasResponse = typeof $response !== "undefined" && $response;

    if (!hasResponse || !$response.body) {
        $done({});
        return;
    }

    try {
        var body = JSON.parse($response.body);
        if (!body || typeof body !== "object" || !body.Data) {
            $done({});
            return;
        }

        var data = body.Data;

        if (url.indexOf("v4/client/getsplashscreen") !== -1) {
            if (data.List) {
                data.List = null;
            }
            if ("EnableGDT" in data) {
                data.EnableGDT = 0;
            }
        } else if (url.indexOf("v2/deeplink/geturl") !== -1) {
            if (data.ActionUrl) {
                data.ActionUrl = "";
            }
        } else if (url.indexOf("v1/adv/getadvlistbatch") !== -1) {
            if (Array.isArray(data.iOS_tab)) {
                data.iOS_tab = [];
            }
        } else if (url.indexOf("v2/dailyrecommend/getdailyrecommend") !== -1) {
            if (Array.isArray(data.Items)) {
                data.Items = [];
            }
        } else if (url.indexOf("v1/bookshelf/getHoverAdv") !== -1) {
            if (Array.isArray(data.ItemList)) {
                data.ItemList = [];
            }
        } else if (url.indexOf("v1/client/getconf") !== -1 && (method === "POST" || method === "GET")) {
            if (data.ActivityPopup) {
                data.ActivityPopup = null;
            }
            if (data.WolfEye === 1) {
                data.WolfEye = 0;
            }
            if (data.CloudSetting && data.CloudSetting.TeenShowFreq === "1") {
                data.CloudSetting.TeenShowFreq = "0";
            }
            if (data.ActivityIcon && typeof data.ActivityIcon === "object") {
                data.ActivityIcon.StartTime = 0;
                data.ActivityIcon.EndTime = 0;
                delete data.ActivityIcon.Actionurl;
                delete data.ActivityIcon.Icon;
            }
            data.EnableSearchUser = "1";
        }

        $done({ body: JSON.stringify(body) });
    } catch (e) {
        $done({});
    }
})();
