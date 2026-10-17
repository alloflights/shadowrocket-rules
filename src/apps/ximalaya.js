const r = String.raw;
const X = r`^https?:\/\/.*\.xima.*\.com\/`;
module.exports = {
  id: 'ximalaya',
  name: '喜马拉雅净化',
  desc: '去除喜马拉雅开屏、首页轮播 / 直播 / 动态推广、福利中心与各类弹窗、搜索热词。',
  author: 'ddgksf2013,alloflights',
  rules: [
    'DOMAIN-SUFFIX,adse.ximalaya.com,REJECT',
    'DOMAIN-SUFFIX,adse.wsa.ximalaya.com,REJECT',
    'DOMAIN-SUFFIX,adbehavior.ximalaya.com,REJECT',
    'DOMAIN-SUFFIX,xdcs-collector.ximalaya.com,REJECT',
  ],
  rewrites: [
    X + r`.*(adse|adRealTime|ting\/(loading|feed|home|preload)|outadservice) - reject`,
    X + r`discovery-feed\/(focus\/queryF|isShowUserGiftPendant) - reject`,
    r`^https?:\/\/passport\.ximalaya\.com\/friendship-mobile\/v1\/findFriendsBanner - reject`,
    X + r`mobile-playpage\/view\/ - reject`,
    X + r`chaos-notice-web\/v1\/message\/preview\/list - reject`,
    X + r`social-web\/bottomTabs\/dynamicEntrance\/status - reject`,
    r`^https?:\/\/gslb.*\.xima.*\.com\/ - reject`,
    X + r`(dog-portal\/checkOld|(child-mobile\/child|aged-mobile\/aged)\/mode\/query) - reject`,
    X + r`mobile-user\/(unread|minorProtection\/pop) - reject`,
    X + r`collector\/xl\/v\d - reject`,
    X + r`butler-portal\/versionCheck - reject`,
    X + r`mobile\/discovery\/v\d\/location - reject`,
    X + r`(hub\/)?(hotWord|hotWordBillboard|guideWord) - reject`,
  ],
  scripts: [
    { name: 'ximalaya_clean', type: 'response', pattern: X + r`(discovery-category\/(customCategories|v\d\/category)|focus-mobile\/focusPic|discovery-feed\/v\d\/mix|mobile-user\/v\d\/homePage)`, script: 'ximalaya_json.js', maxSize: 1048576 },
  ],
  mitm: ['*.ximalaya.com'],
};
