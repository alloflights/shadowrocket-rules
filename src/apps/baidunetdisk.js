const r = String.raw;
const PAN = r`^https?:\/\/pan\.baidu\.com\/`;
module.exports = {
  id: 'baidunetdisk',
  name: '百度网盘净化',
  desc: '去除百度网盘开屏与倒计时、首页卡片推广、会员引导、福利活动与热榜，清洗 getsyscfg 广告配置；不触碰文件列表。',
  rules: [
    'DOMAIN,update.pan.baidu.com,REJECT',
    'DOMAIN,fc-video.cdn.bcebos.com,REJECT',
    'DOMAIN,rp.hpplay.cn,REJECT',
    'DOMAIN-SUFFIX,afd.baidu.com,REJECT',
  ],
  rewrites: [
    PAN + r`rest\/.*\/membership\/(proxy\/)?guide - reject-200`,
    PAN + r`pmall\/order\/privilege\/info - reject-dict`,
    PAN + r`api\/useractivity\/activity - reject-dict`,
    PAN + r`api\/certuser\/get - reject-dict`,
    PAN + r`component\/view\/(1510|1130)\?vip - reject-dict`,
    PAN + r`feed\/hotlist - reject-200`,
    PAN + r`coins\/center\/notice - reject-200`,
    PAN + r`queryintent\/queryhint - reject-200`,
    PAN + r`api\/taskscore\/tasklist - reject-dict`,
    PAN + r`(buy\/ad\/analytics|api\/analytics) - reject-200`,
    r`^https?:\/\/ndstatic\.cdn\.bcebos\.com\/activity\/welfare\/(js\/.+\.js|index\.html) - reject-200`,
    r`^https?:\/\/staticsns\.cdn\.bcebos\.com\/amis\/.+\/banner\.png - reject-img`,
    r`^https?:\/\/issuecdn\.baidupcs\.com\/issue\/netdisk\/.*(guanggao|splash|advert|\/ad\/) - reject-img`,
  ],
  scripts: [
    { name: 'baidunetdisk_splash', type: 'request', pattern: PAN + r`.*(pcs\/adx?|membership\/advertise|splash|buy\/ad\/(conf|get)|api\/ad\/|act\/(api\/activityentry|v\d\/(bchannel|welfare)\/list)|feed\/cardinfos|recommend\/shortseries\/list)`, script: 'baidunetdisk.js' },
    { name: 'baidunetdisk_clean', type: 'response', pattern: PAN + r`(api\/(getsyscfg|getconfig)|feed\/|act\/|pmall\/|.*(welfare|bchannel|pcs\/ad))`, script: 'baidunetdisk.js', maxSize: 2097152 },
  ],
  mitm: ['pan.baidu.com', 'ndstatic.cdn.bcebos.com', 'staticsns.cdn.bcebos.com', 'issuecdn.baidupcs.com'],
};
