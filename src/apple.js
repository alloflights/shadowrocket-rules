'use strict';
// Shadowrocket 基础服务保护；不依赖可切换的策略组或第三方远程列表。
// 官方网络要求：https://support.apple.com/101555、https://support.apple.com/103229
const DIRECT_SUFFIXES = [
  'apple.com', 'apple.com.cn', 'apple.cn', 'apple',
  'icloud.com', 'icloud.com.cn', 'icloud-content.com', 'apzones.com', 'me.com',
  'itunes.com', 'applemusic.com', 'mzstatic.com', 'cdn-apple.com', 'aaplimg.com',
  'apple-cloudkit.com', 'apple-dns.net', 'apple-livephotoskit.com', 'apple-mapkit.com',
];
// Apple 官方列出的专用第三方主机：不将整个 Cloudflare / Fastly 网络设为直连。
const DIRECT_HOSTS = ['apple-relay.cloudflare.com', 'apple-relay.fastly-edge.com', 'cp4.cloudflare.com'];
// 最新用户决策：Developer / WWDC 也直连，不保留代理例外。
const DEVELOPER_HOSTS = ['developer.apple.com', 'devimages-cdn.apple.com', 'devstreaming-cdn.apple.com'];
const LOCAL_RULES = [
  'DOMAIN-SUFFIX,local,DIRECT',
  'IP-CIDR,127.0.0.0/8,DIRECT,no-resolve',
  'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
  'IP-CIDR,172.16.0.0/12,DIRECT,no-resolve',
  'IP-CIDR,192.168.0.0/16,DIRECT,no-resolve',
  'IP-CIDR,169.254.0.0/16,DIRECT,no-resolve',
  'IP-CIDR,100.64.0.0/10,DIRECT,no-resolve',
  'IP-CIDR,224.0.0.0/4,DIRECT,no-resolve',
  'IP-CIDR6,::1/128,DIRECT,no-resolve',
  'IP-CIDR6,fe80::/10,DIRECT,no-resolve',
  'IP-CIDR6,fc00::/7,DIRECT,no-resolve',
  'IP-CIDR6,ff00::/8,DIRECT,no-resolve',
  'IP-CIDR,17.0.0.0/8,DIRECT,no-resolve',
];
const DOMAIN_SET = 'https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Shadowrocket/Apple/Apple_Domain.list';
function guardRules() {
  return [
    '# Apple 基础服务固定 DIRECT；不受旧「苹果服务」策略选择影响',
    'DOMAIN,captive.apple.com,DIRECT', 'DOMAIN-SUFFIX,push.apple.com,DIRECT',
    ...DEVELOPER_HOSTS.map((h) => `DOMAIN,${h},DIRECT`),
    ...DIRECT_SUFFIXES.map((d) => `DOMAIN-SUFFIX,${d},DIRECT`),
    ...DIRECT_HOSTS.map((h) => `DOMAIN,${h},DIRECT`),
    '# 接力 / AirDrop / AirPlay：局域网、AWDL 链路本地与组播直连，不全局放行特定端口',
    ...LOCAL_RULES,
    `DOMAIN-SET,${DOMAIN_SET},DIRECT`,
  ];
}
function protect(lines) {
  const mapped = lines.map((line) => {
    if (!line.trim() || line.trim().startsWith('#')) return line
      .replace('全部交给「苹果服务」组（默认直连）', '在小火箭中固定 DIRECT')
      .replace('Apple Developer App（文档 / WWDC 视频）按用户决策走代理；TestFlight 不单列，随「苹果服务」直连', 'Apple Developer / WWDC / TestFlight 均按最新用户决策直连');
    const p = line.split(',');
    if (p[2] === '苹果服务' || (/^DOMAIN(-SUFFIX)?$/.test(p[0]) && DIRECT_SUFFIXES.some((d) => p[1] === d || p[1].endsWith('.' + d)))) p[2] = 'DIRECT';
    return p.join(',');
  });
  return [...guardRules(), ...mapped];
}
const mitmExcludes = () => DIRECT_SUFFIXES.flatMap((d) => [`-${d}`, `-*.${d}`]).concat(DIRECT_HOSTS.map((h) => `-${h}`));
module.exports = { DIRECT_SUFFIXES, DIRECT_HOSTS, DEVELOPER_HOSTS, DOMAIN_SET, LOCAL_RULES, guardRules, protect, mitmExcludes };
