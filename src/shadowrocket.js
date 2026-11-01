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
// Xiaohongshu SR-only refresh (ref fmz200 2026-10): rnote.com backup API hosts,
// rec/so hosts, search hint/trending, generic note guide and user banner,
// ad-only CDN hosts. Comment-video download and detailfeed/preload stay untouched.
const XHS_ADS = ['ads-img-qc.xhscdn.com', 'ads-img-al.xhscdn.com', 'ads-video-al.xhscdn.com', 'ads-video-qc.xhscdn.com', 't-ads.xiaohongshu.com'];
const XHS_MITM = ['rec.xiaohongshu.com', 'so.xiaohongshu.com', 'edith.rnote.com', 'www.rnote.com', 'ci.rnote.com', 'so.rnote.com', 'rec.rnote.com'];
function xhsSR(u) {
  const H = r`(xiaohongshu|rnote)\.com`;
  u.rules = [...(u.rules || []), ...XHS_ADS.map(h => `DOMAIN,${h},REJECT`)];
  u.rewrites = [
    r`^https?:\/\/ci\.` + H + r`\/system_config\/watermark - reject-img`,
    r`^https?:\/\/edith\.` + H + r`\/api\/sns\/v1\/surprisebox\/(get_style|open|submit_action) - reject-dict`,
    r`^https?:\/\/edith\.` + H + r`\/api\/sns\/v\d+\/note\/guide\? - reject-dict`,
    r`^https?:\/\/edith\.` + H + r`\/api\/sns\/v\d+\/guide\/user_banner - reject-dict`,
    r`^https?:\/\/www\.` + H + r`\/api\/marketing\/box\/trigger\? - reject-dict`,
    r`^https?:\/\/www\.` + H + r`\/api\/sns\/(v\d+\/ads\/resource|v\d+\/hey\/\w+\/hey_gallery) - reject-dict`,
  ];
  u.scripts = u.scripts.map(s => ({ ...s, pattern: r`^https?:\/\/(edith|rec|www|so)\.` + H + r`\/api\/sns\/v\d+\/(note\/comment\/(list|sub_comments)|note\/(imagefeed|feed|videofeed|widgets|live_photo\/save|video\/save|detail)|homefeed|system_service\/(splash_config|config)|search\/(banner_list|hot_list|hint|trending|notes)|followfeed)` }));
  u.mitm = [...new Set([...(u.mitm || []), ...XHS_MITM])];
  return u;
}
function adapt(u) {
  u = { ...u, rules: Array.isArray(u.shadowrocketRules) ? u.shadowrocketRules : u.rules };
  if (u.id === 'zhihu') {
    // Known ad-only answer/article bottom endpoints; do not blanket-block commercial_api.
    u.rewrites = [...(u.rewrites || []),
      r`^https?:\/\/api\.zhihu\.com\/commercial_api\/(?:answer|article)\/\d+\/bottom-v2\/?(?:[?#]|$) - reject-dict`,
      r`^https?:\/\/api\.zhihu\.com\/distribute\/rhea\/qa_ad_card\/h5\/recommendation\/?(?:[?#]|$) - reject-dict`,
    ];
    u.scripts = u.scripts.map(s => ({ ...s, script: 'zhihu-sr.js', pattern: s.pattern
      .replace('topstory\\/hot-lists', '(?:v4\\/)?topstory\\/hot-lists')
      .replace('|answers\\/\\d+', '|answers\\/(?:v2\\/)?\\d+')
      .replace('|articles\\/\\d+', '|articles\\/(?:v2\\/)?\\d+') }));
  }
  if (u.id === 'xiaohongshu') {
    u.scripts = u.scripts.map(s => ({ ...s, script: 'xiaohongshu-sr.js', pattern: s.pattern.replace('(note\\/', '(note\\/comment\\/(list|sub_comments)|note\\/') }));
    u.desc += ' 小火箭额外处理评论与子评论的图片保存标记；不伪造无水印原图。';
    u = xhsSR(u);
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
// Douyin / ByteDance ad, lead-form and telemetry hosts. Never touch feed,
// comment, video, image, live or config hosts (feed cannot be MITM'd on 38.x).
// v3.3.8: user asked to kill everything killable at the network layer.
const DOUYIN_ADS = [
  'DOMAIN-SUFFIX,pangolin-sdk-toutiao.com,REJECT',
  'DOMAIN-SUFFIX,pangolin-sdk-toutiao-b.com,REJECT',
  'DOMAIN-SUFFIX,pangolin-sdk-toutiao1.com,REJECT',
  'DOMAIN-SUFFIX,pglstatp-toutiao.com,REJECT',
  'DOMAIN-SUFFIX,pangle-ads.com,REJECT',
  'DOMAIN-SUFFIX,byte-ads.com,REJECT',
  'DOMAIN-SUFFIX,oceanengine.com,REJECT',
  'DOMAIN-SUFFIX,ad.toutiao.com,REJECT',
  'DOMAIN-SUFFIX,ad.zijieapi.com,REJECT',
  'DOMAIN-SUFFIX,analytics.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,log.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,applog.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,toblog.ctobsnssdk.com,REJECT',
  'DOMAIN-SUFFIX,mon.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,apm.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,log0-misc-1f.amemv.com,REJECT',
  'DOMAIN-SUFFIX,mon0-misc-1f.amemv.com,REJECT',
  'DOMAIN-SUFFIX,logbk.amemv.com,REJECT',
  'DOMAIN-SUFFIX,ecombdapi.com,REJECT',
  'DOMAIN-SUFFIX,ecombdpage.com,REJECT',
  'DOMAIN-SUFFIX,ecombdimg.com,REJECT',
  'DOMAIN-SUFFIX,ecombdstatic.com,REJECT',
  'DOMAIN,ecomuser.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,render.ecombdpage.com,REJECT',
  'DOMAIN,pitaya.bytedance.com,REJECT',
  'DOMAIN-SUFFIX,polaris5-normal-zb.zijieapi.com,REJECT',
  'DOMAIN-SUFFIX,polaris.zijieapi.com,REJECT',
  'DOMAIN-SUFFIX,abtest3-misc-1f.zijieapi.com,REJECT',
  'DOMAIN-SUFFIX,mssdk3-normal-1f.zijieapi.com,REJECT',
  'DOMAIN-SUFFIX,neptune-api.volces.com,REJECT',
  'DOMAIN-SUFFIX,wmzfylgdsz.com,REJECT',
  // --- v3.3.13 新增：穿山甲 (Pangle/CSJ) 与字节商业化归因补充 ---
  'DOMAIN-SUFFIX,csjplatform.com,REJECT',
  'DOMAIN-SUFFIX,pangolin.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,pangolin-dsp-toutiao.com,REJECT',
  'DOMAIN-SUFFIX,pglstatp-snssdk.com,REJECT',
  'DOMAIN-SUFFIX,ctobsnssdk.com,REJECT',
  // --- v3.3.13 新增：巨量引擎多机房 (hl/lf/lq/zb) 广告变体与投放追踪 ---
  'DOMAIN-SUFFIX,ads3-normal-hl.zijieapi.com,REJECT',
  'DOMAIN-SUFFIX,ads3-normal-lf.zijieapi.com,REJECT',
  'DOMAIN-SUFFIX,ads3-normal-lq.zijieapi.com,REJECT',
  'DOMAIN-SUFFIX,ads3-normal-zb.zijieapi.com,REJECT',
  'DOMAIN-SUFFIX,ads5-normal-hl.zijieapi.com,REJECT',
  'DOMAIN-SUFFIX,ads5-normal-lf.zijieapi.com,REJECT',
  'DOMAIN-SUFFIX,ads5-normal-lq.zijieapi.com,REJECT',
  'DOMAIN-SUFFIX,ads5-normal-zb.zijieapi.com,REJECT',
  'DOMAIN-SUFFIX,dsp.toutiao.com,REJECT',
  'DOMAIN-SUFFIX,dm.toutiao.com,REJECT',
  'DOMAIN-SUFFIX,track.toutiao.com,REJECT',
  'DOMAIN-SUFFIX,sm.toutiao.com,REJECT',
  // --- v3.3.13 新增：字节商业化统计、扩展日志与设备指纹打点 ---
  'DOMAIN-SUFFIX,bds.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,extlog.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,sdfp.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,log-hl.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,log-lf.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,log-lq.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,mon-hl.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,mon-lf.snssdk.com,REJECT',
  // 抖音广告/归因补充：参考 douyin-lite 与 v2fly/domain-list-community；会影响字节系其他应用。
  'DOMAIN-SUFFIX,pangle.cn,REJECT',
  'DOMAIN-SUFFIX,pangle.io,REJECT',
  'DOMAIN-SUFFIX,oceanengine.cn,REJECT',
  'DOMAIN-SUFFIX,adshare.toutiao.com,REJECT',
  'DOMAIN-SUFFIX,shoppingads.cn,REJECT',
  'DOMAIN-SUFFIX,panplayable-toutiao.com,REJECT',
  'DOMAIN-SUFFIX,panplayable-toutiao-b.com,REJECT',
  'DOMAIN-SUFFIX,mcs.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,volceapplog.com,REJECT',
  'DOMAIN-SUFFIX,byteadverts.com,REJECT',
  'DOMAIN-SUFFIX,dig.bdurl.net,REJECT',
  'DOMAIN-SUFFIX,pangolin-dsp-toutiao-b.com,REJECT',
  'DOMAIN-SUFFIX,pangolin-hl.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,pangolin-lf.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,pangolin-lq.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,pglstatp-sdk-toutiao.com,REJECT',
  'DOMAIN-SUFFIX,pglstatp-snssdk-toutiao.com,REJECT',
  'DOMAIN-SUFFIX,pglstatp-toutiao-b.com,REJECT',
  'DOMAIN-SUFFIX,log.zijieapi.com,REJECT',
  'DOMAIN-KEYWORD,pangolin,REJECT',
  'DOMAIN-KEYWORD,pglstatp,REJECT',
  'DOMAIN-KEYWORD,panplayable-toutiao,REJECT',
  // 保留原有规则（附件要求）
  'DOMAIN-SUFFIX,temai.snssdk.com,REJECT',
  'DOMAIN-SUFFIX,pangle-b.io,REJECT',
  'DOMAIN,lf-leads-fe-scm.bytecdn.com,REJECT',
  'DOMAIN,log0-misc-lf.amemv.com,REJECT',
  'DOMAIN,log0-misc-hl.amemv.com,REJECT',
  'DOMAIN,mon0-misc-lf.amemv.com,REJECT',
  'DOMAIN,logbk.amemv.com,REJECT',
  'DOMAIN,log-hl.snssdk.com,REJECT',
  'DOMAIN,xlog.snssdk.com,REJECT',
  'DOMAIN,mon.zijieapi.com,REJECT',
  'DOMAIN,os-mon.zijieapi.com,REJECT',
  'DOMAIN,mcs.zijieapi.com,REJECT',
  'DOMAIN,apmplus.volces.com,REJECT',
  'DOMAIN,gator.volces.com,REJECT',
  'DOMAIN-KEYWORD,ads3-normal,REJECT',
  'DOMAIN-KEYWORD,ads5-normal,REJECT',
  'DOMAIN-KEYWORD,polaris3-normal,REJECT',
  'DOMAIN-KEYWORD,polaris5-normal,REJECT',
  'DOMAIN-KEYWORD,log0-misc,REJECT',
  'DOMAIN-KEYWORD,log3-misc,REJECT',
  'DOMAIN-KEYWORD,mon0-misc,REJECT',
  'DOMAIN-KEYWORD,mon3-misc,REJECT',
  'DOMAIN-KEYWORD,-developer.bytemaimg.com,REJECT',
];
// Pinduoduo: user decision on Shadowrocket — no rewrite / jq / MITM / reject / explicit
// routing at all (it loaded slowly and had little ads). Domains fall through to the
// China_Domain set / GEOIP and stay DIRECT. Loon keeps its baseline plugin.
const SR_DROPPED = new Set(['pdd']);
const PDD = /(?:^|[.,(])(?:pinduoduo\.com|pinduoduo\.net|pddpic\.com|pddugc\.com|yangkeduo\.com)(?:[,)]|$)|com\.xunmeng\.pinduoduo/i;
const srUnits = apps => apps.filter(u => !SR_DROPPED.has(u.id)).map(adapt);
const filterAdRules = lines => [...lines.filter(line => !obsolete.has(line.trim()) && !PDD.test(line)), ...DOUYIN_ADS];
// Notion goes through the proxy on Shadowrocket (user decision); Loon keeps its baseline.
const NOTION = ['notion.so', 'notion.site', 'notion.com', 'notion-static.com', 'notionusercontent.com'];
const NOTION_EXTRA = ['DOMAIN-SUFFIX,notion.new,PROXY', 'DOMAIN-SUFFIX,makenotion.com,PROXY',
  'DOMAIN,prod-files-secure.s3.us-west-2.amazonaws.com,PROXY', 'DOMAIN,http-inputs-notion.splunkcloud.com,PROXY'];
function notionProxy(lines) {
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^#\s*Notion /.test(t)) { out.push('# Notion 走代理'); continue; }
    const m = t.match(/^DOMAIN-SUFFIX,([^,]+),DIRECT$/);
    if (m && NOTION.includes(m[1])) {
      out.push(`DOMAIN-SUFFIX,${m[1]},PROXY`);
      if (m[1] === NOTION[NOTION.length - 1]) out.push(...NOTION_EXTRA);
      continue;
    }
    out.push(line);
  }
  return out;
}
// jsDelivr currently returns 403 for this single list; SR uses the verified
// upstream raw endpoint. Leave Loon's shared list and emitted files unchanged.
function routing(lines) {
  return [...guardRules(), ...notionProxy(lines).filter(line => !(/^DOMAIN-SUFFIX,[^,]+,DIRECT$/.test(line.trim()) && PDD.test(line)) && !/^#.*拼多多/.test(line.trim())).map(line => line.replace('https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Shadowrocket/DouYin/DouYin.list', 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Shadowrocket/DouYin/DouYin.list'))];
}
module.exports = { routing, filterAdRules, srUnits, SR_DROPPED, PDD, notionProxy, DOUYIN_ADS, NOTION, NOTION_EXTRA, adapt, guardRules, realIP, MEDIA_SUFFIXES, DNS_HOSTS };
