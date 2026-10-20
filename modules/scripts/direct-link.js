/** 外链确认页直跳：仅 HTTP(S)，只解外层包装，不依赖 URL / URLSearchParams。 */
(function directLinkBypass() {
    try {
        var raw = typeof $request !== 'undefined' && $request ? String($request.url || '') : '';
        var source = raw.match(/^https?:\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?(?:#.*)?$/i);
        if (!source) return $done({});
        var host = source[1].toLowerCase();
        var routes = {
            'link.zhihu.com': /^\/?$/, 'link.csdn.net': /^\/?$/, 'link.juejin.cn': /^\/?$/,
            'www.jianshu.com': /^\/go-wild\/?$/, 'weibo.cn': /^\/sinaurl\/?$/,
            'jump.bdimg.com': /^\/safecheck(?:\/|$)/, 'jump2.bdimg.com': /^\/safecheck(?:\/|$)/,
            'c.pc.qq.com': /^\/middlem(?:\.html)?\/?$/, 'sspai.com': /^\/link\/?$/,
            'gitee.com': /^\/link\/?$/, 'www.yuque.com': /^\/r\/goto\/?$/
        };
        if (!routes[host] || !routes[host].test(source[2])) return $done({});
        var params = Object.create(null);
        (source[3] || '').split('&').forEach(function (part) {
            var i = part.indexOf('=');
            if (i < 0) return;
            var key = decodeURIComponent(part.slice(0, i).replace(/\+/g, ' '));
            if (!(key in params)) params[key] = decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '));
        });
        var keys = ['target', 'url', 'u', 'pfurl', 'dest', 'to', 'link', 'goto'];
        var target = '';
        for (var k = 0; k < keys.length; k++) if (params[keys[k]]) { target = params[keys[k]]; break; }
        if (!target) return $done({});
        // 查询参数已解一层；仅当整体仍被编码时继续解码，绝不解目标内部的路径 / 签名参数。
        for (var n = 0; n < 3 && !/^(?:https?:\/\/|\/\/|[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:[/?#]|$))/i.test(target); n++) {
            var decoded = decodeURIComponent(target);
            if (decoded === target) break;
            target = decoded;
        }
        if (/^\/\//.test(target)) target = 'https:' + target;
        else if (/^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i.test(target)) target = 'https://' + target;
        if (/[\x00-\x20\x7f\\]/.test(target)) return $done({});
        var http = target.match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i);
        if (!http) return $done({});
        var authority = http[1].match(/^(\[[0-9a-f:]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::(\d{1,5}))?$/i);
        if (!authority || (authority[2] && (+authority[2] === 0 || +authority[2] > 65535))) return $done({});
        if (authority[1].includes('..')) return $done({});
        $done({ response: { status: 302, headers: { Location: target, 'Cache-Control': 'no-cache, no-store, must-revalidate' } } });
    } catch (e) {
        $done({});
    }
})();
