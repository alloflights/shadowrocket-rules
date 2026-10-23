'use strict';
// Synthetic regression cases, not captured user traffic. No network/user data.
module.exports = function ({ test, assert, ROOT, files, read, body, sectionOf }) {
  const vm = require('vm');
  const sr = require('../src/shadowrocket');
  const base = require('../scripts/build').loadApps();
  const units = sr.srUnits(base);
  function invoke(file, url, value, options = {}) {
    let calls = 0, output;
    const context = {
      $request: { url, method: 'GET', headers: options.headers || {} },
      $done(v) { calls++; output = v; },
      $persistentStore: { read() { return null; }, write() { return true; } },
      console: { log() {} },
    };
    if (!options.request) context.$response = { body: typeof value === 'string' ? value : JSON.stringify(value), status: options.status || 200, headers: options.headers || {} };
    vm.runInNewContext(read(`modules/scripts/${file}`), context, { timeout: 1500 });
    assert(calls === 1, `${file}: done ${calls}`);
    return output;
  }
  const parse = (file, url, value, opt) => JSON.parse(invoke(file, url, value, opt).body);
  const script = (id, name) => units.find(u => u.id === id).scripts.find(s => !name || s.name === name);
  const matches = (s, url) => new RegExp(s.pattern).test(url);
  function localRoute(text, host) {
    for (const rule of body(sectionOf(text, 'Rule'))) {
      const [type, domain, policy] = rule.split(',');
      if (type === 'DOMAIN' && host === domain || type === 'DOMAIN-SUFFIX' && (host === domain || host.endsWith('.' + domain))) return policy;
      if (type === 'DOMAIN-KEYWORD' && host.includes(domain)) return policy;
      if (/^(RULE-SET|DOMAIN-SET)$/.test(type) && policy === 'REJECT') return 'REMOTE-REJECT-BEFORE-GUARD';
    }
  }
  for (const rel of ['Shadowrocket_LazyGroup_Merged.conf', 'Shadowrocket_AllInOne_Ultimate.conf', 'modules/adblock-ultimate.sgmodule', 'modules/adblock.sgmodule', 'modules/awavenue.sgmodule', 'modules/wechat.sgmodule']) {
    test(`${rel}: 微信 DNS / QQ 微信媒体在广告表之前直连`, () => {
      for (const h of [...sr.DNS_HOSTS, ...sr.MEDIA_SUFFIXES, 'wxsnsdy.wxs.qq.com', 'wxsnsdythumb.wxs.qq.com', 'a.qpic.cn']) assert(localRoute(files[rel] || read(rel), h) === 'DIRECT', h);
    });
  }
  test('抖音规则源 403 修复仅应用于 SR，Loon 原始链接不变', () => {
    assert(files['Shadowrocket_AllInOne_Ultimate.conf'].includes('https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Shadowrocket/DouYin/DouYin.list'), 'SR 未切换');
    assert(read('src/rules/90-domestic.list').includes('cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Shadowrocket/DouYin/'), '共享源被改动');
  });
  test('原生媒体使用真实 IP；不以旁路整个 QQ/微信或关闭广告来加速', () => {
    const conf = files['Shadowrocket_AllInOne_Ultimate.conf'];
    const real = conf.split('\n').find(l => l.startsWith('always-real-ip = '));
    for (const h of sr.realIP()) assert(real.includes(h), `real-ip ${h}`);
    assert(!/^skip-proxy = .*\*\.(?:qq\.com|weixin\.qq\.com)/m.test(conf), '宽泛旁路');
    const full = files['modules/adblock-ultimate.sgmodule'];
    for (const marker of ['DOMAIN-SUFFIX,gdt.qq.com,REJECT', 'DOMAIN,ad.weixin.qq.com,REJECT', 'mp.weixin.qq.com']) assert(full.includes(marker), `丢失拦截/公众号 ${marker}`);
    assert(!/DOMAIN-SUFFIX,(?:qq\.com|weixin\.qq\.com),DIRECT/.test(body(sectionOf(full, 'Rule')).slice(0, 100).join('\n')), '整站放行');
    assert(/stun-response-ip = 127.0.0.1/.test(conf), '无关隐私设置被改动');
  });
  test('广告模块仍保留 AWA、AMDC 和明确广告接口', () => {
    const full = files['modules/adblock-ultimate.sgmodule'];
    for (const marker of ['AWAvenue-Ads-Rule', 'amdc.m.taobao.com,REJECT', 'mtop\\.taobao\\.idle\\.popup\\.window', 'mtop\\.fliggy\\.crm\\.screen']) assert(full.includes(marker), marker);
  });
  test('Loon 全部产物只引用原共享脚本，不引用 SR 覆盖层', () => {
    for (const [rel, text] of Object.entries(files).filter(([p]) => p.startsWith('loon/') || p.startsWith('Loon_'))) assert(!/(?:zhihu|xiaohongshu|goofish|ali-splash)-sr\.js/.test(text), rel);
    for (const id of ['zhihu', 'xiaohongshu', 'goofish']) assert(base.find(u => u.id === id).scripts.every(s => !s.script.includes('-sr')), `源对象被改动 ${id}`);
  });

  const zh = 'https://api.zhihu.com/';
  for (const endpoint of ['topstory/hot-lists/total?limit=50', 'v4/topstory/hot-lists/total', 'topstory/recommend', 'feed-root/sections/query/v2', 'moments/recommend']) {
    test(`知乎 ${endpoint}: 普通热榜/追踪槽位保留，明确广告仍去除`, () => {
      const normal = { id: '42', type: 'hot_list_feed', ad_info: {}, ad_list: [], conversion_tracks: [], click_tracks: ['metric'], show_tracks: [], view_tracks: [], is_ad: 'false', extra: '{"is_ad":"false","pos_id":"a","slot_id":12}', brief: '{"is_ad":false}', target: { id: '7', type: 'question', title: '如何看待广告？', url: zh + 'questions/7' }, common_card: { content: { text: '广告', url: 'https://www.jd.com/' } } };
      const input = { data: [normal, { type: 'feed_advert' }, { extra: '{"is_ad":true}' }, { target: { type: 'sdk_ad' } }, { common_card: { footline: { text: '广告' } } }], paging: { next: 'next', is_end: false } };
      assert(matches(script('zhihu'), zh + endpoint), '接口未接入');
      const out = parse('zhihu-sr.js', zh + endpoint, input);
      assert(out.data.length === 1 && out.data[0].id === '42', '正常卡丢失或广告漏出');
      assert(out.data[0].target.url === normal.target.url && out.paging.next === 'next', '导航/分页丢失');
    });
  }
  test('知乎回答详情保留问题及正常附件，仅清理商品/MCN 广告', () => {
    const value = { id: 42, question: { id: 7, title: '问题', url: zh + 'questions/7' }, attachment: { type: 'question', id: 7 }, link_cards: [{ type: 'question', url: zh + 'questions/7' }, { type: 'mcn_link_card' }], mcn_link_cards: [{}], content: '<p>正文</p><a class="MCNLinkCard">广告</a>' };
    for (const data of [value, { data: value }]) {
      let out = parse('zhihu-sr.js', zh + 'v4/answers/42', data); out = out.data || out;
      assert(out.question.id === 7 && out.attachment.id === 7 && out.link_cards.length === 1, '问题详情入口丢失');
      assert(!out.mcn_link_cards && !out.content.includes('MCNLinkCard') && out.content.includes('正文'), '商品卡/正文异常');
    }
  });
  test('知乎推荐列表保留正常问题及分页，而非清空所有推荐', () => {
    for (const path of ['answers/42/recommendations', 'articles/42/recommendation']) {
      const out = parse('zhihu-sr.js', zh + path, { data: [{ type: 'question', id: 7 }, { type: 'market_card' }], paging: { next: 'n' } });
      assert(out.data.length === 1 && out.data[0].id === 7 && out.paging.next === 'n', path);
    }
  });
  test('知乎：查询参数不改变接口分支，未知 commercial_api 不清空', () => {
    const input = { data: [{ type: 'question', id: 7 }], marker: 1 };
    assert(parse('zhihu-sr.js', zh + 'topstory/hot-lists/total?redirect=/answers/1/recommendations', input).data[0].id === 7, 'query 分支污染');
    assert(parse('zhihu-sr.js', zh + 'commercial_api/new_business', input).marker === 1, '未知接口被清空');
    const out = parse('zhihu-sr.js', zh + 'topstory/recommend', { data: [{ extra: '{"is_ad":"1"}' }, { brief: '{"type":"sdk_ad"}' }, { target: { url: 'https://s.click.taobao.com/id' } }, { type: 'answer', id: 7 }] });
    assert(out.data.length === 1 && out.data[0].id === 7, '广告识别失效');
  });

  const xhs = 'https://edith.xiaohongshu.com/api/sns/';
  for (const endpoint of ['v5/note/comment/list?note_id=n', 'v3/note/comment/sub_comments?note_id=n']) {
    test(`小红书 ${endpoint}: 评论/子评论原生保存标记及签名不损坏`, () => {
      assert(matches(script('xiaohongshu'), xhs + endpoint), '评论没接入');
      const signed = 'https://sns-webpic-qc.xhscdn.com/a?imageView2/2/w/1080&sign=a%2Bb%3D';
      const comment = { id: 'c', red_id: 'original-user', comment_type: 3, media_source_type: 1, pictures: [{ url: signed, media_save_config: { disable_save: true, disable_watermark: false } }], sub_comments: [{ id: 'c2', pictures: [{ url: signed }] }] };
      const out = parse('xiaohongshu-sr.js', xhs + endpoint, { code: 0, data: { comments: [comment], cursor: 'c' } });
      const c = out.data.comments[0];
      assert(c.comment_type === 2 && c.media_source_type === 0 && c.red_id === 'original-user', '评论兼容/作者被损坏');
      for (const p of [c.pictures[0], c.sub_comments[0].pictures[0]]) assert(p.media_save_config.disable_watermark && !p.media_save_config.disable_save && p.url === signed, '保存标记/签名错误');
      assert(out.data.cursor === 'c', '翻页丢失');
    });
  }
  test('小红书：评论升级后首页广告过滤继续生效，普通笔记不丢失', () => {
    const out = parse('xiaohongshu-sr.js', xhs + 'v6/homefeed', { data: [{ id: 'normal', model_type: 'note', card_icon: 'text' }, { ads_info: { id: 1 } }, { model_type: 'live_v2' }] });
    assert(out.data.length === 1 && out.data[0].id === 'normal', '首页去广告回退');
  });
  test('小红书：超深评论原样放行，不溢出/卡死', () => {
    const v = {}; let p = v; for (let i = 0; i < 60; i++) { p.next = {}; p = p.next; }
    assert(!invoke('xiaohongshu-sr.js', xhs + 'v5/note/comment/list?', v).body, '超限应不改写');
  });

  const apis = ['mtop.taobao.wireless.home.splash.awesome.get', 'mtop.taobao.idlecommerce.splash', 'mtop.taobao.idle.local.splash', 'mtop.taobao.idle.home.welcome'];
  for (const api of apis) for (const host of ['guide-acs.m.taobao.com/gw', 'acs.m.goofish.com/gw', 'h5api.m.goofish.com/h5', 'h5api.m.taobao.com/h5']) {
    test(`开屏 ${api} @ ${host}: 保留成功信封，抑制素材和缓存`, () => {
      const url = `https://${host}/${api}/1.0/`;
      const id = api.includes('wireless') ? 'taobao' : 'goofish';
      assert(matches(script(id, id + '_splash_clean'), url), '响应 hook 缺失');
      assert(matches(script(id, id + '_splash_cache'), url), '请求 hook 缺失');
      const input = { api, v: '1.0', ret: ['SUCCESS::调用成功'], data: { bizData: { 'taobao-splash': { data: [{ imgUrl: 'https://ad.test/a', videoUrl: 'v', waitTime: '4', hotStart: 'true', coldStart: true, times: 3 }] } }, ads: [{ id: 1 }], nextToken: 'keep' } };
      const out = parse('ali-splash-sr.js', url, input);
      const item = out.data.bizData['taobao-splash'].data[0];
      assert(out.ret[0] === input.ret[0] && out.api === api && out.v === '1.0' && out.data.nextToken === 'keep', '破坏 MTop 信封');
      assert(item.imgUrl === '' && item.videoUrl === '' && item.waitTime === '0' && item.times === 0 && item.hotStart === 'false' && item.coldStart === false && !out.data.ads.length, '开屏仍启用');
      const req = invoke('ali-splash-sr.js', url, undefined, { request: true, headers: { 'If-None-Match': 'tag', 'if-modified-since': 'date', Cookie: 'keep' } });
      assert(req.headers.Cookie === 'keep' && req.headers['Cache-Control'] === 'no-store' && !req.headers['If-None-Match'] && !req.headers['if-modified-since'], '条件缓存/认证头损坏');
      const res = invoke('ali-splash-sr.js', url, input, { headers: { ETag: 'tag', 'content-length': '80', 'content-encoding': 'gzip', 'Set-Cookie': 'keep' } });
      assert(res.headers['Cache-Control'] === 'no-store' && res.headers['Set-Cookie'] === 'keep' && !res.headers.ETag && !res.headers['content-length'] && !res.headers['content-encoding'], '响应缓存/编码头错误');
    });
  }
  test('开屏：兼容字符串 data / 内嵌 data，不改未知业务结构', () => {
    const url = 'https://acs.m.taobao.com/gw/' + apis[0] + '/1.0/';
    const input = { ret: ['SUCCESS::ok'], data: JSON.stringify({ data: JSON.stringify([{ imgUrl: 'ad', enable: true }]) }) };
    const out = parse('ali-splash-sr.js', url, input);
    assert(typeof out.data === 'string' && JSON.parse(JSON.parse(out.data).data)[0].imgUrl === '', '字符串兼容');
    assert(!invoke('ali-splash-sr.js', url, { data: { unknown: { greeting: 'ok' } } }).body, '未知字段被清空');
  });
  test('淘宝：原 jq 的可选开屏禁用默认值保持生效', () => {
    const url = 'https://guide-acs.m.taobao.com/gw/' + apis[0] + '/1.0/';
    const out = parse('ali-splash-sr.js', url, { data: { containers: { splash_home_base: { base: { sections: [{ bizData: { 'taobao-splash': { data: [{ imgUrl: 'ad' }] } } }] } } } } });
    const ad = out.data.containers.splash_home_base.base.sections[0].bizData['taobao-splash'].data[0];
    for (const k of ['hotStart', 'coldStart', 'haveVoice', 'hideTBLogo', 'enable4G']) assert(ad[k] === 'false', k);
    assert(ad.times === '0' && ad.waitTime === '0' && ad.startTime === '3818332800000' && ad.imgUrl === '', '默认禁用字段缺失');
  });
  test('开屏：错误、304、交易和普通商品视频原样放行', () => {
    const url = 'https://acs.m.goofish.com/gw/' + apis[1] + '/1.0/';
    for (const val of [{ ret: ['FAIL_SYS::retry'], data: { imgUrl: 'keep' } }, { code: 500, data: { imgUrl: 'keep' } }, { success: false, data: { imgUrl: 'keep' } }]) assert(!invoke('ali-splash-sr.js', url, val).body, '改了失败响应');
    assert(!invoke('ali-splash-sr.js', url, { data: { imgUrl: 'ad' } }, { status: 304 }).body, '改了 304');
    for (const api of ['mtop.taobao.order.query', 'mtop.taobao.idle.message.list', 'mtop.taobao.cloudvideo.video.query']) {
      const normal = 'https://acs.m.taobao.com/gw/' + api + '/1.0/';
      assert(!units.flatMap(u => u.scripts).filter(s => s.script === 'ali-splash-sr.js').some(s => matches(s, normal)), `误挂接 ${api}`);
      assert(!invoke('ali-splash-sr.js', normal, { data: { imgUrl: 'normal' } }).body, `误修改 ${api}`);
    }
  });
  test('淘宝：PopLayer 与 guide 开屏视频净化不回退', () => {
    const url = 'https://poplayer.template.alibaba.com/ad-v2.json';
    assert(matches(script('taobao', 'taobao_splash_clean'), url), 'PopLayer hook');
    const out = parse('ali-splash-sr.js', url, { enable: true, res: { images: ['a'], videos: ['v'] }, mainRes: { images: ['b'] }, metadata: 'keep' });
    assert(!out.enable && !out.res.images.length && !out.res.videos.length && !out.mainRes.images.length && out.metadata === 'keep', 'PopLayer 失效');
    const v = parse('ali-splash-sr.js', 'https://guide-acs.m.taobao.com/gw/mtop.taobao.cloudvideo.video.query/1.0/', { data: { duration: '5', resources: ['ad'], caches: ['ad'] } });
    assert(v.data.duration === '0' && !v.data.resources.length && !v.data.caches.length, '开屏视频失效');
    assert(!units.find(u => u.id === 'taobao').bodyRewrites.length, '不应 jq + script 重复处理');
  });
  test('闲鱼：保留非开屏拦截，开屏不再返回空 reject-dict', () => {
    const u = units.find(u => u.id === 'goofish');
    assert(!u.rewrites.some(l => /idlecommerce\\.splash|idle\\.local\\.splash|idle\\.home\\.welcome/.test(l)), '开屏仍被提前 reject');
    assert(u.rewrites.some(l => l.includes('popup')) && u.bodyRewrites.length === 4, '其它去广告丢失');
  });
  test('闲鱼：备用网关字符串信息流仍过滤广告且不改信封类型', () => {
    const url = 'https://h5api.m.goofish.com/h5/mtop.taobao.idle.local.home/1.0/';
    assert(matches(script('goofish', 'goofish_clean'), url), '备用网关未接入');
    const val = { api: 'api', ret: ['SUCCESS::ok'], data: JSON.stringify({ sections: [{ id: 'ok', data: { bizType: 'normal' } }, { data: { bizType: 'AD' } }] }) };
    const out = parse('goofish-sr.js', url, val);
    assert(typeof out.data === 'string' && JSON.parse(out.data).sections.length === 1 && out.ret[0] === val.ret[0], '漏广告/信封破坏');
    val.ret = ['FAIL_SYS::retry']; assert(!invoke('goofish-sr.js', url, val).body, '改了错误响应');
  });
  for (const [file, url] of [['zhihu-sr.js', zh + 'topstory/hot-lists/total'], ['xiaohongshu-sr.js', xhs + 'v5/note/comment/list?'], ['goofish-sr.js', 'https://acs.m.goofish.com/gw/mtop.taobao.idle.local.home/1.0/'], ['ali-splash-sr.js', 'https://acs.m.taobao.com/gw/' + apis[0] + '/1.0/']]) {
    test(`${file}: 异常响应原样放行且只完成一次`, () => {
      for (const input of ['', '<html>error</html>', 'null', 'not-json']) assert(!invoke(file, url, input).body, input);
    });
  }
};
