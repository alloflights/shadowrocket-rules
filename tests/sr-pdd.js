'use strict';
// v3.3.7：小火箭不再对拼多多做任何重写 / 解密 / 拦截 / 显式分流（合成用例）。
module.exports = function ({ test, assert, files, read, body, sectionOf, routeOf }) {
  const sr = require('../src/shadowrocket');
  const PDD = /pinduoduo|pddpic|pddugc|yangkeduo|xunmeng/i;
  const srFiles = Object.keys(files).filter((k) => k.startsWith('modules/') || /^Shadowrocket_.*\.conf$/.test(k));
  test('小火箭：所有配置与模块都不含拼多多规则 / 重写 / 解密', () => {
    for (const rel of srFiles) {
      const hit = files[rel].split('\n').find((l) => PDD.test(l));
      assert(!hit, `${rel}: ${hit}`);
    }
    assert(!files['modules/pdd.sgmodule'] && !require('fs').existsSync(require('path').join(__dirname, '../modules/pdd.sgmodule')), '拼多多单模块应撤下');
  });
  for (const rel of ['Shadowrocket_LazyGroup_Merged.conf', 'Shadowrocket_AllInOne_Ultimate.conf']) test(`${rel}：拼多多交给国内域名集直连`, () => {
    const rules = body(sectionOf(files[rel], 'Rule'));
    for (const host of ['api.pinduoduo.com', 'titan.pinduoduo.com', 'mobile.yangkeduo.com', 'img.pddpic.com', 'video.pddugc.com', 'x.pinduoduo.net']) {
      assert(!routeOf(rules, host), `${host} 仍有显式规则：${routeOf(rules, host) && routeOf(rules, host).rule}`);
    }
    assert(rules.some((l) => /\/China\/China_Domain\.list,DIRECT$/.test(l)) && rules.includes('GEOIP,CN,DIRECT'), '缺少国内直连兜底');
    for (const rel2 of ['modules/adblock-ultimate.sgmodule', 'modules/adblock.sgmodule']) {
      const m = body(sectionOf(files[rel2], 'Rule'));
      for (const host of ['api.pinduoduo.com', 'titan.pinduoduo.com', 'mobile.yangkeduo.com']) assert(!routeOf(m, host), `${rel2} 抢先命中 ${host}`);
    }
  });
  test('Loon：拼多多插件与分流保持原样', () => {
    assert(sr.SR_DROPPED.has('pdd'));
    const loon = Object.entries(files).filter(([k]) => k.startsWith('loon/') || k === 'Loon_LazyGroup.conf').map(([, v]) => v).join('\n');
    assert(/PinDuoDuo_remove_ads/.test(loon) && /pinduoduo\.com/.test(loon), 'Loon 拼多多基线被改动');
  });
};
