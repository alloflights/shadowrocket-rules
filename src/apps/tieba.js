const r = String.raw;
module.exports = {
  id: 'tieba',
  name: '百度贴吧净化',
  desc: '去除贴吧开屏、首页推荐伪装广告贴、吧内商业贴、详情页直播推荐与插楼广告（JSON + Protobuf）。',
  rules: [
    'IP-CIDR,180.76.76.200/32,REJECT,no-resolve',
  ],
  rewrites: [
    r`^https?:\/\/tiebac\.baidu\.com\/c\/s\/log - reject-200`,
  ],
  scripts: [
    { name: 'tieba_json', type: 'response', pattern: r`^https?:\/\/(tiebac|c\.tieba)\.baidu\.com\/(c\/(s\/sync|f\/(ad\/getSplashAd|frs\/(page|threadlist|generalTabList)|pb\/(pic)?page|excellent\/personalized))$|tiebaads\/commonbatch\?)`, script: 'tieba-json.js', maxSize: 1048576 },
    { name: 'tieba_proto', type: 'response', pattern: r`^https?:\/\/(tiebac|c\.tieba)\.baidu\.com\/c\/(b\/ad\/adBid|f\/(frs\/(page|threadlist|generalTabList)|ad\/getFeedAd|pb\/page|excellent\/personalized))\?cmd`, script: 'tieba-proto.js', maxSize: 1048576, binary: true },
  ],
  mitm: ['tiebac.baidu.com', 'c.tieba.baidu.com'],
};
