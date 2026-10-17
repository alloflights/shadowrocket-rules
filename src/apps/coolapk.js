// 酷安：自营开屏 = /v6/main/init 里的 imageCard；配置卡 6390 的 SplashAd.* 控制开屏/热启动开屏
const r = String.raw;
module.exports = {
  id: 'coolapk',
  name: '酷安去广告',
  desc: '彻底去除酷安开屏（不再出现空白开屏与“跳过”按钮）、热启动开屏、首页/动态详情/评论区赞助卡片与热搜。首次启用后请删除重装酷安一次。',
  rules: [
    'DOMAIN,ad.api.coolapk.com,REJECT',
  ],
  rewrites: [
    r`^https?:\/\/api\d*\.coolapk\.com\/v6\/search\?.*type=hotSearch - reject-dict`,
  ],
  scripts: [
    { name: 'coolapk_init_req', type: 'request', pattern: r`^https?:\/\/api\d*\.coolapk\.com\/v6\/main\/init`, script: 'coolapk.js' },
    { name: 'coolapk_init', type: 'response', pattern: r`^https?:\/\/api\d*\.coolapk\.com\/v6\/main\/init`, script: 'coolapk.js', maxSize: 1048576 },
    { name: 'coolapk_feed', type: 'response', pattern: r`^https?:\/\/api\d*\.coolapk\.com\/v6\/(main\/(indexV\d+|dataList)|page\/dataList|feed\/(detail|replyList|index))`, script: 'coolapk.js', maxSize: 2097152 },
  ],
  mitm: ['api.coolapk.com', 'api2.coolapk.com'],
};
