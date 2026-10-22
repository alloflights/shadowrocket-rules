/*
 * 抖音推荐接口只读测试（Shadowrocket 临时诊断）
 * - 只记录接口能否被读取、推荐数据格式、带链接 / 广告标记的视频字段样本；
 * - 任何情况下都不修改请求或响应；
 * - 不保存查询参数、设备 ID、Cookie 或账号信息；
 * - 在 Safari 打开 https://api5-normal-zb.amemv.com/__sr_probe__/report 查看报告，加 ?reset=1 清空。
 */
(function () {
  var KEY = 'sr_douyin_probe_v1';
  var LINK_KEY = /anchor|game|micro_?app|mini_?app|promotion|commerce_info|poi_info|bottom_bar|entertainment|playlet|ad_info|raw_ad|is_ads|label_top|cell_room/i;
  var SKIP_VALUE_KEY = /url|uri|icon|avatar|cover|token|cookie|device|uid|sec_|openid|log_?pb|log_extra|track/i;

  function finish(v) { try { $done(v || {}); } catch (e) {} }
  function now() { return Date.now(); }
  function load() {
    try { var s = JSON.parse($persistentStore.read(KEY) || 'null'); if (s && s.v === 1) return s; } catch (e) {}
    return { v: 1, started: now(), paths: {}, samples: [], feeds: 0, items: 0, linked: 0, ads: 0, notes: {} };
  }
  function save(s) {
    try {
      var text = JSON.stringify(s);
      while (text.length > 60000 && s.samples.length > 5) { s.samples.shift(); text = JSON.stringify(s); }
      $persistentStore.write(text, KEY);
    } catch (e) {}
  }
  function notify(s, tag, gap, title, body) {
    try {
      var last = s.notes[tag] || 0;
      if (now() - last < gap) return;
      s.notes[tag] = now();
      $notification.post('抖音测试', title, body);
    } catch (e) {}
  }
  function header(h, name) {
    if (!h) return '';
    for (var k in h) if (k.toLowerCase() === name) return String(h[k]);
    return '';
  }
  function pathOf(url) {
    var m = String(url || '').match(/^https?:\/\/([^\/?#]+)([^?#]*)/i);
    if (!m) return '';
    var host = m[1].replace(/^(api|aggr)\d*-normal-[^.]+/, '$1*-normal-*');
    return host + m[2].replace(/\/\d{5,}(?=\/|$)/g, '/:id');
  }
  function clip(v, n) { v = String(v == null ? '' : v); return v.length > n ? v.slice(0, n) + '…' : v; }
  function compact(v, depth) {
    if (depth > 3) return '…';
    if (v == null || typeof v === 'boolean' || typeof v === 'number') return v;
    if (typeof v === 'string') {
      if (/^\s*[\[{]/.test(v) && v.length < 20000) { try { return compact(JSON.parse(v), depth + 1); } catch (e) {} }
      return clip(v, 60);
    }
    if (Array.isArray(v)) return v.slice(0, 3).map(function (x) { return compact(x, depth + 1); }).concat(v.length > 3 ? ['+' + (v.length - 3)] : []);
    var out = {}; var n = 0;
    for (var k in v) {
      if (n++ >= 14) { out['…'] = '+more'; break; }
      out[k] = SKIP_VALUE_KEY.test(k) ? '[略]' : compact(v[k], depth + 1);
    }
    return out;
  }
  function empty(v) {
    if (v == null || v === '' || v === false || v === 0 || v === '0' || v === 'false') return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') { for (var k in v) return false; return true; }
    return false;
  }
  function findLists(o, depth, out) {
    if (!o || typeof o !== 'object' || depth > 4 || out.length > 4) return out;
    if (Array.isArray(o)) { for (var i = 0; i < o.length && i < 5; i++) findLists(o[i], depth + 1, out); return out; }
    for (var k in o) {
      if (/^aweme_list$|^aweme_list_v2$|^data$|^items$/.test(k) && Array.isArray(o[k]) && o[k].length && typeof o[k][0] === 'object') {
        var first = o[k][0]; var a = first.aweme_info || first.aweme || first;
        if (a && (a.aweme_id || a.desc !== undefined || a.video)) { out.push(o[k]); continue; }
      }
      if (o[k] && typeof o[k] === 'object') findLists(o[k], depth + 1, out);
    }
    return out;
  }

  try {
    var url = ($request && $request.url) || '';
    if (/\/__sr_probe__\//.test(url)) {
      var st = /[?&]reset=1/.test(url) ? null : load();
      if (!st) { try { $persistentStore.write('', KEY); } catch (e) {} st = load(); }
      var data = JSON.stringify(st, null, 1).replace(/[<&]/g, function (c) { return c === '<' ? '&lt;' : '&amp;'; });
      var html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>抖音测试报告</title><body style="font:14px -apple-system;margin:12px">' +
        '<h3>抖音测试报告</h3><p>推荐响应 ' + st.feeds + ' 次，视频 ' + st.items + ' 条，带链接字段 ' + st.linked + ' 条，广告标记 ' + st.ads + ' 条。</p>' +
        '<p>长按下面文本框 → 全选 → 拷贝，发回聊天即可。</p><textarea style="width:100%;height:70vh;font:11px Menlo">' + data + '</textarea></body>';
      return finish({ response: { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, body: html } });
    }
    if (typeof $response === 'undefined' || !$response) return finish({});

    var s = load();
    var p = pathOf(url);
    var ct = header($response.headers, 'content-type').split(';')[0];
    var body = $response.body;
    var isText = typeof body === 'string';
    var len = isText ? body.length : (body && (body.byteLength || body.length)) || 0;
    var rec = s.paths[p] || (s.paths[p] = { n: 0, ct: '', size: 0, json: 0, feed: 0 });
    rec.n++; rec.ct = ct; rec.size = Math.max(rec.size, len);
    var keys = Object.keys(s.paths);
    if (keys.length > 60) delete s.paths[keys[0]];
    notify(s, 'alive', 600000, '已能读取抖音接口', '测试正常进行中，继续刷几条推荐即可');

    var json = null;
    if (isText && /^\s*[\[{]/.test(body)) { try { json = JSON.parse(body); rec.json++; } catch (e) {} }
    if (/feed/i.test(p) && !json) notify(s, 'binary', 600000, '推荐数据不是可读文本', (ct || '未知格式') + '，大小 ' + len);

    var lists = json ? findLists(json, 0, []) : [];
    if (lists.length) {
      rec.feed++; s.feeds++;
      var n = 0, linked = 0, ads = 0, names = [];
      for (var li = 0; li < lists.length; li++) {
        for (var i = 0; i < lists[li].length && i < 60; i++) {
          var it = lists[li][i]; var a = (it && (it.aweme_info || it.aweme)) || it;
          if (!a || typeof a !== 'object') continue;
          n++;
          var hit = {}, any = false, ad = false;
          for (var k in a) {
            if (!LINK_KEY.test(k) || empty(a[k])) continue;
            any = true; hit[k] = compact(a[k], 0);
            if (/^(is_ads|raw_ad_data|ad_info)$/.test(k)) ad = true;
          }
          if (it !== a) for (var k2 in it) if (k2 !== 'aweme_info' && k2 !== 'aweme' && LINK_KEY.test(k2) && !empty(it[k2])) { any = true; hit['外层.' + k2] = compact(it[k2], 0); }
          if (ad) ads++;
          if (!any) continue;
          linked++;
          var title = '';
          var an = a.anchor_info || (Array.isArray(a.anchors) && a.anchors[0]) || null;
          if (an) title = an.title || an.keyword || an.name || '';
          if (title && names.length < 3) names.push(clip(title, 12));
          s.samples.push({ t: new Date().toISOString().slice(5, 19), path: p, id: a.aweme_id ? String(a.aweme_id).slice(-6) : '', type: a.aweme_type, desc: clip(a.desc, 40), fields: hit });
          if (s.samples.length > 40) s.samples.shift();
        }
      }
      s.items += n; s.linked += linked; s.ads += ads;
      notify(s, 'feed', 10000, '推荐数据可以读取', '本次 ' + n + ' 条，带链接字段 ' + linked + ' 条' + (names.length ? '：' + names.join('、') : '') + '，广告标记 ' + ads + ' 条');
    }
    save(s);
  } catch (e) {}
  finish({});
})();
