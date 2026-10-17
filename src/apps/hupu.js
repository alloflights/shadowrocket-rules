const r = String.raw;
module.exports = {
  id: 'hupu',
  name: '虎扑净化',
  desc: '去除虎扑开屏、信息流 / 帖子详情商业推广、下拉刷新推广与搜索热词。',
  author: 'yjqiang,alloflights',
  rules: [
    'DOMAIN,goblin.hupu.com,REJECT',
    'DOMAIN,themis.hupu.com,REJECT',
    'DOMAIN,collect.hupu.com,REJECT',
    'DOMAIN,adx.hupu.com,REJECT',
    'DOMAIN,adx-action.hupu.com,REJECT',
  ],
  rewrites: [
    r`^https?:\/\/[\w-]+\.mobileapi\.hupu\.com\/.+\/(interfaceAd|banners|search\/v2\/(hotkeylist|hintkeylist)) - reject`,
    r`^https?:\/\/bbs\.mobileapi\.hupu\.com\/.+\/bbsallapi\/(lego\/data|tag\/v\d\/heatTag) - reject-dict`,
    r`^https?:\/\/games\.mobileapi\.hupu\.com\/.+\/bplapi\/user\/v1\/more - reject-dict`,
  ],
  scripts: [],
  mitm: ['*.mobileapi.hupu.com'],
};
