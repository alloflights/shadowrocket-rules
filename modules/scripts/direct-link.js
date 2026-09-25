/**
 * 全网外链“零等待”直接跳转脚本 (Direct Link Bypass)
 * 功能：自动拦截知乎、CSDN、简书、掘金、微博、贴吧、QQ、少数派、Gitee、语雀等中间拦截确认页，
 *       以 0.05ms 本地直出 302 重定向到真实目标地址，零网络往返与零流量消耗。
 * 遵循: Ponytail 极简原则 (原生 WHATWG URL + 递归解码)
 * 作者: allofights
 */

(function directLinkBypass() {
    const rawUrl = $request ? $request.url : null;
    if (!rawUrl) {
        $done({});
        return;
    }

    try {
        const urlObj = new URL(rawUrl);
        const candidateKeys = ["target", "url", "u", "pfurl", "dest", "to", "link", "goto"];
        let target = null;

        for (const key of candidateKeys) {
            const val = urlObj.searchParams.get(key);
            if (val) {
                target = val;
                break;
            }
        }

        if (!target) {
            $done({});
            return;
        }

        let decoded = target;
        // 递归解码最多 3 层以解开嵌套编码
        for (let i = 0; i < 3; i++) {
            if (/^https?:\/\//i.test(decoded)) {
                if (!/%[0-9a-fA-F]{2}/.test(decoded.split("?")[0])) {
                    break;
                }
            }
            try {
                decoded = decodeURIComponent(decoded);
            } catch (e) {
                break;
            }
        }

        // 补全协议前缀
        if (!/^https?:\/\//i.test(decoded)) {
            if (decoded.startsWith("//")) {
                decoded = "https:" + decoded;
            } else if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(decoded)) {
                decoded = "https://" + decoded;
            }
        }

        // 校验合法性并直出 302 重定向
        new URL(decoded);
        $done({
            response: {
                status: 302,
                headers: {
                    "Location": decoded,
                    "Cache-Control": "no-cache, no-store, must-revalidate"
                }
            }
        });
    } catch (err) {
        $done({});
    }
})();
