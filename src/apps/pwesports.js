const r = String.raw;
const H = r`^https?:\/\/((api|app|client)\.pwesports\.cn|(api\.)?esports\.wanmei\.com)\/`;
module.exports = {
  id: 'pwesports',
  name: '完美世界电竞净化',
  desc: '去除完美世界电竞开屏、社区与资讯信息流推广、轮播横幅与弹窗。',
  rules: [
    'DOMAIN,ad.pwesports.cn,REJECT',
    'DOMAIN,advert.pwesports.cn,REJECT',
    'DOMAIN,analytics.wanmei.com,REJECT',
    'DOMAIN,log.pwesports.cn,REJECT',
    'DOMAIN,tracker.pwesports.cn,REJECT',
    'DOMAIN,tracking.pwesports.cn,REJECT',
    'DOMAIN,stat.esports.wanmei.com,REJECT',
    'DOMAIN,log-sdk.wanmei.com,REJECT',
    'DOMAIN-SUFFIX,telemetry.wanmei.com,REJECT',
  ],
  rewrites: [
    H + r`.*(feed\/ad|promote|popup|banner_ad) - reject-dict`,
  ],
  scripts: [
    { name: 'pwesports_splash', type: 'request', pattern: H + r`.*(splash|startup|launch|advert|open_screen|boot_ad)`, script: 'pwesports.js' },
    { name: 'pwesports_clean', type: 'response', pattern: H + r`(app|api)\/(v\d\/)?(feed|news|community|home|banner|match|article|square|post|index)`, script: 'pwesports.js', maxSize: 2097152 },
  ],
  mitm: ['api.pwesports.cn', 'app.pwesports.cn', 'client.pwesports.cn', 'esports.wanmei.com', 'api.esports.wanmei.com'],
};
