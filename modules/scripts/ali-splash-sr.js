/* Shadowrocket only. Dedicated splash/config responses; never rewrite orders,
 * messages, product media or the MTop ret/api/v envelope. Unknown/error JSON passes.
 * Request revalidation avoids 304 reusing an unfiltered cached ad configuration.
 */
(function () {
  try {
    var url = String($request.url || '');
    var gateway = /^https?:\/\/(?:acs\.m\.taobao\.com|guide-acs\.m\.taobao\.com|(?:g-)?acs\.m\.goofish\.com|h5api\.m\.(?:taobao|goofish)\.com)\/(?:gw|h5)\/mtop\.taobao\.(?:wireless\.home\.splash\.awesome\.get|idlecommerce\.splash(?:\.[a-z0-9]+)*|idle\.local\.splash(?:\.[a-z0-9]+)*|idle\.home\.welcome)(?:[/?]|$)/i.test(url);
    var video = /^https:\/\/guide-acs\.m\.taobao\.com\/gw\/mtop\.taobao\.cloudvideo\.video\.query(?:[/?]|$)/i.test(url);
    var pop = /^https:\/\/poplayer\.template\.alibaba\.com\/[^/?]+\.json(?:[?]|$)/i.test(url);
    if (!gateway && !video && !pop) return $done({});
    function headers(input, response) {
      var out = {};
      Object.keys(input || {}).forEach(function (key) {
        if (!(response ? /^(?:etag|last-modified|content-length|content-encoding|cache-control|expires)$/i : /^(?:if-none-match|if-modified-since|cache-control)$/i).test(key)) out[key] = input[key];
      });
      out['Cache-Control'] = 'no-store';
      return out;
    }
    if (typeof $response === 'undefined') return $done({ headers: headers($request.headers, false) });
    if (!$response || !$response.body || (Number($response.status || $response.statusCode) >= 300)) return $done({});
    var root = JSON.parse($response.body);
    if (!root || typeof root !== 'object' || Array.isArray(root)) return $done({});
    if (root.ret && (!Array.isArray(root.ret) || !root.ret.length || !root.ret.every(function (x) { return /^SUCCESS(?:::|$)/.test(x); }))) return $done({});
    if ((root.code !== undefined && root.code !== 0 && root.code !== '0' && root.code !== 200 && root.code !== '200') || root.success === false) return $done({});
    var data = pop ? root : root.data;
    var encoded = typeof data === 'string';
    if (encoded) data = JSON.parse(data);
    if (!data || typeof data !== 'object') return $done({});
    var changed = false, nodes = 0;
    function set(o, k, v) { if (JSON.stringify(o[k]) !== JSON.stringify(v)) { o[k] = v; changed = true; } }
    function walk(node, depth) {
      if (!node || typeof node !== 'object') return;
      if (++nodes > 12000 || depth > 40) throw new Error('budget');
      // Retain the previous Taobao jq's suppression defaults even when the
      // server omits optional flags. Only recognized splash material objects.
      if (gateway && !Array.isArray(node) && Object.keys(node).some(function(k) { return /^(?:imgUrl|imageUrl|image_url|videoUrl|video_url|materialUrl|material_url)$/.test(k); })) {
        ['waitTime', 'times'].forEach(function(k) { if (!(k in node)) set(node, k, '0'); });
        ['hotStart', 'coldStart', 'haveVoice', 'hideTBLogo', 'enable4G'].forEach(function(k) { if (!(k in node)) set(node, k, 'false'); });
        ['startTime', 'endTime', 'gmtStartMs', 'gmtEndMs'].forEach(function(k) { if (!(k in node)) set(node, k, '3818332800000'); });
        ['gmtStart', 'gmtEnd'].forEach(function(k) { if (!(k in node)) set(node, k, '2090-12-31 00:00:00'); });
      }
      Object.keys(node).forEach(function (k) {
        var val = node[k];
        if (gateway && /^(?:imgUrl|imageUrl|image_url|videoUrl|video_url|materialUrl|material_url|clickUrl|click_url|landingUrl|landing_url)$/.test(k) && typeof val === 'string') set(node, k, '');
        else if (gateway && /^(?:ads|adList|ad_list|splash|splashList|splash_list|materials|materialList|material_list)$/.test(k) && Array.isArray(val)) set(node, k, []);
        else if (gateway && /^(?:waitTime|times|duration|displayTime|display_time)$/.test(k) && (typeof val === 'number' || typeof val === 'string')) set(node, k, typeof val === 'string' ? '0' : 0);
        else if (gateway && /^(?:hotStart|coldStart|haveVoice|hideTBLogo|enable4G|enable|enabled|showSplash|show_splash)$/.test(k) && /^(?:boolean|string|number)$/.test(typeof val)) set(node, k, typeof val === 'string' ? 'false' : typeof val === 'number' ? 0 : false);
        else if (gateway && /^(?:startTime|endTime|gmtStartMs|gmtEndMs)$/.test(k) && (typeof val === 'string' || typeof val === 'number')) set(node, k, typeof val === 'string' ? '3818332800000' : 3818332800000);
        else if (gateway && /^(?:gmtStart|gmtEnd)$/.test(k) && typeof val === 'string') set(node, k, '2090-12-31 00:00:00');
        else if (val && typeof val === 'object') walk(val, depth + 1);
        // MTop sometimes serializes bizData["taobao-splash"].data as JSON.
        else if (gateway && k === 'data' && typeof val === 'string' && /^[\[{]/.test(val)) {
          var nested; try { nested = JSON.parse(val); } catch (_) { return; }
          walk(nested, depth + 1); set(node, k, JSON.stringify(nested));
        }
      });
    }
    if (gateway) walk(data, 0);
    if (video) {
      ['resources', 'caches'].forEach(function (k) { if (Array.isArray(data[k])) set(data, k, []); });
      if ('duration' in data) set(data, 'duration', typeof data.duration === 'string' ? '0' : 0);
      if ('respTimeInMs' in data) set(data, 'respTimeInMs', '3818332800000');
    }
    if (pop) {
      if ('enable' in data) set(data, 'enable', false);
      [data.res, data.mainRes].forEach(function (res) { if (res && typeof res === 'object') ['images', 'videos'].forEach(function (k) { if (Array.isArray(res[k])) set(res, k, []); }); });
    }
    if (!changed) return $done({});
    if (!pop) root.data = encoded ? JSON.stringify(data) : data;
    $done({ body: JSON.stringify(root), headers: headers($response.headers, true) });
  } catch (_) { $done({}); }
})();
