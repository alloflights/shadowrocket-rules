const r = String.raw;
module.exports = {
  id: 'qidian',
  name: '起点读书净化',
  desc: '去除起点读书开屏、每日导读弹窗、书架悬浮广告与活动推广。',
  rules: [],
  rewrites: [],
  scripts: [
    { name: 'qidian_clean', type: 'response', pattern: r`^https:\/\/magev6\.if\.qidian\.com\/argus\/api\/(v4\/client\/getsplashscreen|v2\/(deeplink\/geturl|dailyrecommend\/getdailyrecommend)|v1\/(client\/getconf$|bookshelf\/getHoverAdv|adv\/getadvlistbatch\?positions=iOS_tab))`, script: 'qidian.js', maxSize: 1048576 },
  ],
  mitm: ['magev6.if.qidian.com'],
};
