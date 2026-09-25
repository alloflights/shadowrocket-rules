// 移动端 Safari 网页去流氓化脚本 (Auto-Expand, Remove App Banners, Unlock Copy)
// 适配知乎、CSDN、百度贴吧、微博移动端网页

const url = $request.url;
let body = $response.body;

if (body && typeof body === 'string') {
    const injectCSS = `
    <style id="safari-clean-style">
        /* 1. 知乎移动端网页 */
        .RichContent-inner { max-height: none !important; }
        .ContentItem-expandButton, 
        .RichContent-collapsedText, 
        .OpenInAppButton, 
        .MobileAppHeader-downloadLink, 
        .ModalWrap,
        .Button--plain.Button--withIcon.Button--withLabel { display: none !important; }

        /* 2. CSDN 移动端网页 */
        #article_content, .article_content { height: auto !important; max-height: none !important; overflow: visible !important; }
        .hide-article-box, 
        .btn-readmore, 
        .openApp, 
        .feed-Sign-span, 
        #passportbox, 
        .btn_open_app_prompt,
        .aside-box-footerClassify { display: none !important; }
        pre, code, div.markdown_views, .htmledit_views { user-select: auto !important; -webkit-user-select: auto !important; }

        /* 3. 百度贴吧移动端网页 */
        .post_content { max-height: none !important; }
        .wakeapp_btn, 
        .app_header_open_app, 
        .tb-app-download, 
        .pb-app-entry, 
        .frs_app_entry, 
        .open_app,
        .recommend-app-box { display: none !important; }

        /* 4. 微博移动端网页 */
        .lite-page-editor, .m-tips, .m-btn-box, .m-editor-box, .open-app-banner { display: none !important; }
    </style>
    `;

    const injectJS = `
    <script id="safari-clean-script">
    (function() {
        // 彻底解除全网文字复制限制与右键拦截
        document.addEventListener('copy', function(e) { e.stopPropagation(); }, true);
        document.addEventListener('contextmenu', function(e) { e.stopPropagation(); }, true);
        document.addEventListener('selectstart', function(e) { e.stopPropagation(); }, true);

        // 拦截各大移动网页主动尝试通过私有 scheme 唤起 App 的行为
        var blockedSchemes = ['zhihu://', 'baidutieba://', 'tbapp://', 'csdn://', 'sinaweibo://', 'weibosdk://', 'bilibili://'];
        var checkAndBlock = function(targetUrl) {
            if (typeof targetUrl === 'string') {
                for (var i = 0; i < blockedSchemes.length; i++) {
                    if (targetUrl.indexOf(blockedSchemes[i]) === 0) {
                        return true;
                    }
                }
            }
            return false;
        };

        var origAssign = window.location.assign;
        window.location.assign = function(u) {
            if (!checkAndBlock(u) && origAssign) origAssign.call(window.location, u);
        };
        var origReplace = window.location.replace;
        window.location.replace = function(u) {
            if (!checkAndBlock(u) && origReplace) origReplace.call(window.location, u);
        };

        // 页面就绪后自动触发原本的展开与渲染逻辑
        var autoClickExpand = function() {
            var csdnBtn = document.getElementById('btn-readmore') || document.querySelector('.btn-readmore');
            if (csdnBtn) csdnBtn.click();
            var zhihuBtn = document.querySelector('.ContentItem-expandButton');
            if (zhihuBtn) zhihuBtn.click();
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', autoClickExpand);
        } else {
            autoClickExpand();
        }
        setTimeout(autoClickExpand, 500);
        setTimeout(autoClickExpand, 1500);
    })();
    </script>
    `;

    if (body.includes('</head>')) {
        body = body.replace('</head>', injectCSS + injectJS + '</head>');
    } else if (body.includes('<body')) {
        body = body.replace(/<body[^>]*>/, '$&' + injectCSS + injectJS);
    } else {
        body = injectCSS + injectJS + body;
    }
}

$done({ body });
