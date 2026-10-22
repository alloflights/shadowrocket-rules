'use strict';
// 抖音临时只读测试模块：合成用例，不是真实抓包。
module.exports = function ({ test, assert, files, read, body, sectionOf }) {
  const vm = require('vm');
  const FILE = 'modules/scripts/douyin-probe-sr.js';
  function run(store, { url, response, notes = [] }) {
    let calls = 0, out;
    const ctx = {
      $request: { url, method: 'GET', headers: { Cookie: 'sessionid=secret' } },
      $done(v) { calls++; out = v; },
      $persistentStore: { read: (k) => (k in store ? store[k] : null), write: (v, k) => { store[k] = v; return true; } },
      $notification: { post: (...a) => notes.push(a) },
      console: { log() {} },
    };
    if (response) ctx.$response = response;
    vm.runInNewContext(read(FILE), ctx, { timeout: 2000 });
    assert(calls === 1, `应恰好调用一次 $done，实际 ${calls}`);
    return out;
  }
  const feedUrl = 'https://api5-normal-zb.amemv.com/aweme/v1/feed/?device_id=123456789&iid=987654321';
  const feed = {
    status_code: 0,
    aweme_list: [
      { aweme_id: '7400000000000000001', desc: '正常游戏实况', aweme_type: 0, video: {} },
      { aweme_id: '7400000000000000002', desc: '推广视频', aweme_type: 0, video: {}, anchor_info: { type: 26, title: '燕云十六声', icon: { url_list: ['https://x'] }, extra: '{"game_id":"1","download_url":"https://y"}' } },
      { aweme_id: '7400000000000000003', desc: '广告', is_ads: true, raw_ad_data: '{"ad_id":1}', video: {} },
      { aweme_id: '7400000000000000004', desc: '字符串 false', is_ads: 'false', anchor_info: null, video: {} },
    ],
  };
  test('抖音测试：推荐响应只记录、不修改，并按链接字段统计', () => {
    const store = {}; const notes = [];
    const text = JSON.stringify(feed);
    const out = run(store, { url: feedUrl, response: { status: 200, headers: { 'Content-Type': 'application/json' }, body: text }, notes });
    assert(out && out.body === undefined && out.headers === undefined && out.response === undefined, '不得修改响应');
    const st = JSON.parse(store.sr_douyin_probe_v1);
    assert(st.feeds === 1 && st.items === 4 && st.linked === 2 && st.ads === 1, `统计错误 ${JSON.stringify([st.feeds, st.items, st.linked, st.ads])}`);
    const saved = JSON.stringify(st);
    assert(!saved.includes('123456789') && !saved.includes('987654321') && !saved.includes('secret'), '不得保存查询参数或 Cookie');
    assert(!saved.includes('https://x') && !saved.includes('https://y'), '不得保存链接地址');
    assert(saved.includes('燕云十六声') && saved.includes('"type":26'), '应保存链接字段样本');
    assert(notes.some((n) => /燕云十六声/.test(n[2])), '应提示带链接视频');
  });
  test('抖音测试：二进制 / 损坏 / 空响应原样放行', () => {
    for (const b of ['', 'not json', '{bad', new Uint8Array([8, 1, 255])]) {
      const store = {};
      const out = run(store, { url: feedUrl, response: { status: 200, headers: { 'content-type': 'application/x-protobuf' }, body: b } });
      assert(out && out.body === undefined, '异常响应被改写');
    }
    assert(run({}, { url: feedUrl }).body === undefined, '无响应时应放行');
  });
  test('抖音测试：报告页可读取并可清空', () => {
    const store = {};
    run(store, { url: feedUrl, response: { status: 200, headers: {}, body: JSON.stringify(feed) } });
    const page = run(store, { url: 'https://api5-normal-zb.amemv.com/__sr_probe__/report' });
    assert(page.response && page.response.status === 200 && /燕云十六声/.test(page.response.body), '报告页缺少样本');
    assert(!/<script/i.test(page.response.body.replace(/^[\s\S]*?<textarea/, '')), '样本内容未转义');
    const reset = run(store, { url: 'https://api5-normal-zb.amemv.com/__sr_probe__/report?reset=1' });
    assert(/推荐响应 0 次/.test(reset.response.body), '清空失败');
  });
  test('抖音测试模块：只解密推荐接口主机，不碰评论 / 社交 / 视频主机，且不进 Loon', () => {
    const text = read('modules/douyin-probe.sgmodule');
    const hosts = body(sectionOf(text, 'MITM')).join(',').replace(/^hostname\s*=\s*%APPEND%\s*/, '').split(',').map((h) => h.trim());
    assert(hosts.join(',') === 'api*-normal-*.amemv.com,aggr*-normal-*.amemv.com', `解密范围变化：${hosts}`);
    const line = body(sectionOf(text, 'Script')).find((l) => l.includes('http-response'));
    const re = new RegExp(line.match(/pattern=(.*?),script-path=/)[1]);
    for (const u of ['https://api5-normal-zb.amemv.com/aweme/v1/feed/', 'https://api-normal-m.amemv.com/aweme/v2/feed/', 'https://aggr26-normal-s19.amemv.com/x']) assert(re.test(u), `未匹配 ${u}`);
    for (const u of ['https://api5-social-m-hl.amemv.com/aweme/v2/comment/list/', 'https://v5-gzb-x.douyinvod.com/a', 'https://webcast3-normal-c-lf.amemv.com/x', 'https://api5-normal-zb.amemv.com.evil.test/x']) assert(!re.test(u), `误匹配 ${u}`);
    assert(!/douyin-probe/.test(read('modules/adblock-ultimate.sgmodule')), '全量模块不应包含测试模块');
  });
};
