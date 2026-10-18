// 微店：参考 可莉 Weidian 插件（保留“关注”信息流）
const r = String.raw;
const THOR = r`^https:\/\/thor\.weidian\.com\/`;
module.exports = {
  id: 'weidian',
  name: '微店净化',
  desc: '去除微店开屏、弹窗、猜你喜欢、相似推荐、搜索底纹与话题、推荐店铺与达人。',
  rules: [],
  rewrites: [
    r`ares\/home\.splash\/`, r`ares\/app\.dialog\/`, r`warlock\/recommend\.guessULike\/`, r`poseidon\/exhibit\.spaceJson\/`,
    r`feedserver\/feed\.similarRecFeeds\/`, r`faith\/search\.hotRecShadowWord\/`, r`faith\/search\.getProcessTopics\/`,
    r`feedserver\/feed\.listGoodUsers\/`, r`ares\/recommend\.getSpecialFocusList\/`, r`ares\/collect\.recommendShop\/`,
  ].map((p) => `${THOR}${p} - reject-dict`),
  scripts: [],
  mitm: ['thor.weidian.com'],
};
