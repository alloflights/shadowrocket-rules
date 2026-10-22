'use strict';
// Client-specific fixes. Never feed these overrides into the Loon builder.
const r = String.raw;
const MEDIA_SUFFIXES = ['qpic.cn', 'qlogo.cn', 'wx.qq.com', 'wxapp.tc.qq.com', 'vweixinf.tc.qq.com', 'vweixinthumb.tc.qq.com', 'up-hl.3g.qq.com', 'yun-hl.3g.qq.com', 'wx.gtimg.com', 'wxs.qq.com'];
const DNS_HOSTS = ['dns.weixin.qq.com', 'dns.weixin.qq.com.cn', 'aedns.weixin.qq.com'];
const guardRules = () => ['# QQ / 微信原生解析与共用媒体保护；不放行整个 qq.com / weixin.qq.com', ...DNS_HOSTS.map(h => `DOMAIN,${h},DIRECT`), ...MEDIA_SUFFIXES.map(h => `DOMAIN-SUFFIX,${h},DIRECT`)];
const realIP = () => [...DNS_HOSTS, ...MEDIA_SUFFIXES.flatMap(h => [h, `*.${h}`])];
const ALI = r`^https?:\/\/(?:acs\.m\.taobao\.com|guide-acs\.m\.taobao\.com|(?:g-)?acs\.m\.goofish\.com|h5api\.m\.(?:taobao|goofish)\.com)\/(?:gw|h5)\/`;
const SPLASH = ALI + r`mtop\.taobao\.(?:idlecommerce\.splash|idle\.local\.splash|idle\.home\.welcome)(?:[./?]|$)`;
const TAO = `(?:${ALI}${r`mtop\.taobao\.wireless\.home\.splash\.awesome\.get(?:[/?]|$)`}|${r`^https:\/\/guide-acs\.m\.taobao\.com\/gw\/mtop\.taobao\.cloudvideo\.video\.query(?:[/?]|$)`})`;
const ALI_HOSTS = ['acs.m.taobao.com', 'guide-acs.m.taobao.com', 'acs.m.goofish.com', 'g-acs.m.goofish.com', 'h5api.m.taobao.com', 'h5api.m.goofish.com'];
function adapt(u) {
  u = { ...u, rules: Array.isArray(u.shadowrocketRules) ? u.shadowrocketRules : u.rules };
  if (u.id === 'zhihu') {
    u.scripts = u.scripts.map(s => ({ ...s, script: 'zhihu-sr.js', pattern: s.pattern.replace('topstory\\/hot-lists', '(?:v4\\/)?topstory\\/hot-lists') }));
  }
  if (u.id === 'xiaohongshu') {
    u.scripts = u.scripts.map(s => ({ ...s, script: 'xiaohongshu-sr.js', pattern: s.pattern.replace('(note\\/', '(note\\/comment\\/(list|sub_comments)|note\\/') }));
    u.desc += ' 小火箭额外处理评论与子评论的图片保存标记；不伪造无水印原图。';
  }
  if (u.id === 'taobao' || u.id === 'goofish') {
    u.desc = u.desc.replace(/首次启用后请删除重装[^。]+。?/, '') + ' 小火箭兼容多网关开屏响应，保留 MTop 信封；若仍出现离线缓存广告，可先清理应用内广告缓存。';
    u.rewrites = (u.rewrites || []).filter(line => !/idlecommerce\\.splash|idle\\.local\\.splash|idle\\.home\\.welcome/.test(line));
    u.mitm = [...new Set([...(u.mitm || []), ...ALI_HOSTS])];
    if (u.id === 'goofish') u.scripts = u.scripts.map(s => ({ ...s, script: 'goofish-sr.js', pattern: ALI + s.pattern.slice(s.pattern.indexOf('mtop')) }));
    const pattern = u.id === 'taobao' ? `(?:${TAO}|^https:\\/\\/poplayer\\.template\\.alibaba\\.com\\/[^/?]+\\.json(?:[?]|$))` : SPLASH;
    if (u.id === 'taobao') u.bodyRewrites = []; // No jq + script double-processing of the same response.
    u.scripts = [...(u.scripts || []),
      { name: `${u.id}_splash_cache`, type: 'request', pattern, script: 'ali-splash-sr.js' },
      { name: `${u.id}_splash_clean`, type: 'response', pattern, script: 'ali-splash-sr.js', maxSize: 2097152 }];
  }
  return u;
}
// Remove only the five obsolete SR rejections now explicitly protected above.
// Keep the shared ad source byte-identical for Loon.
const obsolete = new Set(['DOMAIN,dns.weixin.qq.com,REJECT', 'DOMAIN,dns.weixin.qq.com.cn,REJECT', 'DOMAIN,aedns.weixin.qq.com,REJECT', 'DOMAIN-SUFFIX,wxsnsdy.wxs.qq.com,REJECT', 'DOMAIN-SUFFIX,wxsnsdythumb.wxs.qq.com,REJECT']);
const filterAdRules = lines => lines.filter(line => !obsolete.has(line.trim()));
// jsDelivr currently returns 403 for this single list; SR uses the verified
// upstream raw endpoint. Leave Loon's shared list and emitted files unchanged.
function routing(lines) {
  return [...guardRules(), ...lines.map(line => line.replace('https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Shadowrocket/DouYin/DouYin.list', 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Shadowrocket/DouYin/DouYin.list'))];
}
module.exports = { routing, filterAdRules, adapt, guardRules, realIP, MEDIA_SUFFIXES, DNS_HOSTS };
