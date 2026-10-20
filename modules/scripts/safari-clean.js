/** Safari 网页去打扰：仅处理 HTML，不移除 CSP，不覆盖只读 Location 方法。 */
(function safariClean() {
    try {
        if (typeof $response === 'undefined' || !$response || typeof $response.body !== 'string' || !$response.body) return $done({});
        var html = $response.body;
        var headers = $response.headers || {};
        var contentType = '';
        Object.keys(headers).forEach(function (k) { if (k.toLowerCase() === 'content-type') contentType = String(headers[k]).toLowerCase(); });
        if (contentType ? !/^(text\/html|application\/xhtml\+xml)(?:;|$)/.test(contentType) : !/<(?:!doctype\s+html|html|head|body)(?:\s|>)/i.test(html)) return $done({});
        if (html.indexOf('id="safari-clean-style"') !== -1) return $done({});
        // 只隐藏明确的打开 App 控件，不隐藏登录模态框、普通按钮或微博互动栏。
        var css = `<style id="safari-clean-style">
.RichContent-inner,.post_content{max-height:none!important}
.ContentItem-expandButton,.RichContent-collapsedText,.OpenInAppButton,.MobileAppHeader-downloadLink{display:none!important}
#article_content,.article_content{height:auto!important;max-height:none!important;overflow:visible!important}
.hide-article-box,.btn-readmore,.openApp,.btn_open_app_prompt,.wakeapp_btn,.app_header_open_app,.tb-app-download,.pb-app-entry,.frs_app_entry,.open_app,.recommend-app-box,.open-app-banner{display:none!important}
pre,code,div.markdown_views,.htmledit_views{user-select:auto!important;-webkit-user-select:auto!important}
</style>`;
        var js = `<script id="safari-clean-script">
(function(){
  var blocked=/^(zhihu|baidutieba|tbapp|csdn|sinaweibo|weibosdk|bilibili):/i;
  ['copy','contextmenu','selectstart'].forEach(function(name){document.addEventListener(name,function(e){e.stopPropagation();},true);});
  document.addEventListener('click',function(e){
    var node=e.target;
    if(node&&node.nodeType!==1)node=node.parentElement;
    var a=node&&node.closest?node.closest('a[href]'):null;
    if(a&&blocked.test(a.getAttribute('href')||'')){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  var open=window.open;
  window.open=function(u){if(blocked.test(String(u||'')))return null;return open.apply(window,arguments);};
  function expand(){
    ['#btn-readmore','.btn-readmore','.ContentItem-expandButton'].forEach(function(selector){
      try{var button=document.querySelector(selector);if(button)button.click();}catch(e){}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',expand);else expand();
  setTimeout(expand,500);setTimeout(expand,1500);
})();
</script>`;
        var injection = css + js;
        if (/<\/head\s*>/i.test(html)) html = html.replace(/<\/head\s*>/i, injection + '$&');
        else if (/<body(?:\s[^>]*)?>/i.test(html)) html = html.replace(/<body(?:\s[^>]*)?>/i, '$&' + injection);
        else html = injection + html;
        $done({ body: html });
    } catch (e) { $done({}); }
})();
