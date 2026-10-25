'use strict';
// v3.3.8：小火箭小红书备用域名、搜索填充词与广告素材域名（合成用例）。
module.exports = function ({ test, assert, files, body, sectionOf, run }) {
  const mod = files['modules/xiaohongshu.sgmodule'];
  const script = body(sectionOf(mod, 'Script')).find((l) => l.startsWith('xiaohongshu_purify'));
  const re = new RegExp(script.match(/pattern=(.*?),script-path=/)[1]);
  const rewrites = body(sectionOf(mod, 'URL Rewrite')).map((l) => new RegExp(l.split(' - ')[0]));
  test('小红书 SR：脚本覆盖备用域名、搜索填充词与视频保存', () => {
    for (const u of ['https://edith.rnote.com/api/sns/v6/homefeed?x=1', 'https://edith.xiaohongshu.com/api/sns/v1/search/hint?k=1', 'https://edith.xiaohongshu.com/api/sns/v1/search/trending?k=1',
      'https://so.xiaohongshu.com/api/sns/v10/search/notes?k=1', 'https://rec.xiaohongshu.com/api/sns/v4/note/videofeed?a=1', 'https://edith.xiaohongshu.com/api/sns/v10/note/video/save?a=1',
      'https://edith.xiaohongshu.com/api/sns/v5/note/comment/list?a=1']) assert(re.test(u), `未覆盖 ${u}`);
    for (const u of ['https://edith.xiaohongshu.com/api/sns/v1/interaction/comment/video/download?a=1', 'https://edith.xiaohongshu.com/api/sns/v2/user/me']) assert(!re.test(u), `误覆盖 ${u}`);
  });
  test('小红书 SR：重写拒绝引导 / 横幅，不拒绝 detailfeed 预加载', () => {
    const hit = (u) => rewrites.some((x) => x.test(u));
    for (const u of ['https://edith.xiaohongshu.com/api/sns/v5/note/guide?a=1', 'https://edith.rnote.com/api/sns/v1/guide/user_banner', 'https://ci.rnote.com/system_config/watermark/a.png']) assert(hit(u), `未拒绝 ${u}`);
    for (const u of ['https://edith.xiaohongshu.com/api/sns/v1/note/detailfeed/preload?a=1', 'https://edith.xiaohongshu.com/api/sns/v6/homefeed?a=1']) assert(!hit(u), `误拒绝 ${u}`);
  });
  test('小红书 SR：广告素材域名拒绝、MITM 含备用域名', () => {
    const rules = body(sectionOf(mod, 'Rule'));
    for (const h of ['ads-img-qc.xhscdn.com', 'ads-video-al.xhscdn.com', 't-ads.xiaohongshu.com']) assert(rules.includes(`DOMAIN,${h},REJECT`), h);
    assert(!rules.some((l) => /DOMAIN-SUFFIX,xhscdn\.com|DOMAIN,(sns-img|sns-video)/.test(l)), '误拦正常图片 / 视频 CDN');
    const mitm = body(sectionOf(mod, 'MITM')).join(' ');
    for (const h of ['edith.rnote.com', 'so.xiaohongshu.com', 'rec.xiaohongshu.com']) assert(mitm.includes(h), h);
  });
  test('小红书 SR：搜索填充词与趋势词清空', () => {
    const a = JSON.parse(run('xiaohongshu-sr.js', { url: 'https://edith.xiaohongshu.com/api/sns/v1/search/hint?a=1', responseBody: JSON.stringify({ data: { hint_words: [{ title: 'x' }] } }) }).body);
    assert(a.data.hint_words.length === 0);
    const b = JSON.parse(run('xiaohongshu-sr.js', { url: 'https://edith.xiaohongshu.com/api/sns/v1/search/trending?a=1', responseBody: JSON.stringify({ data: { queries: [1], hint_word: { t: 1 } } }) }).body);
    assert(b.data.queries.length === 0 && Object.keys(b.data.hint_word).length === 0);
  });
  test('Loon：小红书仍由插件负责，Shadowrocket 备用域名未进入 Loon', () => {
    const loon = Object.entries(files).filter(([k]) => k.startsWith('loon/') || k === 'Loon_LazyGroup.conf').map(([, v]) => v).join('\n');
    assert(!/rnote\.com|ads-img-qc\.xhscdn\.com/.test(loon), 'Loon 产物被改动');
  });
};
