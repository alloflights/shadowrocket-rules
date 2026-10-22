'use strict';
// v3.3.6：抖音补充拦截与 Notion 走代理（合成用例，不是真机验证）。
module.exports = function ({ test, assert, files, read, body, sectionOf, routeOf }) {
  const sr = require('../src/shadowrocket');
  const SR_MODULES = ['modules/adblock-ultimate.sgmodule', 'modules/adblock.sgmodule'];
  // 用户 38.4.0 请求记录中正常使用的主机，必须保持放行
  const KEEP = ['api5-normal-zb.amemv.com', 'api-normal-m.amemv.com', 'aggr26-normal-s19.amemv.com', 'api5-social-m-hl.amemv.com',
    'webcast3-normal-c-lf.amemv.com', 'frontier-aweme-zjg-ipainner.amemv.com', 'v5-gzb-jltc-x.douyinvod.com', 'p3-sign.douyinpic.com',
    'pull-flv-l13.douyincdn.com', 'lf26-dy-cdn-tos.bytegecko.com', 'p26-im-emoticon-sign.byteimg.com', 'tnc0-alisc1.zijieapi.com',
    'vcs-lf.zijieapi.com', 'saveu5-normal-hl.zijieapi.com', 'relation.zijieapi.com', 'polaris3-normal-zb.zijieapi.com',
    'lf3-static.bytednsdoc.com', 'p3-developer.bytemaimg.com', 'n98-lf-effect-aweme-302-ncdn.byteeffecttos.com', 'api5-hl.qishui.com', 'm.baike.com'];
  for (const rel of SR_MODULES) {
    const rules = body(sectionOf(files[rel], 'Rule'));
    test(`${rel}：抖音补充拦截全部生效`, () => {
      for (const line of sr.DOUYIN_ADS.filter((l) => !l.startsWith('#'))) {
        const host = line.split(',')[1];
        const hit = routeOf(rules, host);
        assert(hit && /^REJECT/.test(hit.policy), `${host} 未拦截：${hit && hit.rule}`);
      }
    });
    test(`${rel}：抖音推荐 / 评论 / 视频 / 图片 / 直播 / 配置主机不被拦截`, () => {
      for (const host of KEEP) {
        const hit = routeOf(rules, host);
        assert(!hit || !/^REJECT/.test(hit.policy), `${host} 被误拦：${hit && hit.rule}`);
      }
    });
    test(`${rel}：模块规则不覆盖 Notion 代理`, () => {
      for (const host of ['www.notion.so', 'msgstore.www.notion.so', 'file.notion.so', 'img.notionusercontent.com', 'x.notion.site', 'www.notion.com']) {
        const hit = routeOf(rules, host);
        assert(!hit, `${host} 被模块规则 ${hit && hit.rule} 抢先命中`);
      }
    });
  }
  for (const rel of ['Shadowrocket_LazyGroup_Merged.conf', 'Shadowrocket_AllInOne_Ultimate.conf']) test(`${rel}：Notion 全部走代理`, () => {
    const rules = body(sectionOf(files[rel], 'Rule'));
    for (const host of ['www.notion.so', 'msgstore.www.notion.so', 'api.notion.com', 'mail.notion.so', 'calendar.notion.so', 'x.notion.site',
      'aif.notion-static.com', 'img.notionusercontent.com', 'www.notion.new', 'www.makenotion.com', 'prod-files-secure.s3.us-west-2.amazonaws.com', 'http-inputs-notion.splunkcloud.com']) {
      const hit = routeOf(rules, host);
      assert(hit && hit.policy === 'PROXY', `${host}: ${hit ? hit.rule : '无显式规则'}`);
    }
    assert(!rules.some((l) => /notion/i.test(l) && /,DIRECT$/.test(l)), '仍有 Notion 直连规则');
    const general = sectionOf(files[rel], 'General').join('\n');
    assert(!/notion/i.test(general), 'Notion 不应进入旁路或真实 IP 列表');
  });
  test('海外分流模块：Notion 走代理', () => {
    const rules = body(sectionOf(files['modules/overseas-top500.sgmodule'], 'Rule'));
    assert(routeOf(rules, 'www.notion.so').policy === 'PROXY' && routeOf(rules, 'img.notionusercontent.com').policy === 'PROXY', 'Notion 仍直连');
  });
  test('Loon：Notion 与抖音补充规则保持原样（小火箭专用改动）', () => {
    const loon = Object.entries(files).filter(([k]) => k.startsWith('loon/') || k === 'Loon_LazyGroup.conf').map(([, v]) => v).join('\n');
    assert(!loon.includes('lf-leads-fe-scm.bytecdn.com') && !loon.includes('http-inputs-notion.splunkcloud.com'), 'Loon 被改动');
  });
  test('抖音临时测试模块已撤下', () => {
    assert(!Object.keys(files).some((k) => /douyin-probe/.test(k)), '生成文件仍含测试模块');
    assert(!require('fs').existsSync(require('path').join(__dirname, '../modules/douyin-probe.sgmodule')), '测试模块仍存在');
  });
};
