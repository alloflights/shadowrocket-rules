'use strict';
module.exports = function ({ test, assert, files, read, body, sectionOf, routeOf, globMatches }) {
  const apple = require('../src/apple');
  const fixture = JSON.parse(read('tests/fixtures/apple-services.json'));
  const configs = ['Shadowrocket_LazyGroup_Merged.conf', 'Shadowrocket_AllInOne_Ultimate.conf'];
  for (const rel of configs) {
    const text = files[rel]; const rules = body(sectionOf(text, 'Rule'));
    for (const service of fixture.services) test(`${rel}: ${service.name} 必须是 DIRECT，不能仅默认直连`, () => {
      for (const host of service.hosts) {
        const hit = routeOf(rules, host);
        assert(hit && hit.policy === 'DIRECT', `${host}: ${hit ? hit.rule : '无显式规则'}`);
        assert(rules.indexOf(hit.rule) < rules.findIndex((l) => /^(RULE-SET|DOMAIN-SET),/.test(l)), `${host} 不得依赖远程列表`);
      }
    });
    test(`${rel}: Apple 远程列表固定 DIRECT，基础服务不引用可选代理的策略组`, () => {
      assert(!rules.some((l) => /,苹果服务(?:,|$)/.test(l)), '仍引用可切换的苹果服务组');
      assert(rules.some((l) => /\/Apple\/Apple.list,DIRECT$/.test(l)), 'Apple 远程列表仍可走代理');
    });
    test(`${rel}: 基础域名为真实 IP，Developer 同样直连和旁路`, () => {
      const get = (name) => sectionOf(text, 'General').find((l) => l.startsWith(name + ' = ')).split(' = ')[1].split(',').map((x) => x.trim());
      const real = get('always-real-ip'); const skip = get('skip-proxy');
      for (const service of fixture.services) for (const host of service.hosts) assert(real.some((p) => globMatches(p, host)), `缺少真实 IP：${host}`);
      for (const host of apple.DEVELOPER_HOSTS) {
        assert(routeOf(rules, host).policy === 'DIRECT', `${host} 未直连`);
        assert(skip.some((p) => globMatches(p, host)), `${host} 缺少旁路`);
      }
    });
    test(`${rel}: 接力 / AirDrop / AirPlay 保留本地、IPv6 链路与组播规则`, () => {
      for (const rule of apple.LOCAL_RULES) assert(rules.includes(rule), `缺少 ${rule}`);
      const general = sectionOf(text, 'General').join('\n');
      for (const value of ['169.254.0.0/16', 'fe80::/10', 'fc00::/7', 'ff00::/8', '::1/128']) assert(general.includes(value), `缺少旁路 ${value}`);
      assert(general.includes('compatibility-mode = 1'), 'mDNS / Bonjour 兼容性配置丢失');
      assert(!rules.some((l) => /^DST-PORT,(5353|5223|3478),/.test(l)), '不应以开放全网端口代替精确本地保护');
    });
  }
  for (const rel of ['modules/adblock-ultimate.sgmodule', 'modules/adblock.sgmodule', 'modules/awavenue.sgmodule']) {
    const rules = body(sectionOf(files[rel], 'Rule'));
    test(`${rel}: Apple 基础服务先于 AWAvenue 和广告拒绝规则保护`, () => {
      const remote = rules.findIndex((l) => /^RULE-SET,/.test(l) && /AWAvenue/.test(l));
      assert(remote >= 0, '找不到广告列表');
      for (const service of fixture.services) for (const host of service.hosts) {
        const hit = routeOf(rules, host);
        assert(hit && hit.policy === 'DIRECT' && rules.indexOf(hit.rule) < remote, `${host} 可能被广告规则抢先匹配`);
      }
      for (const host of apple.DEVELOPER_HOSTS) assert(routeOf(rules, host).policy === 'DIRECT', 'Developer 也必须直连');
    });
  }
  test('全量去广告：Apple 域名根和子域均排除 MITM，不生成 Apple QUIC 阻断', () => {
    const text = files['modules/adblock-ultimate.sgmodule'];
    const hosts = body(sectionOf(text, 'MITM')).join(',').split(',').map((s) => s.trim());
    for (const h of apple.mitmExcludes()) assert(hosts.includes(h), `缺少 ${h}`);
    const quic = body(sectionOf(text, 'Rule')).filter((l) => l.startsWith('AND,') && /PROTOCOL,UDP/.test(l));
    for (const service of fixture.services) for (const host of service.hosts) {
      for (const l of quic) {
        const m = l.match(/\((DOMAIN(?:-SUFFIX)?),([^()]+)\)/);
        if (m) assert(!(m[1] === 'DOMAIN' ? host === m[2] : host === m[2] || host.endsWith('.' + m[2])), `${host} 不应被强制 QUIC 回落`);
      }
    }
  });
};
